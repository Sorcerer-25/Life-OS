import * as Calendar from 'expo-calendar/legacy';
import { Linking, Platform } from 'react-native';
import { CalendarAdapter } from './calendarAdapter';
import {
  CalendarEventRecord,
  CalendarInfo,
  CalendarPermissionResponse,
  CalendarPermissionStatus,
  CalendarSourceMetadata,
  CreateEventParams,
  UpdateEventParams,
} from './types';

export class ExpoCalendarAdapter implements CalendarAdapter {
  public async getPermissionsAsync(): Promise<CalendarPermissionResponse> {
    try {
      const res = await Calendar.getCalendarPermissionsAsync();
      return this.normalizePermission(res);
    } catch (err) {
      console.warn('[ExpoCalendarAdapter] Failed to get calendar permissions:', err);
      return {
        status: 'undetermined',
        canAskAgain: true,
        granted: false,
      };
    }
  }

  public async requestPermissionsAsync(): Promise<CalendarPermissionResponse> {
    try {
      const res = await Calendar.requestCalendarPermissionsAsync();
      return this.normalizePermission(res);
    } catch (err) {
      console.warn('[ExpoCalendarAdapter] Failed to request calendar permissions:', err);
      return {
        status: 'denied',
        canAskAgain: false,
        granted: false,
      };
    }
  }

  public async openSettingsAsync(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (err) {
      console.warn('[ExpoCalendarAdapter] Failed to open device settings:', err);
    }
  }

  public async getCalendarsAsync(): Promise<CalendarInfo[]> {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      return calendars.map((cal) => this.mapToCalendarInfo(cal));
    } catch (err) {
      console.warn('[ExpoCalendarAdapter] Failed to get calendars:', err);
      return [];
    }
  }

  public async createEventAsync(calendarId: string, params: CreateEventParams): Promise<string> {
    // Append idempotency marker to description so it can be verified/recovered in crash recovery
    let description = params.description || '';
    if (params.actionId) {
      const marker = `[LifeOS action_id: ${params.actionId}]`;
      if (!description.includes(marker)) {
        description = description ? `${description}\n\n${marker}` : marker;
      }
    }

    const eventDetails: Calendar.Event = {
      title: params.title,
      startDate: params.startDate,
      endDate: params.endDate,
      allDay: params.allDay ?? false,
      location: params.location,
      notes: description,
      timeZone: params.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      alarms: params.alarms,
    } as Calendar.Event;

    return await Calendar.createEventAsync(calendarId, eventDetails);
  }

  public async getEventAsync(eventId: string): Promise<CalendarEventRecord | null> {
    try {
      const event = await Calendar.getEventAsync(eventId);
      if (!event || !event.id) return null;

      return {
        id: event.id,
        calendarId: event.calendarId,
        title: event.title || '',
        startDate:
          event.startDate instanceof Date
            ? event.startDate.toISOString()
            : new Date(event.startDate).toISOString(),
        endDate:
          event.endDate instanceof Date
            ? event.endDate.toISOString()
            : new Date(event.endDate).toISOString(),
        allDay: Boolean(event.allDay),
        location: event.location ?? undefined,
        description: event.notes ?? undefined,
        timeZone: event.timeZone,
      };
    } catch {
      return null;
    }
  }

  public async findEventByMarkerAsync(
    calendarId: string,
    marker: string
  ): Promise<CalendarEventRecord | null> {
    try {
      // Search a wide window (+/- 30 days around today) to find the marker
      const now = new Date();
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const events = await Calendar.getEventsAsync([calendarId], startDate, endDate);
      const match = events.find((e) => (e.notes && e.notes.includes(marker)) || (e.title && e.title.includes(marker)));
      if (!match || !match.id) return null;

      return {
        id: match.id,
        calendarId: match.calendarId,
        title: match.title || '',
        startDate:
          match.startDate instanceof Date
            ? match.startDate.toISOString()
            : new Date(match.startDate).toISOString(),
        endDate:
          match.endDate instanceof Date
            ? match.endDate.toISOString()
            : new Date(match.endDate).toISOString(),
        allDay: Boolean(match.allDay),
        location: match.location ?? undefined,
        description: match.notes ?? undefined,
        timeZone: match.timeZone,
      };
    } catch (err) {
      console.warn('[ExpoCalendarAdapter] Error searching events by marker:', err);
      return null;
    }
  }

  public async updateEventAsync(eventId: string, params: UpdateEventParams): Promise<void> {
    const details: Partial<Calendar.Event> = {};
    if (params.title !== undefined) details.title = params.title;
    if (params.startDate !== undefined) details.startDate = params.startDate;
    if (params.endDate !== undefined) details.endDate = params.endDate;
    if (params.allDay !== undefined) details.allDay = params.allDay;
    if (params.location !== undefined) details.location = params.location;
    if (params.description !== undefined) details.notes = params.description;
    if (params.timeZone !== undefined) details.timeZone = params.timeZone;

    await Calendar.updateEventAsync(eventId, details);
  }

  public async deleteEventAsync(eventId: string): Promise<void> {
    await Calendar.deleteEventAsync(eventId);
  }

  private normalizePermission(res: Calendar.PermissionResponse): CalendarPermissionResponse {
    let status: CalendarPermissionStatus = 'undetermined';

    if (res.status === 'granted') {
      status = 'granted';
    } else if (res.status === 'denied') {
      status = res.canAskAgain ? 'denied' : 'denied_permanently';
    } else if (res.status === 'undetermined') {
      status = 'undetermined';
    }

    return {
      status,
      canAskAgain: res.canAskAgain,
      granted: res.granted || res.status === 'granted',
    };
  }

  private mapToCalendarInfo(cal: Calendar.Calendar): CalendarInfo {
    const accountName = cal.source?.name || (cal as any).accountName || 'device-local';
    const sourceType = cal.source?.type || (cal as any).accountType || (Platform.OS === 'android' ? 'LOCAL' : 'local');
    const ownerAccount = cal.ownerAccount || accountName;
    const accessLevel = cal.accessLevel || 'owner';

    const isGoogleAccount =
      sourceType.toLowerCase().includes('google') ||
      accountName.toLowerCase().includes('@gmail.com') ||
      ownerAccount.toLowerCase().includes('@gmail.com');

    const isDeviceLocal =
      sourceType.toUpperCase() === 'LOCAL' ||
      accountName.toLowerCase() === 'device-local' ||
      accountName.toLowerCase() === 'local';

    const sourceMetadata: CalendarSourceMetadata = {
      accountName,
      sourceType,
      isDeviceLocal,
      isGoogleAccount,
    };

    // Writable if allowsModifications is true and access level is not strictly read-only
    const allowsModifications =
      cal.allowsModifications !== false &&
      accessLevel !== 'read' &&
      accessLevel !== 'freebusy';

    return {
      id: cal.id,
      title: cal.title || accountName,
      accountName,
      sourceType,
      ownerAccount,
      accessLevel,
      allowsModifications,
      isPrimary: (cal as any).isPrimary,
      color: cal.color,
      sourceMetadata,
    };
  }
}
