export interface KnownAppDefinition {
  packageName: string;
  label: string;
  category: 'calendar' | 'messaging' | 'finance' | 'work' | 'system';
}

export const KNOWN_APPS: KnownAppDefinition[] = [
  { packageName: 'com.google.android.calendar', label: 'Google Calendar', category: 'calendar' },
  { packageName: 'com.whatsapp', label: 'WhatsApp', category: 'messaging' },
  { packageName: 'com.google.android.apps.messaging', label: 'Google Messages (SMS)', category: 'messaging' },
  { packageName: 'com.phonepe.app', label: 'PhonePe', category: 'finance' },
  { packageName: 'com.google.android.apps.nbu.paisa.user', label: 'Google Pay', category: 'finance' },
  { packageName: 'net.one97.paytm', label: 'Paytm', category: 'finance' },
  { packageName: 'com.axis.mobile', label: 'Axis Mobile', category: 'finance' },
  { packageName: 'com.hdfcbank.payzapp', label: 'HDFC PayZapp', category: 'finance' },
  { packageName: 'com.slack', label: 'Slack', category: 'work' },
];

export const LIFEOS_PACKAGE_NAMES = [
  'com.lifeos',
  'lifeos',
  'lifeos-temp',
  'host.exp.exponent',
  'com.anonymous.lifeostemp',
];

export interface NotificationSettings {
  captureEnabled: boolean;
  allowedApps: string[]; // List of package names explicitly allowed by user (default: empty)
  retentionDays: number; // Auto-delete after N days (default: 7)
  offlineParserOnly: boolean; // Never send notification text to external LLM (default: true)
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  captureEnabled: false,
  allowedApps: [], // Spec requirement: default allow-list must be empty
  retentionDays: 7,
  offlineParserOnly: true,
};

let currentSettings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };
let isLoaded = false;

/**
 * Persists current notification settings to SQLite database.
 */
export async function persistNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    const SQLite = require('expo-sqlite');
    const db = await SQLite.openDatabaseAsync('lifeos.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id TEXT PRIMARY KEY,
        capture_enabled INTEGER NOT NULL,
        allowed_apps TEXT NOT NULL,
        retention_days INTEGER NOT NULL,
        offline_parser_only INTEGER NOT NULL
      );
    `);
    await db.runAsync(
      `INSERT OR REPLACE INTO notification_settings (id, capture_enabled, allowed_apps, retention_days, offline_parser_only)
       VALUES ('default', ?, ?, ?, ?)`,
      [
        settings.captureEnabled ? 1 : 0,
        JSON.stringify(settings.allowedApps),
        settings.retentionDays,
        settings.offlineParserOnly ? 1 : 0,
      ]
    );
  } catch (err) {
    // If SQLite fails (e.g. web or stripped test environment), fallback to in-memory
  }
}

/**
 * Loads persisted notification settings on app launch.
 * If SQLite has no record yet, attempts to recover any existing native Android SharedPreferences settings.
 */
export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const SQLite = require('expo-sqlite');
    const db = await SQLite.openDatabaseAsync('lifeos.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id TEXT PRIMARY KEY,
        capture_enabled INTEGER NOT NULL,
        allowed_apps TEXT NOT NULL,
        retention_days INTEGER NOT NULL,
        offline_parser_only INTEGER NOT NULL
      );
    `);
    const row = await db.getFirstAsync(
      `SELECT capture_enabled, allowed_apps, retention_days, offline_parser_only FROM notification_settings WHERE id = 'default'`
    );
    if (row && typeof (row as any).capture_enabled !== 'undefined') {
      let allowed: string[] = [];
      try {
        allowed = JSON.parse((row as any).allowed_apps || '[]');
      } catch {
        allowed = [];
      }
      currentSettings = {
        captureEnabled: Boolean((row as any).capture_enabled),
        allowedApps: Array.isArray(allowed) ? allowed : [],
        retentionDays: Number((row as any).retention_days) || 7,
        offlineParserOnly: Boolean((row as any).offline_parser_only),
      };
      isLoaded = true;
      return getNotificationSettings();
    }
  } catch (err) {
    // SQLite lookup error or environment without SQLite
  }

  // Fallback: Check if native Android SharedPreferences already has settings configured
  try {
    const { getSettingsFromNative } = require('./nativeNotificationListener');
    const nativeSettings = await getSettingsFromNative();
    if (nativeSettings && (nativeSettings.captureEnabled || nativeSettings.allowedApps.length > 0)) {
      currentSettings = {
        ...currentSettings,
        captureEnabled: nativeSettings.captureEnabled,
        allowedApps: nativeSettings.allowedApps,
      };
      await persistNotificationSettings(currentSettings);
      isLoaded = true;
      return getNotificationSettings();
    }
  } catch {
    // Native module unavailable or error
  }

  isLoaded = true;
  return getNotificationSettings();
}

export function getNotificationSettings(): NotificationSettings {
  return { ...currentSettings, allowedApps: [...currentSettings.allowedApps] };
}

export function updateNotificationSettings(updates: Partial<NotificationSettings>): NotificationSettings {
  currentSettings = {
    ...currentSettings,
    ...updates,
    allowedApps: updates.allowedApps ? [...updates.allowedApps] : currentSettings.allowedApps,
  };
  persistNotificationSettings(currentSettings).catch(() => {});
  return getNotificationSettings();
}

export function isAppAllowed(packageName: string): boolean {
  if (!packageName) return false;
  // LifeOS packages are NEVER allowed (prevents feedback loops)
  if (isLifeOSPackage(packageName)) return false;
  return currentSettings.allowedApps.includes(packageName.toLowerCase());
}

export function isLifeOSPackage(packageName: string): boolean {
  if (!packageName) return false;
  return LIFEOS_PACKAGE_NAMES.includes(packageName.toLowerCase());
}

export function addAppToAllowList(packageName: string): void {
  const lower = packageName.toLowerCase();
  if (isLifeOSPackage(lower)) return;
  if (!currentSettings.allowedApps.includes(lower)) {
    currentSettings.allowedApps.push(lower);
    persistNotificationSettings(currentSettings).catch(() => {});
  }
}

export function removeAppFromAllowList(packageName: string): void {
  const lower = packageName.toLowerCase();
  currentSettings.allowedApps = currentSettings.allowedApps.filter((p) => p !== lower);
  persistNotificationSettings(currentSettings).catch(() => {});
}

export function resetNotificationSettings(): void {
  currentSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    allowedApps: [],
  };
  persistNotificationSettings(currentSettings).catch(() => {});
}
