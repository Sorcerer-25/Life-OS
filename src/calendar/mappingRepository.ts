export type MappingStatus = 'pending' | 'created' | 'updated' | 'deleted' | 'failed';

export interface CalendarMappingRecord {
  action_id: string; // Primary key (deterministic idempotency key from ActionPlan)
  request_id: string;
  android_event_id: string | null;
  calendar_id: string;
  status: MappingStatus;
  created_at: string;
  updated_at: string;
  last_error: string | null;
}

export interface CalendarMappingRepository {
  init(): Promise<void>;
  findByActionId(actionId: string): Promise<CalendarMappingRecord | null>;
  findByAndroidEventId(androidEventId: string): Promise<CalendarMappingRecord | null>;
  listAll(): Promise<CalendarMappingRecord[]>;
  createPending(actionId: string, requestId: string, calendarId: string): Promise<CalendarMappingRecord>;
  markCreated(actionId: string, androidEventId: string): Promise<void>;
  markUpdated(actionId: string): Promise<void>;
  markDeleted(actionId: string): Promise<void>;
  markFailed(actionId: string, error: string): Promise<void>;
  deleteByActionId(actionId: string): Promise<void>;
}

