import * as SQLite from 'expo-sqlite';
import { CalendarMappingRecord, CalendarMappingRepository } from './mappingRepository';

export class SQLiteMappingRepository implements CalendarMappingRepository {
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
          CREATE TABLE IF NOT EXISTS calendar_event_mappings (
            action_id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL,
            android_event_id TEXT,
            calendar_id TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_error TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_android_event_id ON calendar_event_mappings(android_event_id);
          CREATE INDEX IF NOT EXISTS idx_calendar_status ON calendar_event_mappings(status);
        `);
        return db;
      })();
    }
    return this.dbPromise;
  }

  public async init(): Promise<void> {
    await this.getDb();
  }

  public async findByActionId(actionId: string): Promise<CalendarMappingRecord | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<CalendarMappingRecord>(
      'SELECT * FROM calendar_event_mappings WHERE action_id = ?',
      [actionId]
    );
    return row || null;
  }

  public async findByAndroidEventId(androidEventId: string): Promise<CalendarMappingRecord | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<CalendarMappingRecord>(
      'SELECT * FROM calendar_event_mappings WHERE android_event_id = ?',
      [androidEventId]
    );
    return row || null;
  }

  public async listAll(): Promise<CalendarMappingRecord[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<CalendarMappingRecord>(
      'SELECT * FROM calendar_event_mappings ORDER BY created_at DESC'
    );
    return rows;
  }

  public async createPending(
    actionId: string,
    requestId: string,
    calendarId: string
  ): Promise<CalendarMappingRecord> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const record: CalendarMappingRecord = {
      action_id: actionId,
      request_id: requestId,
      android_event_id: null,
      calendar_id: calendarId,
      status: 'pending',
      created_at: now,
      updated_at: now,
      last_error: null,
    };

    await db.runAsync(
      `INSERT OR REPLACE INTO calendar_event_mappings 
       (action_id, request_id, android_event_id, calendar_id, status, created_at, updated_at, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.action_id,
        record.request_id,
        record.android_event_id,
        record.calendar_id,
        record.status,
        record.created_at,
        record.updated_at,
        record.last_error,
      ]
    );

    return record;
  }

  public async markCreated(actionId: string, androidEventId: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE calendar_event_mappings 
       SET android_event_id = ?, status = 'created', updated_at = ?, last_error = NULL 
       WHERE action_id = ?`,
      [androidEventId, now, actionId]
    );
  }

  public async markUpdated(actionId: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE calendar_event_mappings 
       SET status = 'updated', updated_at = ? 
       WHERE action_id = ?`,
      [now, actionId]
    );
  }

  public async markDeleted(actionId: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE calendar_event_mappings 
       SET status = 'deleted', updated_at = ? 
       WHERE action_id = ?`,
      [now, actionId]
    );
  }

  public async markFailed(actionId: string, error: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE calendar_event_mappings 
       SET status = 'failed', last_error = ?, updated_at = ? 
       WHERE action_id = ?`,
      [error, now, actionId]
    );
  }

  public async deleteByActionId(actionId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM calendar_event_mappings WHERE action_id = ?', [actionId]);
  }
}

