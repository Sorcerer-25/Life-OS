import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { NotificationEvent } from '../models/NotificationEvent';
import { NotificationProcessor } from './notificationProcessor';
import { getNotificationSettings } from './notificationSettings';

export interface RawNativeNotification {
  notification_id: string;
  source_app: string;
  app_label?: string;
  title: string;
  text: string;
  posted_at: string;
  category?: string;
}

export interface NativeListenerStatus {
  isPermissionGranted: boolean;
  isConnected: boolean;
  captureEnabled: boolean;
  queueSize: number;
}

function getNativeModule() {
  return NativeModules?.LifeOSNotificationListener || null;
}

function getEventEmitter(): NativeEventEmitter | null {
  const mod = getNativeModule();
  return mod ? new NativeEventEmitter(mod) : null;
}

/**
 * Checks whether Android Notification Access permission is granted to LifeOS.
 */
export async function isNotificationAccessGranted(): Promise<boolean> {
  const mod = getNativeModule();
  if (Platform.OS !== 'android' || !mod) {
    return false;
  }
  try {
    return await mod.isPermissionGranted();
  } catch (err) {
    console.warn('[NativeNotificationListener] Error checking permission:', err);
    return false;
  }
}

/**
 * Opens Android system settings directly to ACTION_NOTIFICATION_LISTENER_SETTINGS.
 */
export async function openNotificationListenerSettings(): Promise<boolean> {
  const mod = getNativeModule();
  if (Platform.OS !== 'android' || !mod) {
    return false;
  }
  try {
    return await mod.openNotificationSettings();
  } catch (err) {
    console.warn('[NativeNotificationListener] Error opening settings:', err);
    return false;
  }
}

/**
 * Returns real-time native status: permission granted, service connected, and pending queue size.
 */
export async function getNativeListenerStatus(): Promise<NativeListenerStatus> {
  const mod = getNativeModule();
  if (Platform.OS !== 'android' || !mod) {
    const settings = getNotificationSettings();
    return {
      isPermissionGranted: false,
      isConnected: false,
      captureEnabled: settings.captureEnabled,
      queueSize: 0,
    };
  }
  try {
    return await mod.getListenerStatus();
  } catch (err) {
    console.warn('[NativeNotificationListener] Error getting status:', err);
    return {
      isPermissionGranted: false,
      isConnected: false,
      captureEnabled: false,
      queueSize: 0,
    };
  }
}

/**
 * Rebinds the NotificationListenerService if disconnected by Android OS.
 */
export async function requestRebindListener(): Promise<boolean> {
  const mod = getNativeModule();
  if (Platform.OS !== 'android' || !mod) {
    return false;
  }
  try {
    return await mod.requestRebind();
  } catch (err) {
    console.warn('[NativeNotificationListener] Error requesting rebind:', err);
    return false;
  }
}

/**
 * Syncs captureEnabled toggle and allowedApps list to Android SharedPreferences
 * so the native background service can filter events even when JavaScript is suspended.
 */
export async function syncSettingsToNative(
  captureEnabled: boolean,
  allowedApps: string[]
): Promise<boolean> {
  const mod = getNativeModule();
  if (Platform.OS !== 'android' || !mod) {
    return false;
  }
  try {
    return await mod.updateSettings(captureEnabled, allowedApps);
  } catch (err) {
    console.warn('[NativeNotificationListener] Error syncing settings to native:', err);
    return false;
  }
}

/**
 * Drains the native on-device persistent queue into JavaScript.
 */
export async function drainPendingNotifications(): Promise<RawNativeNotification[]> {
  const mod = getNativeModule();
  if (Platform.OS !== 'android' || !mod) {
    return [];
  }
  try {
    const rawList = await mod.drainPendingNotifications();
    return rawList || [];
  } catch (err) {
    console.warn('[NativeNotificationListener] Error draining queue:', err);
    return [];
  }
}

/**
 * Drains the persistent queue and processes every item through the shared pipeline.
 */
export async function drainAndProcessQueue(
  processor: NotificationProcessor
): Promise<number> {
  const pending = await drainPendingNotifications();
  if (!pending || pending.length === 0) return 0;

  let processedCount = 0;
  for (const raw of pending) {
    const event: NotificationEvent = {
      notification_id: raw.notification_id,
      source_app: raw.source_app,
      app_label: raw.app_label || raw.source_app,
      title: raw.title,
      text: raw.text,
      posted_at: raw.posted_at || new Date().toISOString(),
      category: raw.category,
    };

    const result = await processor.processNotification(event);
    if (result.accepted) {
      processedCount++;
    }
  }

  return processedCount;
}

/**
 * Subscribes to live incoming notifications delivered while the app is active in foreground.
 */
export function subscribeToLiveNotifications(
  onNotification: (event: NotificationEvent) => void
): { remove: () => void } {
  const emitter = getEventEmitter();
  if (!emitter) {
    return { remove: () => {} };
  }

  const subscription = emitter.addListener(
    'LifeOSNotificationReceived',
    (data: any) => {
      const raw = data as RawNativeNotification;
      const event: NotificationEvent = {
        notification_id: raw.notification_id,
        source_app: raw.source_app,
        app_label: raw.app_label || raw.source_app,
        title: raw.title,
        text: raw.text,
        posted_at: raw.posted_at || new Date().toISOString(),
        category: raw.category,
      };
      onNotification(event);
    }
  );

  return {
    remove: () => subscription.remove(),
  };
}

/**
 * Subscribes to listener connection / disconnection events.
 */
export function subscribeToListenerStatus(
  onStatusChange: (status: { isConnected: boolean }) => void
): { remove: () => void } {
  const emitter = getEventEmitter();
  if (!emitter) {
    return { remove: () => {} };
  }

  const subscription = emitter.addListener(
    'LifeOSListenerStatusChanged',
    (data: any) => {
      onStatusChange(data as { isConnected: boolean });
    }
  );

  return {
    remove: () => subscription.remove(),
  };
}
