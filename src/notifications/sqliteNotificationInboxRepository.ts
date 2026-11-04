import * as SQLite from 'expo-sqlite';
import { ActionPlan } from '../models/ActionPlan';
import { IntentAnalysis } from '../models/IntentAnalysis';
import { NotificationInboxItem, NotificationInboxStatus } from '../models/NotificationEvent';
import { NotificationInboxRepository } from './notificationInboxRepository';

interface SQLiteNotificationRow {
  id: string;
  notification_id: string;
  source_app: string;
  app_label: string;
  title: string;
  text: string;
  posted_at: string;
  category: string | null;
  status: string;
  linked_request_id: string;
  dedup_key: string;
  raw_analysis: string | null;
  raw_plan: string | null;
  execution_result: string | null;
  created_at: string;
  updated_at: string;
  last_error: string | null;
}

export class SQLiteNotificationInboxRepository implements NotificationInboxRepository {
  private dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private dbName: string;

  constructor(dbName: string = 'lifeos.db') {
    this.dbName = dbName;
  }

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const db = await SQLite.openDatabaseAsync(this.dbName);
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS notification_inbox (
            id TEXT PRIMARY KEY,
            notification_id TEXT NOT NULL,
            source_app TEXT NOT NULL,
            app_label TEXT NOT NULL,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            posted_at TEXT NOT NULL,
            category TEXT,
            status TEXT NOT NULL,
            linked_request_id TEXT NOT NULL,
            dedup_key TEXT NOT NULL,
            raw_analysis TEXT,
            raw_plan TEXT,
            execution_result TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_error TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_notif_dedup ON notification_inbox(dedup_key);
          CREATE INDEX IF NOT EXISTS idx_notif_status ON notification_inbox(status);
          CREATE INDEX IF NOT EXISTS idx_notif_posted_at ON notification_inbox(posted_at);
        `);
        return db;
      })();
    }
    return this.dbPromise;
  }

  public async init(): Promise<void> {
    await this.getDb();
  }

  private mapRowToItem(row: SQLiteNotificationRow): NotificationInboxItem {
    let analysis: IntentAnalysis | null = null;
    let action_plan: ActionPlan | null = null;
    let execution_result: Record<string, unknown> | null = null;

    if (row.raw_analysis) {
      try {
        analysis = JSON.parse(row.raw_analysis);
      } catch {
        // ignore malformed JSON
      }
    }

    if (row.raw_plan) {
      try {
        action_plan = JSON.parse(row.raw_plan);
      } catch {
        // ignore malformed JSON
      }
    }

    if (row.execution_result) {
      try {
        execution_result = JSON.parse(row.execution_result);
      } catch {
        // ignore malformed JSON
      }
    }

    return {
      id: row.id,
      notification_id: row.notification_id,
      source_app: row.source_app,
      app_label: row.app_label,
      title: row.title,
      text: row.text,
      posted_at: row.posted_at,
      category: row.category || undefined,
      status: row.status as NotificationInboxStatus,
      linked_request_id: row.linked_request_id,
      dedup_key: row.dedup_key,
      analysis,
      action_plan,
      execution_result,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_error: row.last_error || undefined,
    };
  }

  public async save(item: NotificationInboxItem): Promise<NotificationInboxItem> {
    const db = await this.getDb();
    const rawAnalysis = item.analysis ? JSON.stringify(item.analysis) : null;
    const rawPlan = item.action_plan ? JSON.stringify(item.action_plan) : null;
    const execResult = item.execution_result ? JSON.stringify(item.execution_result) : null;

    await db.runAsync(
      `INSERT OR REPLACE INTO notification_inbox (
        id, notification_id, source_app, app_label, title, text, posted_at, category,
        status, linked_request_id, dedup_key, raw_analysis, raw_plan, execution_result,
        created_at, updated_at, last_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.notification_id,
        item.source_app,
        item.app_label,
        item.title,
        item.text,
        item.posted_at,
        item.category || null,
        item.status,
        item.linked_request_id,
        item.dedup_key,
        rawAnalysis,
        rawPlan,
        execResult,
        item.created_at,
        item.updated_at,
        item.last_error || null,
      ]
    );

    return item;
  }

  public async findById(id: string): Promise<NotificationInboxItem | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<SQLiteNotificationRow>(
      'SELECT * FROM notification_inbox WHERE id = ?',
      [id]
    );
    return row ? this.mapRowToItem(row) : null;
  }

  public async findByDedupKey(dedupKey: string): Promise<NotificationInboxItem | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<SQLiteNotificationRow>(
      'SELECT * FROM notification_inbox WHERE dedup_key = ?',
      [dedupKey]
    );
    return row ? this.mapRowToItem(row) : null;
  }

  public async findRecentByPackageAndNotifId(
    sourceApp: string,
    notificationId: string,
    timeWindowMs: number
  ): Promise<NotificationInboxItem | null> {
    const db = await this.getDb();
    const cutoff = new Date(Date.now() - timeWindowMs).toISOString();
    const row = await db.getFirstAsync<SQLiteNotificationRow>(
      `SELECT * FROM notification_inbox 
       WHERE source_app = ? AND notification_id = ? AND posted_at >= ?
       ORDER BY posted_at DESC LIMIT 1`,
      [sourceApp, notificationId, cutoff]
    );
    return row ? this.mapRowToItem(row) : null;
  }

  public async listAll(statusFilter?: NotificationInboxStatus): Promise<NotificationInboxItem[]> {
    const db = await this.getDb();
    let query = 'SELECT * FROM notification_inbox';
    const params: string[] = [];

    if (statusFilter) {
      query += ' WHERE status = ?';
      params.push(statusFilter);
    }
    query += ' ORDER BY posted_at DESC';

    const rows = await db.getAllAsync<SQLiteNotificationRow>(query, params);
    return rows.map((r) => this.mapRowToItem(r));
  }

  public async update(item: NotificationInboxItem): Promise<void> {
    const db = await this.getDb();
    const rawAnalysis = item.analysis ? JSON.stringify(item.analysis) : null;
    const rawPlan = item.action_plan ? JSON.stringify(item.action_plan) : null;
    const execResult = item.execution_result ? JSON.stringify(item.execution_result) : null;
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE notification_inbox SET
        title = ?, text = ?, status = ?, raw_analysis = ?, raw_plan = ?,
        execution_result = ?, updated_at = ?, last_error = ?
       WHERE id = ?`,
      [
        item.title,
        item.text,
        item.status,
        rawAnalysis,
        rawPlan,
        execResult,
        now,
        item.last_error || null,
        item.id,
      ]
    );
  }

  public async updateStatus(
    id: string,
    status: NotificationInboxStatus,
    updates?: Partial<NotificationInboxItem>
  ): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) return;

    const merged: NotificationInboxItem = {
      ...existing,
      ...updates,
      status,
      updated_at: new Date().toISOString(),
    };
    await this.update(merged);
  }

  public async cleanupOld(retentionDays: number): Promise<number> {
    const db = await this.getDb();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const res = await db.runAsync(
      'DELETE FROM notification_inbox WHERE posted_at < ?',
      [cutoff]
    );
    return res.changes || 0;
  }

  public async clearAll(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM notification_inbox');
  }

  public async delete(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM notification_inbox WHERE id = ?', [id]);
  }
}

