import type * as SQLiteType from 'expo-sqlite';

export interface DatabaseAdapter {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(source: string, ...params: any[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: any[]): Promise<T[]>;
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private dbPromise: Promise<DatabaseAdapter> | null = null;
  private customAdapter: DatabaseAdapter | null = null;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Allows setting a custom adapter (e.g. In-Memory mock for unit tests in Node environment).
   */
  public setAdapter(adapter: DatabaseAdapter | null): void {
    this.customAdapter = adapter;
    this.dbPromise = null;
  }

  public async getDatabase(): Promise<DatabaseAdapter> {
    if (this.customAdapter) {
      return this.customAdapter;
    }

    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const SQLite = require('expo-sqlite') as typeof SQLiteType;
        const db = await SQLite.openDatabaseAsync('lifeos.db');
        await this.runMigrations(db);
        return db;
      })();
    }

    return this.dbPromise;
  }

  public async runMigrations(db: DatabaseAdapter): Promise<void> {
    // 1. Create migrations tracking table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at TEXT NOT NULL
      );
    `);

    // 2. Migration 001: Initial reminders table
    const migration001 = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM _migrations WHERE name = ?',
      ['001_create_reminders_table']
    );

    if (!migration001) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY NOT NULL,
          action_id TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          scheduled_at TEXT NOT NULL,
          notification_id TEXT,
          status TEXT NOT NULL CHECK(status IN ('pending', 'scheduled', 'cancelled', 'failed')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reminders_action_id ON reminders (action_id);
        CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders (status);
      `);

      await db.runAsync(
        'INSERT INTO _migrations (name, executed_at) VALUES (?, ?)',
        ['001_create_reminders_table', new Date().toISOString()]
      );
    }
  }
}

export const getDatabase = async (): Promise<DatabaseAdapter> => {
  return DatabaseManager.getInstance().getDatabase();
};
