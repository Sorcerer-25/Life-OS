import { ReminderAgent } from '../../src/agents/reminderAgent';
import { AgentDispatcher, AgentRegistry } from '../../src/agents/agentRegistry';
import { NotificationClient, NotificationService } from '../../src/notifications/notificationService';
import { ReminderRepository, ReminderRecord } from '../../src/database/reminderRepository';
import { DatabaseAdapter } from '../../src/database/database';
import { AgentTask } from '../../src/models/AgentTask';
import { ActionPlan } from '../../src/models/ActionPlan';

/**
 * In-Memory SQLite adapter for deterministic Node/Jest testing.
 */
class MockDatabaseAdapter implements DatabaseAdapter {
  public reminders: Map<string, ReminderRecord> = new Map();
  public migrations: Set<string> = new Set();

  async execAsync(source: string): Promise<void> {
    // schema creation no-op
  }

  async runAsync(source: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
    const flatParams = params.flat();

    if (source.includes('INSERT INTO _migrations')) {
      this.migrations.add(flatParams[0]);
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (source.includes('INSERT INTO reminders')) {
      const [id, action_id, title, scheduled_at, notification_id, status, created_at, updated_at] = flatParams;
      this.reminders.set(id, {
        id,
        action_id,
        title,
        scheduled_at,
        notification_id,
        status,
        created_at,
        updated_at,
      });
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (source.includes('UPDATE reminders SET status = ?, notification_id = ?')) {
      const [status, notificationId, now, id] = flatParams;
      const rec = this.reminders.get(id);
      if (rec) {
        rec.status = status;
        rec.notification_id = notificationId;
        rec.updated_at = now;
      }
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (source.includes('UPDATE reminders SET status = ?, updated_at = ?')) {
      const [status, now, id] = flatParams;
      const rec = this.reminders.get(id);
      if (rec) {
        rec.status = status;
        rec.updated_at = now;
      }
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (source.includes('DELETE FROM reminders WHERE id = ?')) {
      const [id] = flatParams;
      this.reminders.delete(id);
      return { lastInsertRowId: 1, changes: 1 };
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  async getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null> {
    const flatParams = params.flat();

    if (source.includes('SELECT id FROM _migrations WHERE name = ?')) {
      return this.migrations.has(flatParams[0]) ? ({ id: 1 } as unknown as T) : null;
    }

    if (source.includes('SELECT * FROM reminders WHERE action_id = ?')) {
      const actionId = flatParams[0];
      for (const rec of this.reminders.values()) {
        if (rec.action_id === actionId) {
          return { ...rec } as unknown as T;
        }
      }
      return null;
    }

    if (source.includes('SELECT * FROM reminders WHERE id = ?')) {
      const id = flatParams[0];
      const rec = this.reminders.get(id);
      return rec ? ({ ...rec } as unknown as T) : null;
    }

    return null;
  }

  async getAllAsync<T>(source: string): Promise<T[]> {
    if (source.includes('status = \'scheduled\'')) {
      const scheduled = Array.from(this.reminders.values()).filter((r) => r.status === 'scheduled');
      return scheduled as unknown as T[];
    }
    return Array.from(this.reminders.values()) as unknown as T[];
  }
}

/**
 * Mock Notification Client for deterministic testing.
 */
class MockNotificationClient implements NotificationClient {
  public permissionsGranted = true;
  public scheduledList: Array<{ id: string; title: string; body: string; date: Date; data: any }> = [];
  public cancelledList: string[] = [];
  public channelConfigured = false;
  public handlerConfigured = false;

  configureHandler(): void {
    this.handlerConfigured = true;
  }

  async configureChannel(): Promise<void> {
    this.channelConfigured = true;
  }

  async getPermissions(): Promise<boolean> {
    return this.permissionsGranted;
  }

  async requestPermissions(): Promise<boolean> {
    return this.permissionsGranted;
  }

  async schedule(title: string, body: string, date: Date, data: any): Promise<string> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.scheduledList.push({ id, title, body, date, data });
    return id;
  }

  async cancel(notificationId: string): Promise<void> {
    this.cancelledList.push(notificationId);
    this.scheduledList = this.scheduledList.filter((n) => n.id !== notificationId);
  }

  async getAllScheduled(): Promise<Array<{ id: string; title?: string }>> {
    return this.scheduledList.map((n) => ({ id: n.id, title: n.title }));
  }
}

describe('ReminderAgent & Local Notification System', () => {
  const baseDate = new Date('2026-11-02T00:00:00.000Z');
  let mockDb: MockDatabaseAdapter;
  let mockNotif: MockNotificationClient;
  let notifService: NotificationService;
  let repo: ReminderRepository;
  let agent: ReminderAgent;
  let dispatcher: AgentDispatcher;

  beforeEach(() => {
    mockDb = new MockDatabaseAdapter();
    mockNotif = new MockNotificationClient();
    notifService = new NotificationService(mockNotif);
    repo = new ReminderRepository(mockDb);
    agent = new ReminderAgent({
      notificationService: notifService,
      repository: repo,
      baseDate,
    });

    const registry = new AgentRegistry();
    registry.register(agent);
    dispatcher = new AgentDispatcher(registry);
  });

  test('1. Schedules a reminder successfully for a future date/time', async () => {
    const task: AgentTask = {
      taskId: 'task_001',
      requestId: 'req_001',
      actionId: 'req_001_1_create_reminder',
      agentName: 'reminder_agent',
      operation: 'create_reminder',
      data: {
        operation: 'create_reminder',
        title: 'Submit assignment',
        due_date: '2026-11-02',
        time: '14:00:00',
      },
    };

    const result = await agent.execute(task);

    expect(result.status).toBe('success');
    expect(result.output?.notificationId).toBeDefined();
    expect(mockNotif.scheduledList).toHaveLength(1);
    expect(mockNotif.scheduledList[0].title).toBe('Submit assignment');

    // Verify persisted in SQLite
    const scheduled = await repo.getAllScheduled();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].title).toBe('Submit assignment');
    expect(scheduled[0].status).toBe('scheduled');
  });

  test('2. Enforces idempotency: submitting same action twice prevents duplicate notification', async () => {
    const task: AgentTask = {
      taskId: 'task_002',
      requestId: 'req_002',
      actionId: 'req_002_1_create_reminder',
      agentName: 'reminder_agent',
      operation: 'create_reminder',
      data: {
        operation: 'create_reminder',
        title: 'Pay Wi-Fi bill',
        due_date: '2026-11-02',
        time: '18:00:00',
      },
    };

    // First attempt -> Success
    const firstResult = await agent.execute(task);
    expect(firstResult.status).toBe('success');
    expect(mockNotif.scheduledList).toHaveLength(1);

    // Second attempt -> Duplicate prevented
    const secondResult = await agent.execute(task);
    expect(secondResult.status).toBe('duplicate');
    expect(secondResult.message).toContain('already been scheduled');
    expect(mockNotif.scheduledList).toHaveLength(1); // Still exactly 1!
  });

  test('3. Denies scheduling when notification permission is rejected without false success', async () => {
    mockNotif.permissionsGranted = false;

    const task: AgentTask = {
      taskId: 'task_003',
      requestId: 'req_003',
      actionId: 'req_003_1_create_reminder',
      agentName: 'reminder_agent',
      operation: 'create_reminder',
      data: {
        operation: 'create_reminder',
        title: 'Call doctor',
        due_date: '2026-11-02',
        time: '15:00:00',
      },
    };

    const result = await agent.execute(task);

    expect(result.status).toBe('failure');
    expect(result.message).toContain('permission denied');
    expect(mockNotif.scheduledList).toHaveLength(0);

    // Verify DB does not show as scheduled
    const scheduled = await repo.getAllScheduled();
    expect(scheduled).toHaveLength(0);
  });

  test('4. Rejects past dates without altering the date', async () => {
    const task: AgentTask = {
      taskId: 'task_004',
      requestId: 'req_004',
      actionId: 'req_004_1_create_reminder',
      agentName: 'reminder_agent',
      operation: 'create_reminder',
      data: {
        operation: 'create_reminder',
        title: 'Old meeting',
        due_date: '2026-11-01', // Yesterday relative to baseDate 2026-11-02T10:00
        time: '09:00:00',
      },
    };

    const result = await agent.execute(task);

    expect(result.status).toBe('failure');
    expect(result.error).toBe('PAST_DATE_ERROR');
    expect(result.message).toContain('Cannot schedule reminder in the past');
    expect(mockNotif.scheduledList).toHaveLength(0);
  });

  test('5. Rejects incomplete reminders with clarification', async () => {
    // Missing title
    const taskNoTitle: AgentTask = {
      taskId: 'task_005a',
      requestId: 'req_005a',
      actionId: 'req_005a_1',
      agentName: 'reminder_agent',
      operation: 'create_reminder',
      data: {
        operation: 'create_reminder',
        due_date: '2026-11-02',
      },
    };
    const resA = await agent.execute(taskNoTitle);
    expect(resA.status).toBe('needs_clarification');

    // Missing due date
    const taskNoDate: AgentTask = {
      taskId: 'task_005b',
      requestId: 'req_005b',
      actionId: 'req_005b_1',
      agentName: 'reminder_agent',
      operation: 'create_reminder',
      data: {
        operation: 'create_reminder',
        title: 'Buy groceries',
      },
    };
    const resB = await agent.execute(taskNoDate);
    expect(resB.status).toBe('needs_clarification');
  });

  test('6. Isolation: Non-reminder actions are NEVER dispatched to ReminderAgent', async () => {
    const plan: ActionPlan = {
      request_id: 'req_006',
      source: { type: 'text', raw_input: 'Add task to clean desk', timestamp: baseDate.toISOString() },
      intents: [],
      required_agents: ['task_agent'],
      actions: [
        {
          action_id: 'req_006_1_create_task',
          sequence: 1,
          agent: 'task_agent',
          operation: 'create_task',
          data: { operation: 'create_task', title: 'clean desk' },
          depends_on: [],
          requires_confirmation: false,
          status: 'ready',
        },
      ],
      decision: {
        workflow_status: 'ready',
        reasons: ['Valid task'],
        clarification_needed: false,
        clarification_questions: [],
        unsupported_explanations: [],
      },
      execution_mode: 'pending',
    };

    const results = await dispatcher.dispatch(plan);

    expect(results).toHaveLength(1);
    expect(results[0].agentName).toBe('task_agent');
    expect(results[0].status).toBe('failure');
    expect(results[0].message).toContain('not yet implemented');
    expect(mockNotif.scheduledList).toHaveLength(0); // ReminderAgent never called!
  });

  test('7. Cancels an existing scheduled reminder and system notification', async () => {
    // Schedule first
    const task: AgentTask = {
      taskId: 'task_007',
      requestId: 'req_007',
      actionId: 'req_007_1_create_reminder',
      agentName: 'reminder_agent',
      operation: 'create_reminder',
      data: {
        operation: 'create_reminder',
        title: 'Doctor appointment',
        due_date: '2026-11-03',
        time: '10:00:00',
      },
    };

    const scheduleRes = await agent.execute(task);
    expect(scheduleRes.status).toBe('success');
    const reminderId = scheduleRes.output?.reminderId as string;
    const notificationId = scheduleRes.output?.notificationId as string;

    expect(mockNotif.scheduledList).toHaveLength(1);

    // Cancel
    const cancelOk = await agent.cancel(reminderId);
    expect(cancelOk).toBe(true);

    // Verify cancelled in mock notification client
    expect(mockNotif.cancelledList).toContain(notificationId);
    expect(mockNotif.scheduledList).toHaveLength(0);

    // Verify cancelled in SQLite DB
    const rec = await repo.findById(reminderId);
    expect(rec?.status).toBe('cancelled');
    const scheduledRemaining = await repo.getAllScheduled();
    expect(scheduledRemaining).toHaveLength(0);
  });

  test('8. Preserves scheduled reminders across database sessions (restart simulation)', async () => {
    // 1. First session: schedule reminder
    const task: AgentTask = {
      taskId: 'task_008',
      requestId: 'req_008',
      actionId: 'req_008_1_create_reminder',
      agentName: 'reminder_agent',
      operation: 'create_reminder',
      data: {
        operation: 'create_reminder',
        title: 'Car maintenance',
        due_date: '2026-11-05',
        time: '11:00:00',
      },
    };
    await agent.execute(task);

    // 2. Simulate app restart: create a new Repository pointing to same database
    const restartedRepo = new ReminderRepository(mockDb);
    const loadedReminders = await restartedRepo.getAllScheduled();

    expect(loadedReminders).toHaveLength(1);
    expect(loadedReminders[0].title).toBe('Car maintenance');
    expect(loadedReminders[0].status).toBe('scheduled');
  });

  test('9. Handles user input with dot in time and "remainder": "add remainder named assignment for 12.54 pm today"', async () => {
    const { extractTime } = require('../../src/intent/extraction/timeExtractor');
    const { detectReminderIntent } = require('../../src/intent/detectors/reminderDetector');

    const raw = 'add remainder named assignment for 12.54 pm today';
    const extractedTime = extractTime(raw, baseDate);
    expect(extractedTime).not.toBeNull();
    expect(extractedTime.timeStr).toBe('12:54:00');

    const detected = detectReminderIntent(raw, 1, baseDate);
    expect(detected).not.toBeNull();
    expect(detected.intent).toBe('set_reminder');
    expect(detected.entities.title).toBe('assignment');
    expect(detected.entities.start_time).toBe('12:54:00');
    expect(detected.entities.due_date).toBe('2026-11-02');
  });
});
