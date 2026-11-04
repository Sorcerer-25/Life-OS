import { NotificationInboxItem, NotificationInboxStatus } from '../models/NotificationEvent';
import { NotificationInboxRepository } from './notificationInboxRepository';

export class MemoryNotificationInboxRepository implements NotificationInboxRepository {
  private items: Map<string, NotificationInboxItem> = new Map();

  public async init(): Promise<void> {
    // no-op for in-memory
  }

  public async save(item: NotificationInboxItem): Promise<NotificationInboxItem> {
    this.items.set(item.id, { ...item });
    return item;
  }

  public async findById(id: string): Promise<NotificationInboxItem | null> {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  public async findByDedupKey(dedupKey: string): Promise<NotificationInboxItem | null> {
    for (const item of this.items.values()) {
      if (item.dedup_key === dedupKey) {
        return { ...item };
      }
    }
    return null;
  }

  public async findRecentByPackageAndNotifId(
    sourceApp: string,
    notificationId: string,
    timeWindowMs: number
  ): Promise<NotificationInboxItem | null> {
    const now = Date.now();
    for (const item of this.items.values()) {
      if (
        item.source_app === sourceApp &&
        item.notification_id === notificationId
      ) {
        const itemTime = new Date(item.posted_at).getTime();
        if (Math.abs(now - itemTime) <= timeWindowMs) {
          return { ...item };
        }
      }
    }
    return null;
  }

  public async listAll(statusFilter?: NotificationInboxStatus): Promise<NotificationInboxItem[]> {
    const all = Array.from(this.items.values());
    const filtered = statusFilter ? all.filter((i) => i.status === statusFilter) : all;
    return filtered.sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
  }

  public async update(item: NotificationInboxItem): Promise<void> {
    this.items.set(item.id, { ...item, updated_at: new Date().toISOString() });
  }

  public async updateStatus(
    id: string,
    status: NotificationInboxStatus,
    updates?: Partial<NotificationInboxItem>
  ): Promise<void> {
    const existing = this.items.get(id);
    if (!existing) return;
    this.items.set(id, {
      ...existing,
      ...updates,
      status,
      updated_at: new Date().toISOString(),
    });
  }

  public async cleanupOld(retentionDays: number): Promise<number> {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    for (const [id, item] of this.items.entries()) {
      const itemTime = new Date(item.posted_at).getTime();
      if (itemTime < cutoffTime) {
        this.items.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  public async clearAll(): Promise<void> {
    this.items.clear();
  }

  public async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

