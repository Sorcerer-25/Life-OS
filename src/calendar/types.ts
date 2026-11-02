/**
 * Types and interfaces for LifeOS Calendar Integration via Android CalendarProvider.
 */

export type CalendarPermissionStatus = 'granted' | 'denied' | 'denied_permanently' | 'undetermined';

export interface CalendarPermissionResponse {
  status: CalendarPermissionStatus;
  canAskAgain: boolean;
  granted: boolean;
}

export interface CalendarSourceMetadata {
  accountName: string;
  sourceType: string;
  isDeviceLocal: boolean;
  isGoogleAccount: boolean;
}

export interface CalendarInfo {
  id: string;
  title: string;
  accountName: string; // e.g. "device-local", "john.doe@gmail.com"
  sourceType: string; // e.g. "LOCAL", "com.google"
  ownerAccount: string;
  accessLevel: string; // e.g. "owner", "editor", "contributor", "read"
  allowsModifications: boolean;
  isPrimary?: boolean;
  color?: string;
  sourceMetadata: CalendarSourceMetadata;
}

export interface CreateEventParams {
  title: string;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
  location?: string;
  description?: string;
  timeZone?: string;
  actionId?: string; // Idempotency marker embedded in event notes
  alarms?: Array<{ relativeOffset: number }>;
}

export interface UpdateEventParams {
  title?: string;
  startDate?: Date;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  description?: string;
  timeZone?: string;
}

export interface CalendarEventRecord {
  id: string;
  calendarId: string;
  title: string;
  startDate: string; // ISO
  endDate: string; // ISO
  allDay: boolean;
  location?: string;
  description?: string;
  timeZone?: string;
}

export type CalendarErrorCode =
  | 'permission_denied'
  | 'no_writable_calendar'
  | 'invalid_time'
  | 'provider_error'
  | 'event_not_found';

export interface CalendarDefaultsApplied {
  durationMinutes?: number;
  defaultEndTime?: boolean;
}

export interface CalendarOperationResult {
  success: boolean;
  status: 'success' | 'failed' | 'needs_clarification';
  operation: 'create_event' | 'update_event' | 'delete_event';
  actionId: string;
  androidEventId?: string;
  calendarId?: string;
  calendarSource?: {
    accountName: string;
    sourceType: string;
    isDeviceLocal: boolean;
    isGoogleAccount: boolean;
  };
  duplicate?: boolean;
  defaultsApplied?: CalendarDefaultsApplied;
  verifiedInProvider?: boolean;
  errorCode?: CalendarErrorCode;
  message: string;
}

export interface CalendarPreferences {
  selectedCalendarId: string | null;
  defaultDurationMinutes: number; // default 60
  enableCalendarAlarms: boolean; // default false
  createCalendarEventForTasks: boolean; // default false
}

