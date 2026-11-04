import { NotificationInboxItem, NotificationInboxStatus } from '../models/NotificationEvent';

export interface NotificationInboxRepository {
  init(): Promise<void>;
  save(item: NotificationInboxItem): Promise<NotificationInboxItem>;
  findById(id: string): Promise<NotificationInboxItem | null>;
  findByDedupKey(dedupKey: string): Promise<NotificationInboxItem | null>;
  findRecentByPackageAndNotifId(
    sourceApp: string,
    notificationId: string,
    timeWindowMs: number
  ): Promise<NotificationInboxItem | null>;
  listAll(statusFilter?: NotificationInboxStatus): Promise<NotificationInboxItem[]>;
  update(item: NotificationInboxItem): Promise<void>;
  updateStatus(
    id: string,
    status: NotificationInboxStatus,
    updates?: Partial<NotificationInboxItem>
  ): Promise<void>;
  cleanupOld(retentionDays: number): Promise<number>;
  clearAll(): Promise<void>;
  delete(id: string): Promise<void>;
}

