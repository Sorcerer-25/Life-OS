import {
  CalendarEventRecord,
  CalendarInfo,
  CalendarPermissionResponse,
  CreateEventParams,
  UpdateEventParams,
} from './types';

/**
 * Interface decoupling LifeOS Calendar Agent from native Android calendar provider / expo-calendar.
 * Allows seamless unit testing via MockCalendarAdapter and real execution via ExpoCalendarAdapter.
 */
export interface CalendarAdapter {
  /**
   * Checks current calendar permissions without triggering a user prompt.
   */
  getPermissionsAsync(): Promise<CalendarPermissionResponse>;

  /**
   * Requests calendar permissions (READ_CALENDAR / WRITE_CALENDAR).
   */
  requestPermissionsAsync(): Promise<CalendarPermissionResponse>;

  /**
   * Opens device application settings (used when permission is permanently denied).
   */
  openSettingsAsync(): Promise<void>;

  /**
   * Lists all available calendars with detailed source and modification metadata.
   */
  getCalendarsAsync(): Promise<CalendarInfo[]>;

  /**
   * Inserts an event into the native calendar provider.
   * Returns the native Android event ID.
   */
  createEventAsync(calendarId: string, params: CreateEventParams): Promise<string>;

  /**
   * Fetches an event by its native ID to verify existence and metadata in the provider.
   */
  getEventAsync(eventId: string): Promise<CalendarEventRecord | null>;

  /**
   * Searches a calendar for an event matching a specific title or note marker.
   */
  findEventByMarkerAsync(calendarId: string, marker: string): Promise<CalendarEventRecord | null>;

  /**
   * Updates an existing event in the calendar provider.
   */
  updateEventAsync(eventId: string, params: UpdateEventParams): Promise<void>;

  /**
   * Deletes an event by ID from the calendar provider.
   */
  deleteEventAsync(eventId: string): Promise<void>;
}

