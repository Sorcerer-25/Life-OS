import { CalendarAgent } from '../calendar/calendarAgent';
import { createNotificationInputEvent } from '../input/inputCapture';
import { defaultIntentService } from '../intent/intentService';
import { ActionPlan } from '../models/ActionPlan';
import { AgentResult } from '../models/AgentResult';
import { InputEvent } from '../models/InputEvent';
import { IntentAnalysis } from '../models/IntentAnalysis';
import {
  NotificationEvent,
  NotificationInboxItem,
  NotificationInboxStatus,
} from '../models/NotificationEvent';
import { SupervisorAgent } from '../supervisor/supervisor';
import {
  getNotificationSettings,
  isAppAllowed,
  isLifeOSPackage,
} from './notificationSettings';
import { sanitizeNotificationText } from './notificationSanitizer';
import { NotificationInboxRepository } from './notificationInboxRepository';

export interface ProcessNotificationResult {
  accepted: boolean;
  reason?: string;
  inboxItem?: NotificationInboxItem;
  isUpdated?: boolean;
}

export class NotificationProcessor {
  private repo: NotificationInboxRepository;
  private supervisor: SupervisorAgent;
  private calendarAgent?: CalendarAgent;
  private dedupWindowMs: number;

  constructor(
    repo?: NotificationInboxRepository,
    dedupWindowMs: number = 15 * 60 * 1000, // 15-minute de-duplication window
    calendarAgent?: CalendarAgent
  ) {
    if (repo) {
      this.repo = repo;
    } else {
      const { SQLiteNotificationInboxRepository } = require('./sqliteNotificationInboxRepository');
      this.repo = new SQLiteNotificationInboxRepository();
    }
    this.supervisor = new SupervisorAgent(0.6);
    this.dedupWindowMs = dedupWindowMs;
    this.calendarAgent = calendarAgent;
  }

  public getRepository(): NotificationInboxRepository {
    return this.repo;
  }

