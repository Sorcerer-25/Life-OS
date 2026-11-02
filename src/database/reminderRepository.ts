import { getDatabase, DatabaseAdapter } from './database';

export type ReminderStatus = 'pending' | 'scheduled' | 'cancelled' | 'failed';

export interface ReminderRecord {
  id: string;
  action_id: string;
  title: string;
  scheduled_at: string;
  notification_id: string | null;
  status: ReminderStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateReminderParams {
  id?: string;
  action_id: string;
  title: string;
  scheduled_at: string;
  notification_id?: string | null;
  status?: ReminderStatus;
}

export class ReminderRepository {
  private customDb?: DatabaseAdapter;

  constructor(customDb?: DatabaseAdapter) {
    this.customDb = customDb;
  }

  private async db(): Promise<DatabaseAdapter> {
    if (this.customDb) return this.customDb;
    return getDatabase();
  }

  public async create(params: CreateReminderParams): Promise<ReminderRecord> {
    const db = await this.db();
    const id = params.id || `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const status = params.status || 'pending';
    const now = new Date().toISOString();
    const notificationId = params.notification_id || null;

    await db.runAsync(
      `INSERT INTO reminders (id, action_id, title, scheduled_at, notification_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.action_id,
        params.title,
        params.scheduled_at,
        notificationId,
        status,
        now,
        now,
      ]
    );

    return {
      id,
      action_id: params.action_id,
      title: params.title,
      scheduled_at: params.scheduled_at,
      notification_id: notificationId,
      status,
      created_at: now,
      updated_at: now,
    };
  }

  public async findByActionId(actionId: string): Promise<ReminderRecord | null> {
    const db = await this.db();
    return db.getFirstAsync<ReminderRecord>(
      'SELECT * FROM reminders WHERE action_id = ?',
      [actionId]
    );
  }

  public async findById(id: string): Promise<ReminderRecord | null> {
    const db = await this.db();
    return db.getFirstAsync<ReminderRecord>(
      'SELECT * FROM reminders WHERE id = ?',
      [id]
    );
  }

  public async updateStatus(
    id: string,
    status: ReminderStatus,
    notificationId?: string | null
  ): Promise<void> {
    const db = await this.db();
    const now = new Date().toISOString();

    if (notificationId !== undefined) {
      await db.runAsync(
        'UPDATE reminders SET status = ?, notification_id = ?, updated_at = ? WHERE id = ?',
        [status, notificationId, now, id]
      );
    } else {
      await db.runAsync(
        'UPDATE reminders SET status = ?, updated_at = ? WHERE id = ?',
        [status, now, id]
      );
    }
  }

  public async getAllScheduled(): Promise<ReminderRecord[]> {
    const db = await this.db();
    return db.getAllAsync<ReminderRecord>(
      "SELECT * FROM reminders WHERE status = 'scheduled' ORDER BY scheduled_at ASC"
    );
  }

  public async getAll(): Promise<ReminderRecord[]> {
    const db = await this.db();
    return db.getAllAsync<ReminderRecord>(
      'SELECT * FROM reminders ORDER BY created_at DESC'
    );
  }

  public async delete(id: string): Promise<void> {
    const db = await this.db();
    await db.runAsync('DELETE FROM reminders WHERE id = ?', [id]);
  }
}

export const defaultReminderRepository = new ReminderRepository();

