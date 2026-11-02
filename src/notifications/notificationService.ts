import type * as NotificationsType from 'expo-notifications';

export const NOTIFICATION_CHANNEL_ID = 'lifeos-reminders';

function getPlatformOS(): string {
  try {
    const { Platform } = require('react-native');
    return Platform.OS;
  } catch {
    return 'android';
  }
}

export interface NotificationScheduleParams {
  title: string;
  body?: string;
  scheduledDate: Date;
  reminderId: string;
  actionId: string;
}

export interface NotificationClient {
  configureHandler(): void;
  configureChannel(): Promise<void>;
  getPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  schedule(
    title: string,
    body: string,
    date: Date,
    data: Record<string, unknown>
  ): Promise<string>;
  cancel(notificationId: string): Promise<void>;
  getAllScheduled(): Promise<Array<{ id: string; title?: string }>>;
}

/**
 * Default production notification client using expo-notifications.
 * Dynamically loads expo-notifications so Node/Jest unit tests can run decoupled.
 */
export class ExpoNotificationClient implements NotificationClient {
  private handlerConfigured = false;
  private channelConfigured = false;

  private getNotifications(): typeof NotificationsType {
    return require('expo-notifications');
  }

  public configureHandler(): void {
    if (this.handlerConfigured) return;
    try {
      const Notifications = this.getNotifications();
      if (!Notifications?.setNotificationHandler) return;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      this.handlerConfigured = true;
    } catch {
      // In test/mock environments where native module is not present, ignore
    }
  }

  public async configureChannel(): Promise<void> {
    if (this.channelConfigured) return;
    if (getPlatformOS() === 'android') {
      try {
        const Notifications = this.getNotifications();
        await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
          name: 'LifeOS Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#38bdf8',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
        this.channelConfigured = true;
      } catch (err) {
        console.warn('[NotificationClient] Failed to create Android notification channel:', err);
      }
    }
  }

  public async getPermissions(): Promise<boolean> {
    try {
      const Notifications = this.getNotifications();
      const settings = await Notifications.getPermissionsAsync();
      return (
        settings.granted ||
        settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
        false
      );
    } catch {
      return false;
    }
  }

  public async requestPermissions(): Promise<boolean> {
    try {
      const Notifications = this.getNotifications();
      const response = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      return response.granted;
    } catch {
      return false;
    }
  }

  public async schedule(
    title: string,
    body: string,
    date: Date,
    data: Record<string, unknown>
  ): Promise<string> {
    await this.configureChannel();
    const Notifications = this.getNotifications();

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: NOTIFICATION_CHANNEL_ID,
      },
    });

    return notificationId;
  }

  public async cancel(notificationId: string): Promise<void> {
    const Notifications = this.getNotifications();
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  public async getAllScheduled(): Promise<Array<{ id: string; title?: string }>> {
    const Notifications = this.getNotifications();
    const list = await Notifications.getAllScheduledNotificationsAsync();
    return list.map((item) => ({
      id: item.identifier,
      title: item.content.title || undefined,
    }));
  }
}

/**
 * Reusable Notification Service for LifeOS.
 * Enforces permission checks, date validations, and scheduling constraints.
 */
export class NotificationService {
  private client: NotificationClient;

  constructor(client?: NotificationClient) {
    this.client = client || new ExpoNotificationClient();
    this.client.configureHandler();
  }

  public async configureAndroidChannel(): Promise<void> {
    await this.client.configureChannel();
  }

  public async checkPermissions(): Promise<boolean> {
    return this.client.getPermissions();
  }

  public async requestPermissions(): Promise<boolean> {
    return this.client.requestPermissions();
  }

  public async ensurePermissions(): Promise<boolean> {
    const hasPermission = await this.client.getPermissions();
    if (hasPermission) return true;
    return this.client.requestPermissions();
  }

  /**
   * Schedules a local notification.
   * Throws explicit errors if permission is denied, date is in the past, or invalid.
   */
  public async scheduleNotification(
    params: NotificationScheduleParams
  ): Promise<{ notificationId: string }> {
    const { title, body, scheduledDate, reminderId, actionId } = params;

    if (!title || !title.trim()) {
      throw new Error('Notification title cannot be empty.');
    }

    if (!(scheduledDate instanceof Date) || isNaN(scheduledDate.getTime())) {
      throw new Error('Invalid scheduled date provided for reminder.');
    }

    const now = Date.now();
    if (scheduledDate.getTime() <= now) {
      throw new Error(
        `Cannot schedule reminder in the past. Requested: ${scheduledDate.toISOString()}, Current: ${new Date(
          now
        ).toISOString()}`
      );
    }

    // Ensure permissions
    const hasPermission = await this.ensurePermissions();
    if (!hasPermission) {
      throw new Error('Notification permission denied by user.');
    }

    try {
      const notificationId = await this.client.schedule(
        title.trim(),
        body || 'Reminder from LifeOS',
        scheduledDate,
        {
          reminderId,
          actionId,
          scheduledAt: scheduledDate.toISOString(),
        }
      );

      if (!notificationId) {
        throw new Error('Notification scheduling API did not return a valid identifier.');
      }

      return { notificationId };
    } catch (err: unknown) {
      const message = (err as Error).message || 'Failed to schedule notification';
      throw new Error(`Notification scheduling failed: ${message}`);
    }
  }

  /**
   * Cancels a scheduled notification by identifier.
   */
  public async cancelNotification(notificationId: string): Promise<boolean> {
    if (!notificationId) return false;
    try {
      await this.client.cancel(notificationId);
      return true;
    } catch (err) {
      console.warn(`[NotificationService] Failed to cancel notification ${notificationId}:`, err);
      return false;
    }
  }

  /**
   * Retrieves all scheduled notifications.
   */
  public async getScheduledNotifications(): Promise<Array<{ id: string; title?: string }>> {
    try {
      return await this.client.getAllScheduled();
    } catch {
      return [];
    }
  }
}

export const defaultNotificationService = new NotificationService();
