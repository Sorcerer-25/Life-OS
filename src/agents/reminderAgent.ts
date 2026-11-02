import { AgentName, ReminderPayload } from '../models/ActionPlan';
import { AgentResult } from '../models/AgentResult';
import { AgentTask } from '../models/AgentTask';
import { NotificationService, defaultNotificationService } from '../notifications/notificationService';
import {
  ReminderRepository,
  defaultReminderRepository,
  ReminderRecord,
} from '../database/reminderRepository';

export interface ReminderAgentOptions {
  notificationService?: NotificationService;
  repository?: ReminderRepository;
  baseDate?: Date; // For deterministic unit testing
}

export class ReminderAgent {
  public readonly name: AgentName = 'reminder_agent';
  private notificationService: NotificationService;
  private repository: ReminderRepository;
  private baseDate?: Date;

  constructor(options?: ReminderAgentOptions) {
    this.notificationService = options?.notificationService || defaultNotificationService;
    this.repository = options?.repository || defaultReminderRepository;
    this.baseDate = options?.baseDate;
  }

  /**
   * Executes a supervisor-approved AgentTask.
   * Enforces validation, idempotency, date constraints, and notification scheduling.
   */
  public async execute(task: AgentTask): Promise<AgentResult> {
    if (task.agentName !== 'reminder_agent') {
      return {
        taskId: task.taskId,
        actionId: task.actionId,
        agentName: task.agentName,
        status: 'failure',
        message: `ReminderAgent cannot execute task intended for '${task.agentName}'.`,
        error: 'INVALID_AGENT_ASSIGNMENT',
      };
    }

    if (task.operation !== 'create_reminder') {
      return {
        taskId: task.taskId,
        actionId: task.actionId,
        agentName: this.name,
        status: 'failure',
        message: `Unsupported reminder operation: '${task.operation}'.`,
        error: 'UNSUPPORTED_OPERATION',
      };
    }

    const data = (task.data || {}) as Partial<ReminderPayload> & Record<string, unknown>;
    const title = (typeof data.title === 'string' ? data.title : '').trim();
    const dueDateStr = typeof data.due_date === 'string' ? data.due_date.trim() : '';
    const timeStr = typeof data.time === 'string' ? data.time.trim() : '';

    // 1. Validate Title
    if (!title) {
      return {
        taskId: task.taskId,
        actionId: task.actionId,
        agentName: this.name,
        status: 'needs_clarification',
        message: 'Reminder title is missing.',
        error: 'MISSING_TITLE',
      };
    }

    // 2. Validate Due Date
    if (!dueDateStr) {
      return {
        taskId: task.taskId,
        actionId: task.actionId,
        agentName: this.name,
        status: 'needs_clarification',
        message: 'Reminder scheduled date is missing.',
        error: 'MISSING_DUE_DATE',
      };
    }

    // 3. Resolve Scheduled Date & Time without altering user intent
    const scheduledDate = this.parseScheduledDateTime(dueDateStr, timeStr);
    if (!scheduledDate || isNaN(scheduledDate.getTime())) {
      return {
        taskId: task.taskId,
        actionId: task.actionId,
        agentName: this.name,
        status: 'failure',
        message: `Invalid reminder date/time format: '${dueDateStr} ${timeStr}'.`,
        error: 'INVALID_DATE_FORMAT',
      };
    }

    // 4. Validate that date is in the future
    const now = this.baseDate ? this.baseDate.getTime() : Date.now();
    if (scheduledDate.getTime() <= now) {
      return {
        taskId: task.taskId,
        actionId: task.actionId,
        agentName: this.name,
        status: 'failure',
        message: `Cannot schedule reminder in the past. Scheduled: ${scheduledDate.toISOString()}, Now: ${new Date(
          now
        ).toISOString()}`,
        error: 'PAST_DATE_ERROR',
      };
    }

    // 5. Idempotency Check by actionId
    try {
      const existing = await this.repository.findByActionId(task.actionId);
      if (existing && existing.status === 'scheduled') {
        return {
          taskId: task.taskId,
          actionId: task.actionId,
          agentName: this.name,
          status: 'duplicate',
          message: `Action '${task.actionId}' has already been scheduled successfully. Duplicate notification prevented.`,
          output: {
            reminderId: existing.id,
            notificationId: existing.notification_id,
            title: existing.title,
            scheduledAt: existing.scheduled_at,
            isDuplicate: true,
          },
        };
      }
    } catch (err: unknown) {
      console.warn('[ReminderAgent] Idempotency lookup error:', err);
    }

    // 6. Persistence & Notification Scheduling
    const reminderId = `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let createdRecord: ReminderRecord | null = null;

    try {
      // Step A: Record as pending in SQLite repository
      createdRecord = await this.repository.create({
        id: reminderId,
        action_id: task.actionId,
        title,
        scheduled_at: scheduledDate.toISOString(),
        status: 'pending',
      });
    } catch (dbErr: unknown) {
      const dbMsg = (dbErr as Error).message || 'Database error';
      return {
        taskId: task.taskId,
        actionId: task.actionId,
        agentName: this.name,
        status: 'failure',
        message: `Failed to persist reminder before scheduling: ${dbMsg}`,
        error: 'DB_INSERT_FAILED',
      };
    }

    // Step B: Schedule notification via NotificationService
    try {
      const { notificationId } = await this.notificationService.scheduleNotification({
        title,
        body: data.recipient ? `Reminder for ${data.recipient}: ${title}` : title,
        scheduledDate,
        reminderId,
        actionId: task.actionId,
      });

      // Step C: Confirm success and update status in database
      await this.repository.updateStatus(reminderId, 'scheduled', notificationId);

      return {
        taskId: task.taskId,
        actionId: task.actionId,
        agentName: this.name,
        status: 'success',
        message: `Reminder scheduled successfully for ${scheduledDate.toLocaleString()}`,
        output: {
          reminderId,
          actionId: task.actionId,
          notificationId,
          title,
          scheduledAt: scheduledDate.toISOString(),
          status: 'scheduled',
        },
      };
    } catch (notifErr: unknown) {
      // Step D: Partial failure handling — never report success without API confirmation
      const notifMsg = (notifErr as Error).message || 'Scheduling failed';
      if (createdRecord) {
        await this.repository.updateStatus(reminderId, 'failed');
      }

      return {
        taskId: task.taskId,
        actionId: task.actionId,
        agentName: this.name,
        status: 'failure',
        message: `Notification scheduling failed: ${notifMsg}`,
        error: 'NOTIFICATION_SCHEDULING_FAILED',
      };
    }
  }

  /**
   * Cancels a previously scheduled reminder and its system notification.
   */
  public async cancel(reminderId: string): Promise<boolean> {
    const record = await this.repository.findById(reminderId);
    if (!record) return false;

    if (record.notification_id) {
      await this.notificationService.cancelNotification(record.notification_id);
    }

    await this.repository.updateStatus(reminderId, 'cancelled');
    return true;
  }

  /**
   * Combines YYYY-MM-DD and optional HH:mm:ss into a local Date.
   */
  private parseScheduledDateTime(dateStr: string, timeStr?: string): Date | null {
    const dateParts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateParts) return null;

    const year = parseInt(dateParts[1], 10);
    const month = parseInt(dateParts[2], 10) - 1;
    const day = parseInt(dateParts[3], 10);

    let hours = 9; // Default morning if time is omitted
    let minutes = 0;
    let seconds = 0;

    if (timeStr) {
      const timeParts = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (timeParts) {
        hours = parseInt(timeParts[1], 10);
        minutes = parseInt(timeParts[2], 10);
        seconds = timeParts[3] ? parseInt(timeParts[3], 10) : 0;
      }
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
      return null;
    }

    const resolved = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(resolved.getTime()) ? null : resolved;
  }
}

export const defaultReminderAgent = new ReminderAgent();
