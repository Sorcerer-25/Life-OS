import { CalendarAdapter } from './calendarAdapter';
import {
  CalendarEventRecord,
  CalendarInfo,
  CalendarPermissionResponse,
  CalendarPermissionStatus,
  CreateEventParams,
  UpdateEventParams,
} from './types';

export class MockCalendarAdapter implements CalendarAdapter {
  public permissionStatus: CalendarPermissionStatus = 'granted';
  public canAskAgain: boolean = true;
  public settingsOpenedCount: number = 0;
  public simulateProviderError: boolean = false;

  private calendars: Map<string, CalendarInfo> = new Map();
  private events: Map<string, CalendarEventRecord> = new Map();
  private nextEventId = 1000;

  constructor() {
    this.seedDefaultCalendars();
  }

  public seedDefaultCalendars(): void {
    this.calendars.clear();

    // 1. Google account calendar (writable)
    this.calendars.set('cal_google_primary', {
      id: 'cal_google_primary',
      title: 'Personal (Google)',
      accountName: 'user@gmail.com',
      sourceType: 'com.google',
      ownerAccount: 'user@gmail.com',
      accessLevel: 'owner',
      allowsModifications: true,
      isPrimary: true,
      color: '#4285F4',
      sourceMetadata: {
        accountName: 'user@gmail.com',
        sourceType: 'com.google',
        isDeviceLocal: false,
        isGoogleAccount: true,
      },
    });

    // 2. Device-local calendar (writable, offline only)
    this.calendars.set('cal_local_device', {
      id: 'cal_local_device',
      title: 'Phone Storage',
      accountName: 'device-local',
      sourceType: 'LOCAL',
      ownerAccount: 'device-local',
      accessLevel: 'owner',
      allowsModifications: true,
      isPrimary: false,
      color: '#34A853',
      sourceMetadata: {
        accountName: 'device-local',
        sourceType: 'LOCAL',
        isDeviceLocal: true,
        isGoogleAccount: false,
      },
    });

    // 3. Read-only calendar (e.g. National Holidays)
    this.calendars.set('cal_readonly_holidays', {
      id: 'cal_readonly_holidays',
      title: 'National Holidays',
      accountName: 'holidays@group.v.calendar.google.com',
      sourceType: 'com.google',
      ownerAccount: 'holidays@group.v.calendar.google.com',
      accessLevel: 'read',
      allowsModifications: false,
      isPrimary: false,
      color: '#FBBC05',
      sourceMetadata: {
        accountName: 'holidays@group.v.calendar.google.com',
        sourceType: 'com.google',
        isDeviceLocal: false,
        isGoogleAccount: true,
      },
    });
  }

  public async getPermissionsAsync(): Promise<CalendarPermissionResponse> {
    return {
      status: this.permissionStatus,
      canAskAgain: this.canAskAgain,
      granted: this.permissionStatus === 'granted',
    };
  }

  public async requestPermissionsAsync(): Promise<CalendarPermissionResponse> {
    if (this.permissionStatus === 'denied_permanently') {
      return {
        status: 'denied_permanently',
        canAskAgain: false,
        granted: false,
      };
    }
    return {
      status: this.permissionStatus,
      canAskAgain: this.canAskAgain,
      granted: this.permissionStatus === 'granted',
    };
  }

  public async openSettingsAsync(): Promise<void> {
    this.settingsOpenedCount++;
  }

  public async getCalendarsAsync(): Promise<CalendarInfo[]> {
    if (this.permissionStatus !== 'granted') {
      return [];
    }
    return Array.from(this.calendars.values());
  }

  public async createEventAsync(calendarId: string, params: CreateEventParams): Promise<string> {
    if (this.permissionStatus !== 'granted') {
      throw new Error('Permission denied: cannot write to calendar');
    }
    if (this.simulateProviderError) {
      throw new Error('Native calendar provider internal error (simulated)');
    }

    const cal = this.calendars.get(calendarId);
    if (!cal) {
      throw new Error(`Calendar not found: ${calendarId}`);
    }
    if (!cal.allowsModifications) {
      throw new Error(`Calendar is read-only: ${calendarId}`);
    }

    const id = `android_evt_${this.nextEventId++}`;
    let description = params.description || '';
    if (params.actionId) {
      const marker = `[LifeOS action_id: ${params.actionId}]`;
      if (!description.includes(marker)) {
        description = description ? `${description}\n\n${marker}` : marker;
      }
    }

    const record: CalendarEventRecord = {
      id,
      calendarId,
      title: params.title,
      startDate: params.startDate.toISOString(),
      endDate: params.endDate.toISOString(),
      allDay: Boolean(params.allDay),
      location: params.location,
      description,
      timeZone: params.timeZone,
    };

    this.events.set(id, record);
    return id;
  }

  public async getEventAsync(eventId: string): Promise<CalendarEventRecord | null> {
    if (this.permissionStatus !== 'granted') return null;
    return this.events.get(eventId) || null;
  }

  public async findEventByMarkerAsync(
    calendarId: string,
    marker: string
  ): Promise<CalendarEventRecord | null> {
    if (this.permissionStatus !== 'granted') return null;

    for (const ev of this.events.values()) {
      if (
        ev.calendarId === calendarId &&
        ((ev.description && ev.description.includes(marker)) ||
          (ev.title && ev.title.includes(marker)))
      ) {
        return ev;
      }
    }
    return null;
  }

  public async updateEventAsync(eventId: string, params: UpdateEventParams): Promise<void> {
    if (this.permissionStatus !== 'granted') {
      throw new Error('Permission denied');
    }
    const ev = this.events.get(eventId);
    if (!ev) {
      throw new Error(`Event not found: ${eventId}`);
    }

    if (params.title !== undefined) ev.title = params.title;
    if (params.startDate !== undefined) ev.startDate = params.startDate.toISOString();
    if (params.endDate !== undefined) ev.endDate = params.endDate.toISOString();
    if (params.allDay !== undefined) ev.allDay = params.allDay;
    if (params.location !== undefined) ev.location = params.location;
    if (params.description !== undefined) ev.description = params.description;
    if (params.timeZone !== undefined) ev.timeZone = params.timeZone;
  }

  public async deleteEventAsync(eventId: string): Promise<void> {
    if (this.permissionStatus !== 'granted') {
      throw new Error('Permission denied');
    }
    if (!this.events.has(eventId)) {
      throw new Error(`Event not found: ${eventId}`);
    }
    this.events.delete(eventId);
  }

  // Test helpers
  public setCalendarList(calendars: CalendarInfo[]): void {
    this.calendars.clear();
    for (const c of calendars) {
      this.calendars.set(c.id, c);
    }
  }

  public simulateExternalDeletion(eventId: string): void {
    this.events.delete(eventId);
  }

  public getAllEvents(): CalendarEventRecord[] {
    return Array.from(this.events.values());
  }
}

