import { NativeModules } from 'react-native';
import { MemoryNotificationInboxRepository } from '../../src/notifications/memoryNotificationInboxRepository';
import {
  drainAndProcessQueue,
  drainPendingNotifications,
  getNativeListenerStatus,
  isNotificationAccessGranted,
  openNotificationListenerSettings,
  RawNativeNotification,
  requestRebindListener,
  syncSettingsToNative,
} from '../../src/notifications/nativeNotificationListener';
import { NotificationProcessor } from '../../src/notifications/notificationProcessor';
import {
  addAppToAllowList,
  resetNotificationSettings,
  updateNotificationSettings,
} from '../../src/notifications/notificationSettings';

// Mock NativeModule
const mockNativeListener = {
  isPermissionGranted: jest.fn(),
  openNotificationSettings: jest.fn(),
  getListenerStatus: jest.fn(),
  requestRebind: jest.fn(),
  updateSettings: jest.fn(),
  drainPendingNotifications: jest.fn(),
};

NativeModules.LifeOSNotificationListener = mockNativeListener;

describe('NativeNotificationListener & Queue Draining Suite', () => {
  let memoryRepo: MemoryNotificationInboxRepository;
  let processor: NotificationProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    resetNotificationSettings();
    memoryRepo = new MemoryNotificationInboxRepository();
    processor = new NotificationProcessor(memoryRepo);
  });

  describe('1. Permission & Settings Bridge', () => {
    it('checks if notification access permission is granted', async () => {
      mockNativeListener.isPermissionGranted.mockResolvedValueOnce(true);
      const granted = await isNotificationAccessGranted();
      expect(granted).toBe(true);
      expect(mockNativeListener.isPermissionGranted).toHaveBeenCalled();
    });

    it('opens Android system settings for notification access', async () => {
      mockNativeListener.openNotificationSettings.mockResolvedValueOnce(true);
      const res = await openNotificationListenerSettings();
      expect(res).toBe(true);
      expect(mockNativeListener.openNotificationSettings).toHaveBeenCalled();
    });

    it('retrieves native status including connection state and queue size', async () => {
      mockNativeListener.getListenerStatus.mockResolvedValueOnce({
        isPermissionGranted: true,
        isConnected: true,
        captureEnabled: true,
        queueSize: 3,
      });

      const status = await getNativeListenerStatus();
      expect(status.isPermissionGranted).toBe(true);
      expect(status.isConnected).toBe(true);
      expect(status.queueSize).toBe(3);
    });

    it('requests listener rebind when disconnected', async () => {
      mockNativeListener.requestRebind.mockResolvedValueOnce(true);
      const res = await requestRebindListener();
      expect(res).toBe(true);
      expect(mockNativeListener.requestRebind).toHaveBeenCalled();
    });

    it('syncs settings to native SharedPreferences', async () => {
      mockNativeListener.updateSettings.mockResolvedValueOnce(true);
      const res = await syncSettingsToNative(true, ['com.axis.mobile', 'com.google.android.calendar']);
      expect(res).toBe(true);
      expect(mockNativeListener.updateSettings).toHaveBeenCalledWith(
        true,
        ['com.axis.mobile', 'com.google.android.calendar']
      );
    });
  });

  describe('2. Persistent Queue Draining into Shared Pipeline', () => {
    it('drains empty queue with 0 processed items', async () => {
      mockNativeListener.drainPendingNotifications.mockResolvedValueOnce([]);
      const count = await drainAndProcessQueue(processor);
      expect(count).toBe(0);
    });

    it('drains real captured notifications from queue and passes them into shared inbox', async () => {
      addAppToAllowList('com.google.android.calendar');

      const rawQueue: RawNativeNotification[] = [
        {
          notification_id: 'native_cal_1',
          source_app: 'com.google.android.calendar',
          app_label: 'Google Calendar',
          title: 'Design Review',
          text: 'Meeting tomorrow at 3 PM at Room 2',
          posted_at: '2026-11-03T10:00:00.000Z',
          category: 'event',
        },
      ];

      mockNativeListener.drainPendingNotifications.mockResolvedValueOnce(rawQueue);

      const processedCount = await drainAndProcessQueue(processor);
      expect(processedCount).toBe(1);

      const inboxItems = await memoryRepo.listAll();
      expect(inboxItems.length).toBe(1);
      expect(inboxItems[0].source_app).toBe('com.google.android.calendar');
      expect(inboxItems[0].status).toBe('new');
    });

    it('applies allow-list filtering on drained notifications (drops non-allowed apps)', async () => {
      // Allow-list is empty by default
      const rawQueue: RawNativeNotification[] = [
        {
          notification_id: 'spam_1',
          source_app: 'com.spam.promos',
          app_label: 'Spam App',
          title: 'Special discount',
          text: 'Flat 90% off',
          posted_at: new Date().toISOString(),
        },
      ];

      mockNativeListener.drainPendingNotifications.mockResolvedValueOnce(rawQueue);

      const processedCount = await drainAndProcessQueue(processor);
      expect(processedCount).toBe(0);

      const inboxItems = await memoryRepo.listAll();
      expect(inboxItems.length).toBe(0);
    });

    it('sanitizes account numbers when draining real notifications', async () => {
      addAppToAllowList('com.axis.mobile');

      const rawQueue: RawNativeNotification[] = [
        {
          notification_id: 'axis_drain_1',
          source_app: 'com.axis.mobile',
          app_label: 'Axis Mobile',
          title: 'Debit Alert',
          text: 'INR 1,500.00 debited from A/C 987654321012 at Supermarket',
          posted_at: '2026-11-03T10:00:00.000Z',
        },
      ];

      mockNativeListener.drainPendingNotifications.mockResolvedValueOnce(rawQueue);

      const processedCount = await drainAndProcessQueue(processor);
      expect(processedCount).toBe(1);

      const inboxItems = await memoryRepo.listAll();
      expect(inboxItems[0].text).toContain('A/C ****1012');
      expect(inboxItems[0].text).not.toContain('987654321012');
    });

    it('never automatically executes an action plan upon draining', async () => {
      addAppToAllowList('com.google.android.calendar');

      const rawQueue: RawNativeNotification[] = [
        {
          notification_id: 'cal_drain_auto',
          source_app: 'com.google.android.calendar',
          app_label: 'Calendar',
          title: 'Sync',
          text: 'Sync with Team tomorrow at 4 PM',
          posted_at: '2026-11-03T10:00:00.000Z',
        },
      ];

      mockNativeListener.drainPendingNotifications.mockResolvedValueOnce(rawQueue);

      await drainAndProcessQueue(processor);
      const items = await memoryRepo.listAll();
      expect(items[0].status).toBe('new');

      // User must trigger analysis and approve
      const analysed = await processor.analyzeInboxItem(items[0].id);
      expect(analysed?.status).toBe('analysed');
      expect(analysed?.action_plan).toBeDefined();

      // Only executes when approveActionPlan is called
      const approved = await processor.approveActionPlan(items[0].id);
      expect(approved.success).toBe(true);
      expect(approved.item.status).toBe('actioned');
    });
  });
});

