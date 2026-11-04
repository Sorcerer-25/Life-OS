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
];

export interface NotificationSettings {
  captureEnabled: boolean;
  allowedApps: string[]; // List of package names explicitly allowed by user (default: empty)
  retentionDays: number; // Auto-delete after N days (default: 7)
  offlineParserOnly: boolean; // Never send notification text to external LLM (default: true)
}

let currentSettings: NotificationSettings = {
  captureEnabled: false,
  allowedApps: [], // Spec requirement: default allow-list must be empty
  retentionDays: 7,
  offlineParserOnly: true,
};

export function getNotificationSettings(): NotificationSettings {
  return { ...currentSettings, allowedApps: [...currentSettings.allowedApps] };
}

export function updateNotificationSettings(updates: Partial<NotificationSettings>): NotificationSettings {
  currentSettings = {
    ...currentSettings,
    ...updates,
    allowedApps: updates.allowedApps ? [...updates.allowedApps] : currentSettings.allowedApps,
  };
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
  }
}

export function removeAppFromAllowList(packageName: string): void {
  const lower = packageName.toLowerCase();
  currentSettings.allowedApps = currentSettings.allowedApps.filter((p) => p !== lower);
}

export function resetNotificationSettings(): void {
  currentSettings = {
    captureEnabled: false,
    allowedApps: [],
    retentionDays: 7,
    offlineParserOnly: true,
  };
}

