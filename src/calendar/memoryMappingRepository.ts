import { CalendarMappingRecord, CalendarMappingRepository, MappingStatus } from './mappingRepository';

export class MemoryMappingRepository implements CalendarMappingRepository {
  private records: Map<string, CalendarMappingRecord> = new Map();

  public async init(): Promise<void> {
    // No-op for in-memory
  }

  public async findByActionId(actionId: string): Promise<CalendarMappingRecord | null> {
    return this.records.get(actionId) || null;
  }

  public async findByAndroidEventId(androidEventId: string): Promise<CalendarMappingRecord | null> {
    for (const record of this.records.values()) {
      if (record.android_event_id === androidEventId) {
        return record;
      }
    }
    return null;
  }

  public async listAll(): Promise<CalendarMappingRecord[]> {
    return Array.from(this.records.values());
  }

  public async createPending(
    actionId: string,
    requestId: string,
    calendarId: string
  ): Promise<CalendarMappingRecord> {
    const now = new Date().toISOString();
    const record: CalendarMappingRecord = {
      action_id: actionId,
      request_id: requestId,
      android_event_id: null,
      calendar_id: calendarId,
      status: 'pending',
      created_at: now,
      updated_at: now,
      last_error: null,
    };
    this.records.set(actionId, record);
    return { ...record };
  }

  public async markCreated(actionId: string, androidEventId: string): Promise<void> {
    const record = this.records.get(actionId);
    if (record) {
      record.android_event_id = androidEventId;
      record.status = 'created';
      record.updated_at = new Date().toISOString();
      record.last_error = null;
    }
  }

  public async markUpdated(actionId: string): Promise<void> {
    const record = this.records.get(actionId);
    if (record) {
      record.status = 'updated';
      record.updated_at = new Date().toISOString();
    }
  }

  public async markDeleted(actionId: string): Promise<void> {
    const record = this.records.get(actionId);
    if (record) {
      record.status = 'deleted';
      record.updated_at = new Date().toISOString();
    }
  }

  public async markFailed(actionId: string, error: string): Promise<void> {
    const record = this.records.get(actionId);
    if (record) {
      record.status = 'failed';
      record.last_error = error;
      record.updated_at = new Date().toISOString();
    }
  }

  public async deleteByActionId(actionId: string): Promise<void> {
    this.records.delete(actionId);
  }

  // Helper for test setup
  public setRecordDirectly(record: CalendarMappingRecord): void {
    this.records.set(record.action_id, { ...record });
  }

  public clear(): void {
    this.records.clear();
  }
}

