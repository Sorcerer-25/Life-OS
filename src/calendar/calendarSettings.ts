import { CalendarAdapter } from './calendarAdapter';
import { CalendarInfo, CalendarPreferences } from './types';

export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
  selectedCalendarId: null,
  defaultDurationMinutes: 60,
  enableCalendarAlarms: false,
  createCalendarEventForTasks: false,
};

let currentPreferences: CalendarPreferences = { ...DEFAULT_CALENDAR_PREFERENCES };

/**
 * Lists only calendars that allow writes/modifications.
 */
export async function listWritableCalendars(adapter: CalendarAdapter): Promise<CalendarInfo[]> {
  const all = await adapter.getCalendarsAsync();
  return all.filter((cal) => cal.allowsModifications);
}

/**
 * Resolves a destination calendar for event creation:
 * 1. Checks permissions.
 * 2. If a preferred or previously saved calendar ID exists, verifies it is still present and writable.
 * 3. If the saved one was deleted or is read-only, checks if a primary or default writable calendar exists.
 * 4. Returns the calendar, or an error code ('permission_denied' or 'no_writable_calendar').
 */
export async function resolveDestinationCalendar(
  adapter: CalendarAdapter,
  preferredId?: string | null
): Promise<{
  calendar: CalendarInfo | null;
  error?: 'permission_denied' | 'no_writable_calendar';
  message?: string;
}> {
  const perm = await adapter.getPermissionsAsync();
  if (!perm.granted) {
    return {
      calendar: null,
      error: 'permission_denied',
      message: 'Calendar access permission has not been granted.',
    };
  }

  const writableCalendars = await listWritableCalendars(adapter);
  if (writableCalendars.length === 0) {
    return {
      calendar: null,
      error: 'no_writable_calendar',
      message: 'No writable calendar found on the device. Please create or configure a writable calendar.',
    };
  }

  const targetId = preferredId || currentPreferences.selectedCalendarId;
  if (targetId) {
    const matched = writableCalendars.find((c) => c.id === targetId);
    if (matched) {
      return { calendar: matched };
    }
  }

  // If saved calendar is not found or not writable, fallback to primary writable calendar or first available
  const primary = writableCalendars.find((c) => c.isPrimary) || writableCalendars[0];
  // Auto-save the fallback selection
  currentPreferences.selectedCalendarId = primary.id;
  return { calendar: primary };
}

export async function getCalendarPreferences(): Promise<CalendarPreferences> {
  return { ...currentPreferences };
}

export async function updateCalendarPreferences(
  prefs: Partial<CalendarPreferences>
): Promise<CalendarPreferences> {
  currentPreferences = {
    ...currentPreferences,
    ...prefs,
  };
  return { ...currentPreferences };
}

export async function getSelectedCalendarId(): Promise<string | null> {
  return currentPreferences.selectedCalendarId;
}

export async function setSelectedCalendarId(calendarId: string | null): Promise<void> {
  currentPreferences.selectedCalendarId = calendarId;
}

export function isCreateCalendarEventForTasksEnabled(): boolean {
  return Boolean(currentPreferences.createCalendarEventForTasks);
}

/**
 * Honest description of calendar source for UI display.
 */
export function formatCalendarSourceDescription(cal: CalendarInfo): string {
  if (cal.sourceMetadata.isDeviceLocal) {
    return 'Device-Local (offline on phone; no cloud sync)';
  }
  if (cal.sourceMetadata.isGoogleAccount) {
    return `Google Account (${cal.accountName}) — sync depends on account settings`;
  }
  return `${cal.accountName} (${cal.sourceType})`;
}

