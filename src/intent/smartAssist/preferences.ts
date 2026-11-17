import { openDatabaseAsync } from 'expo-sqlite';
import { AssistSettings, DEFAULT_ASSIST_SETTINGS } from './config';

/** Existing ui_preferences table; no new tables or columns. Never accepts a key. */
export const assistPreferences = {
  async load(): Promise<AssistSettings> {
    try {
      const db = await openDatabaseAsync('lifeos_preferences.db');
      const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM ui_preferences WHERE key = ?', ['smart_assist']);
      const v = JSON.parse(row?.value ?? '{}');
      return { master: v.master === true, decisions: v.decisions === true, extraction: v.extraction === true };
    } catch { return { ...DEFAULT_ASSIST_SETTINGS }; }
  },
  async save(settings: AssistSettings): Promise<void> {
    const db = await openDatabaseAsync('lifeos_preferences.db');
    await db.runAsync('INSERT OR REPLACE INTO ui_preferences (key, value) VALUES (?, ?)', [
      'smart_assist', JSON.stringify({ master: settings.master, decisions: settings.decisions, extraction: settings.extraction }),
    ]);
  },
};