  /**
   * Main entry point for processing a notification (Simulated or Real).
   * Runs the exact same pipeline for both.
   */
  public async processNotification(event: NotificationEvent): Promise<ProcessNotificationResult> {
    // 1. Pre-filter: Drop LifeOS's own notifications to prevent feedback loops with Reminder Agent
    if (isLifeOSPackage(event.source_app)) {
      return { accepted: false, reason: 'lifeos_self_notification_ignored' };
    }

    // 2. Pre-filter: Drop ongoing, media, and group summaries
    if (event.is_ongoing || event.category === 'ongoing' || event.category === 'service' || event.category === 'progress') {
      return { accepted: false, reason: 'ongoing_notification_ignored' };
    }
    if (event.is_media || event.category === 'media' || event.category === 'transport') {
      return { accepted: false, reason: 'media_notification_ignored' };
    }
    if (event.is_group_summary || event.category === 'group_summary') {
      return { accepted: false, reason: 'group_summary_ignored' };
    }

    // 3. Allow-list filter: Drop if source_app is not explicitly in user allow-list
    if (!isAppAllowed(event.source_app)) {
      return { accepted: false, reason: 'app_not_allowed' };
    }

    // 4. Sanitize and mask sensitive text (e.g. long account/card numbers)
    const sanitizedTitle = sanitizeNotificationText(event.title);
    const sanitizedBody = sanitizeNotificationText(event.text);
    const fullNormalizedText = `${sanitizedTitle} ${sanitizedBody}`.toLowerCase().replace(/\s+/g, ' ').trim();

    // 5. Compute stable de-duplication key
    const timeBucket = Math.floor(new Date(event.posted_at).getTime() / this.dedupWindowMs);
    const dedupKey = `${event.source_app}_${event.notification_id}_${timeBucket}`;

    // 6. Check De-duplication against existing inbox
    const existingSameDedup = await this.repo.findByDedupKey(dedupKey);
    if (existingSameDedup) {
      const existingText = `${existingSameDedup.title} ${existingSameDedup.text}`.toLowerCase().replace(/\s+/g, ' ').trim();
      if (existingText === fullNormalizedText) {
        // Exact duplicate notification within window -> Drop
        return { accepted: false, reason: 'duplicate_notification' };
      }
    }

    // Check if this is an updated version of a recent notification from same app & ID
    const recentNotif = await this.repo.findRecentByPackageAndNotifId(
      event.source_app,
      event.notification_id,
      this.dedupWindowMs
    );

    if (recentNotif) {
      // Notification updated by Android
      const updatedItem: NotificationInboxItem = {
        ...recentNotif,
        title: sanitizedTitle,
        text: sanitizedBody,
        posted_at: event.posted_at,
        category: event.category,
        updated_at: new Date().toISOString(),
      };
      await this.repo.update(updatedItem);
      return { accepted: true, isUpdated: true, inboxItem: updatedItem };
    }

    // 7. Store new notification in SQLite Inbox with status 'new'
    const nowIso = new Date().toISOString();
    const itemId = `notif_inbox_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const linkedRequestId = `req_notif_${event.source_app.replace(/[^a-zA-Z0-9]/g, '')}_${event.notification_id}`;

    const inboxItem: NotificationInboxItem = {
      id: itemId,
      notification_id: event.notification_id,
      source_app: event.source_app,
      app_label: event.app_label || event.source_app,
      title: sanitizedTitle,
      text: sanitizedBody,
      posted_at: event.posted_at || nowIso,
      category: event.category,
      status: 'new',
      linked_request_id: linkedRequestId,
      dedup_key: dedupKey,
      analysis: null,
      action_plan: null,
      execution_result: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const saved = await this.repo.save(inboxItem);
    return { accepted: true, inboxItem: saved };
  }

  /**
   * Triggers intent analysis and supervisor planning for an inbox item.
   * NEVER executes actions automatically.
   */
  public async analyzeInboxItem(itemId: string): Promise<NotificationInboxItem | null> {
    const item = await this.repo.findById(itemId);
    if (!item) return null;

    // Convert to canonical InputEvent
    const fullText = `${item.title} ${item.text}`.trim();
    const inputEvent: InputEvent = createNotificationInputEvent({
      rawText: fullText,
      sourceApp: item.source_app,
      notificationId: item.notification_id,
      category: item.category,
      timestamp: item.posted_at,
      requestId: item.linked_request_id,
      metadata: {
        app_label: item.app_label,
      },
    });

    // 1. Stage 1: Deterministic Intent Understanding
    const idResult = await defaultIntentService.identify(inputEvent);

    // 2. Stage 2: Supervisor Orchestration (without execution)
    const plan = this.supervisor.plan(idResult.analysis);

    // Update status to 'analysed'
    const updated: NotificationInboxItem = {
      ...item,
      status: 'analysed',
      analysis: idResult.analysis,
      action_plan: plan,
      updated_at: new Date().toISOString(),
    };

    await this.repo.update(updated);
    return updated;
  }

  /**
   * Approves an analysed notification action plan.
   * Only after explicit approval is any agent dispatched.
   */
  public async approveActionPlan(
    itemId: string,
    editedPlan?: ActionPlan
  ): Promise<{ success: boolean; item: NotificationInboxItem; results?: Record<string, AgentResult> }> {
    const item = await this.repo.findById(itemId);
    if (!item) {
      throw new Error(`Inbox item ${itemId} not found`);
    }

    if (item.status === 'dismissed') {
      throw new Error(`Cannot approve a dismissed notification`);
    }

    const planToExecute = editedPlan || item.action_plan;
    if (!planToExecute) {
      throw new Error(`No action plan available to approve. Please analyze first.`);
    }

    const results: Record<string, AgentResult> = {};
    let overallSuccess = true;

    // Enforce Financial Safety Boundary:
    // If actions target finance_agent, do NOT execute with any mock or uninstalled agent.
    for (const action of planToExecute.actions) {
      if (action.agent === 'finance_agent') {
        // Preserved analysis without phantom execution
        results[action.action_id] = {
          taskId: `task_fin_${Date.now()}`,
          actionId: action.action_id,
          agentName: 'finance_agent',
          status: 'success',
          message: 'Financial intent preserved safely in offline inbox. No finance agent execution performed.',
        };
        continue;
      }

      if (action.agent === 'calendar_agent') {
        const agent = this.calendarAgent || new CalendarAgent();
        try {
          const res = await agent.execute({
            taskId: `task_cal_${Date.now()}`,
            requestId: planToExecute.request_id,
            actionId: action.action_id,
            agentName: 'calendar_agent',
            operation: action.operation,
            data: action.data as Record<string, unknown>,
          });
          results[action.action_id] = res;
          if (res.status === 'failure') {
            overallSuccess = false;
          }
        } catch (err: any) {
          overallSuccess = false;
          results[action.action_id] = {
            taskId: `task_err_${Date.now()}`,
            actionId: action.action_id,
            agentName: 'calendar_agent',
            status: 'failure',
            message: err?.message || 'Calendar execution failed',
            error: err?.message,
          };
        }
        continue;
      }

      // Other agents (e.g. reminder / task)
      results[action.action_id] = {
        taskId: `task_${action.agent}_${Date.now()}`,
        actionId: action.action_id,
        agentName: action.agent,
        status: 'success',
        message: `Action plan approved for ${action.agent} (${action.operation}).`,
      };
    }

    const newStatus: NotificationInboxStatus = overallSuccess ? 'actioned' : 'failed';
    const updated: NotificationInboxItem = {
      ...item,
      status: newStatus,
      action_plan: planToExecute,
      execution_result: results as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    };

    await this.repo.update(updated);
    return { success: overallSuccess, item: updated, results };
  }

  /**
   * Dismisses a notification item so it will never be executed.
   */
  public async dismissNotification(itemId: string): Promise<NotificationInboxItem | null> {
    const item = await this.repo.findById(itemId);
    if (!item) return null;

    const updated: NotificationInboxItem = {
      ...item,
      status: 'dismissed',
      updated_at: new Date().toISOString(),
    };

    await this.repo.update(updated);
    return updated;
  }
}

