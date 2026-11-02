import { MockCalendarAdapter } from '../../src/calendar/mockCalendarAdapter';
import {
  formatCalendarSourceDescription,
  listWritableCalendars,
  resolveDestinationCalendar,
  setSelectedCalendarId,
  updateCalendarPreferences,
} from '../../src/calendar/calendarSettings';

describe('CalendarAdapter and Selection Unit Tests (Checkpoints 1 & 2)', () => {
  let adapter: MockCalendarAdapter;

  beforeEach(() => {
    adapter = new MockCalendarAdapter();
    setSelectedCalendarId(null);
    updateCalendarPreferences({
      selectedCalendarId: null,
      defaultDurationMinutes: 60,
      enableCalendarAlarms: false,
      createCalendarEventForTasks: false,
    });
  });

  describe('Calendar Listing and Metadata honesty', () => {
    it('lists all calendars including Google, device-local, and read-only', async () => {
      const allCalendars = await adapter.getCalendarsAsync();
      expect(allCalendars.length).toBe(3);

      const googleCal = allCalendars.find((c) => c.sourceMetadata.isGoogleAccount);
      expect(googleCal).toBeDefined();
      expect(googleCal!.accountName).toBe('user@gmail.com');
      expect(googleCal!.allowsModifications).toBe(true);

      const localCal = allCalendars.find((c) => c.sourceMetadata.isDeviceLocal);
      expect(localCal).toBeDefined();
      expect(localCal!.allowsModifications).toBe(true);

      const readOnlyCal = allCalendars.find((c) => !c.allowsModifications);
      expect(readOnlyCal).toBeDefined();
      expect(readOnlyCal!.accessLevel).toBe('read');
    });

    it('filters destination choices to only writable calendars', async () => {
      const writable = await listWritableCalendars(adapter);
      expect(writable.length).toBe(2);
      expect(writable.every((c) => c.allowsModifications)).toBe(true);
      expect(writable.some((c) => c.id === 'cal_readonly_holidays')).toBe(false);
    });

    it('provides honest source descriptions differentiating device-local from account calendars', async () => {
      const all = await adapter.getCalendarsAsync();
      const local = all.find((c) => c.sourceMetadata.isDeviceLocal)!;
      const google = all.find((c) => c.sourceMetadata.isGoogleAccount)!;

      const localDesc = formatCalendarSourceDescription(local);
      expect(localDesc).toContain('Device-Local');
      expect(localDesc).toContain('offline');

      const googleDesc = formatCalendarSourceDescription(google);
      expect(googleDesc).toContain('Google Account');
      expect(googleDesc).toContain('sync depends on account settings');
    });
  });

  describe('Calendar Selection and Resolution', () => {
    it('resolves destination calendar defaulting to primary writable calendar', async () => {
      const res = await resolveDestinationCalendar(adapter);
      expect(res.error).toBeUndefined();
      expect(res.calendar).toBeDefined();
      expect(res.calendar!.id).toBe('cal_google_primary');
    });

    it('honors explicitly selected calendar ID', async () => {
      await setSelectedCalendarId('cal_local_device');
      const res = await resolveDestinationCalendar(adapter);
      expect(res.calendar!.id).toBe('cal_local_device');
    });

    it('returns permission_denied when calendar permissions are not granted', async () => {
      adapter.permissionStatus = 'denied';
      const res = await resolveDestinationCalendar(adapter);
      expect(res.error).toBe('permission_denied');
      expect(res.calendar).toBeNull();
    });

    it('returns no_writable_calendar when all calendars are read-only or absent', async () => {
      adapter.setCalendarList([
        {
          id: 'read_only_1',
          title: 'Subscribed Only',
          accountName: 'sub@feed.com',
          sourceType: 'SUBSCRIBED',
          ownerAccount: 'sub@feed.com',
          accessLevel: 'read',
          allowsModifications: false,
          sourceMetadata: {
            accountName: 'sub@feed.com',
            sourceType: 'SUBSCRIBED',
            isDeviceLocal: false,
            isGoogleAccount: false,
          },
        },
      ]);

      const res = await resolveDestinationCalendar(adapter);
      expect(res.error).toBe('no_writable_calendar');
      expect(res.calendar).toBeNull();
    });
  });

  describe('Adapter Event CRUD Operations', () => {
    it('creates an event with actionId marker embedded in description', async () => {
      const start = new Date('2026-11-03T15:00:00.000Z');
      const end = new Date('2026-11-03T16:00:00.000Z');

      const eventId = await adapter.createEventAsync('cal_google_primary', {
        title: 'Project Review',
        startDate: start,
        endDate: end,
        actionId: 'req_001_1_create_event',
        description: 'Review Q4 milestones',
      });

      expect(eventId).toBeDefined();
      expect(eventId).toContain('android_evt_');

      const fetched = await adapter.getEventAsync(eventId);
      expect(fetched).toBeDefined();
      expect(fetched!.title).toBe('Project Review');
      expect(fetched!.description).toContain('[LifeOS action_id: req_001_1_create_event]');
      expect(fetched!.description).toContain('Review Q4 milestones');
    });

    it('finds event by marker for crash recovery', async () => {
      const start = new Date('2026-11-03T15:00:00.000Z');
      const end = new Date('2026-11-03T16:00:00.000Z');

      await adapter.createEventAsync('cal_local_device', {
        title: 'Standup',
        startDate: start,
        endDate: end,
        actionId: 'req_crash_recovery_test',
      });

      const found = await adapter.findEventByMarkerAsync('cal_local_device', 'req_crash_recovery_test');
      expect(found).toBeDefined();
      expect(found!.title).toBe('Standup');
    });

    it('updates and deletes events in the adapter', async () => {
      const start = new Date('2026-11-03T15:00:00.000Z');
      const end = new Date('2026-11-03T16:00:00.000Z');

      const eventId = await adapter.createEventAsync('cal_google_primary', {
        title: 'Draft Event',
        startDate: start,
        endDate: end,
      });

      await adapter.updateEventAsync(eventId, { title: 'Updated Title' });
      let event = await adapter.getEventAsync(eventId);
      expect(event!.title).toBe('Updated Title');

      await adapter.deleteEventAsync(eventId);
      event = await adapter.getEventAsync(eventId);
      expect(event).toBeNull();
    });
  });
});

