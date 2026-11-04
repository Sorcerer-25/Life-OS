export type ThemeMode = 'light' | 'dark' | 'system';

let currentThemeMode: ThemeMode = 'dark'; // Default matches current LifeOS look
let isInitialized = false;

/**
 * Initializes and reads the persisted theme mode.
 */
export async function loadPersistedThemeMode(): Promise<ThemeMode> {
  if (isInitialized) {
    return currentThemeMode;
  }

  try {
    const SQLite = require('expo-sqlite');
    const db = await SQLite.openDatabaseAsync('lifeos_preferences.db');
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ui_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`
    );
    const row = await db.getFirstAsync(
      `SELECT value FROM ui_preferences WHERE key = ?`,
      ['theme_mode']
    );
    if (row && (row as any).value) {
      const val = (row as any).value as ThemeMode;
      if (val === 'light' || val === 'dark' || val === 'system') {
        currentThemeMode = val;
      }
    }
  } catch {
    // If SQLite fails (e.g. web or stripped test environment), fallback to memory
  }

  isInitialized = true;
  return currentThemeMode;
}

/**
 * Persists the selected theme mode.
 */
export async function persistThemeMode(mode: ThemeMode): Promise<void> {
  currentThemeMode = mode;
  try {
    const SQLite = require('expo-sqlite');
    const db = await SQLite.openDatabaseAsync('lifeos_preferences.db');
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS ui_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`
    );
    await db.runAsync(
      `INSERT OR REPLACE INTO ui_preferences (key, value) VALUES (?, ?)`,
      ['theme_mode', mode]
    );
  } catch {
    // Ignore persistence errors gracefully
  }
}

export function getCurrentThemeMode(): ThemeMode {
  return currentThemeMode;
}
