import { AgentResult } from '../models/AgentResult';
import { AgentTask } from '../models/AgentTask';
import { CalendarAdapter } from './calendarAdapter';
import {
  getCalendarPreferences,
  resolveDestinationCalendar,
} from './calendarSettings';
import { CalendarMappingRecord, CalendarMappingRepository } from './mappingRepository';
import {
  CalendarDefaultsApplied,
  CalendarErrorCode,
  CalendarEventRecord,
  CreateEventParams,
  UpdateEventParams,
} from './types';

export class CalendarAgent {
  private adapter: CalendarAdapter;
  private mappingRepo: CalendarMappingRepository;

  constructor(
    adapter?: CalendarAdapter,
    mappingRepo?: CalendarMappingRepository
  ) {
    if (adapter) {
      this.adapter = adapter;
    } else {
      // Lazy load to prevent ESM errors in test environments
      const { ExpoCalendarAdapter } = require('./expoCalendarAdapter');
      this.adapter = new ExpoCalendarAdapter();
    }

    if (mappingRepo) {
      this.mappingRepo = mappingRepo;
    } else {
      // Lazy load to prevent ESM errors in test environments
      const { SQLiteMappingRepository } = require('./sqliteMappingRepository');
      this.mappingRepo = new SQLiteMappingRepository();
    }
  }

  /**
   * Dispatches AgentTask from the Supervisor.
   */
  public async execute(task: AgentTask): Promise<AgentResult> {
    if (task.operation === 'create_event') {
      return this.createEventFromTask(task);
    }

    return {
      taskId: task.taskId,
      actionId: task.actionId,
      agentName: 'calendar_agent',
      status: 'failure',
      message: `Unsupported calendar operation: ${task.operation}`,
      error: 'unsupported_operation',
    };
  }

  /**
   * Complete Create Event Flow with Idempotency & Crash Recovery:
   * 1. Check permissions.
   * 2. Resolve destination calendar.
   * 3. Validate & parse date/time (requires start_time; defaults end_time if missing).
   * 4. Idempotency check:
   *    - If already created, verifies event in provider and returns duplicate: true.
   *    - If deleted outside LifeOS, reports event_not_found (never silently recreates).
   * 5. Crash recovery check:
   *    - If pending row exists, searches provider by action_id marker.
   * 6. Write pending row -> Insert into native provider -> Verify in provider -> Mark created.
   */
  public async createEventFromTask(task: AgentTask): Promise<AgentResult> {
    const actionId = task.actionId;
    const requestId = task.requestId;
    const data = task.data;

    // 1. Permissions & Destination Calendar
    const calResolution = await resolveDestinationCalendar(this.adapter);
    if (!calResolution.calendar) {
      const errCode: CalendarErrorCode = calResolution.error || 'no_writable_calendar';
      return {
        taskId: task.taskId,
        actionId,
        agentName: 'calendar_agent',
        status: errCode === 'permission_denied' ? 'failure' : 'needs_clarification',
        message:
          errCode === 'permission_denied'
            ? 'Calendar permission was denied. Please grant calendar permission in system settings to schedule events.'
            : 'No writable calendar found on the device. Please configure a destination calendar.',
        output: {
          operation: 'create_event',
          action_id: actionId,
          error_code: errCode,
          duplicate: false,
          verified_in_provider: false,
        },
        error: errCode,
      };
    }

    const destinationCalendar = calResolution.calendar;

    // 2. Validate & Parse Date and Time
    const title = (data.title as string) || 'Untitled Event';
    const dateStr = (data.date as string) || (data.due_date as string);
    const startTimeStr = (data.start_time as string) || (data.time as string);
    const endTimeStr = data.end_time as string | undefined;
    const location = data.location as string | undefined;

    if (!dateStr || !startTimeStr) {
      return {
        taskId: task.taskId,
        actionId,
        agentName: 'calendar_agent',
        status: 'needs_clarification',
        message: 'Start time and date are required to schedule a calendar event.',
        output: {
          operation: 'create_event',
          action_id: actionId,
          error_code: 'invalid_time' as CalendarErrorCode,
          duplicate: false,
          verified_in_provider: false,
        },
        error: 'invalid_time',
      };
    }

    const startDateTime = this.parseDateTime(dateStr, startTimeStr);
    if (!startDateTime || isNaN(startDateTime.getTime())) {
      return {
        taskId: task.taskId,
        actionId,
        agentName: 'calendar_agent',
        status: 'needs_clarification',
        message: `Could not parse start date/time: "${dateStr} ${startTimeStr}".`,
        output: {
          operation: 'create_event',
          action_id: actionId,
          error_code: 'invalid_time' as CalendarErrorCode,
          duplicate: false,
          verified_in_provider: false,
        },
        error: 'invalid_time',
      };
    }

    // Parse or default end time
    const prefs = await getCalendarPreferences();
    let endDateTime: Date;
    let defaultsApplied: CalendarDefaultsApplied | undefined = undefined;

    if (endTimeStr) {
      const parsedEnd = this.parseDateTime(dateStr, endTimeStr);
      if (parsedEnd && !isNaN(parsedEnd.getTime()) && parsedEnd > startDateTime) {
        endDateTime = parsedEnd;
      } else {
        // Fallback to default duration if end time is invalid or before start
        endDateTime = new Date(startDateTime.getTime() + prefs.defaultDurationMinutes * 60 * 1000);
        defaultsApplied = {
          durationMinutes: prefs.defaultDurationMinutes,
          defaultEndTime: true,
        };
      }
    } else {
      endDateTime = new Date(startDateTime.getTime() + prefs.defaultDurationMinutes * 60 * 1000);
      defaultsApplied = {
        durationMinutes: prefs.defaultDurationMinutes,
        defaultEndTime: true,
      };
    }

    // 3. Idempotency Check in Mapping Repository
    const existing = await this.mappingRepo.findByActionId(actionId);

    if (existing && existing.status === 'created' && existing.android_event_id) {
      // Check if event still exists on device
      const nativeEvent = await this.adapter.getEventAsync(existing.android_event_id);
      if (nativeEvent) {
        return {
          taskId: task.taskId,
          actionId,
          agentName: 'calendar_agent',
          status: 'success',
          message: `Event already exists in calendar (duplicate request). Event ID: ${existing.android_event_id}.`,
          output: {
            operation: 'create_event',
            action_id: actionId,
            android_event_id: existing.android_event_id,
            calendar_id: existing.calendar_id,
            calendar_source: {
              account_name: destinationCalendar.accountName,
              source_type: destinationCalendar.sourceType,
              is_device_local: destinationCalendar.sourceMetadata.isDeviceLocal,
              is_google_account: destinationCalendar.sourceMetadata.isGoogleAccount,
            },
            duplicate: true,
            verified_in_provider: true,
            defaults_applied: defaultsApplied,
          },
        };
      } else {
        // Event was deleted outside LifeOS — do NOT recreate silently!
        return {
          taskId: task.taskId,
          actionId,
          agentName: 'calendar_agent',
          status: 'failure',
          message:
            'Event was previously created by LifeOS but has been deleted outside the app in the device calendar.',
          output: {
            operation: 'create_event',
            action_id: actionId,
            android_event_id: existing.android_event_id,
            calendar_id: existing.calendar_id,
            duplicate: true,
            verified_in_provider: false,
            error_code: 'event_not_found' as CalendarErrorCode,
          },
          error: 'event_not_found',
        };
      }
    }

    // 4. Crash Recovery Check
    if (existing && existing.status === 'pending') {
      const recoveredEvent = await this.adapter.findEventByMarkerAsync(
        existing.calendar_id || destinationCalendar.id,
        actionId
      );
      if (recoveredEvent) {
        await this.mappingRepo.markCreated(actionId, recoveredEvent.id);
        return {
          taskId: task.taskId,
          actionId,
          agentName: 'calendar_agent',
          status: 'success',
          message: `Crash recovery: verified event previously written to calendar. Event ID: ${recoveredEvent.id}.`,
          output: {
            operation: 'create_event',
            action_id: actionId,
            android_event_id: recoveredEvent.id,
            calendar_id: destinationCalendar.id,
            calendar_source: {
              account_name: destinationCalendar.accountName,
              source_type: destinationCalendar.sourceType,
              is_device_local: destinationCalendar.sourceMetadata.isDeviceLocal,
              is_google_account: destinationCalendar.sourceMetadata.isGoogleAccount,
            },
            duplicate: true,
            verified_in_provider: true,
            defaults_applied: defaultsApplied,
          },
        };
      }
    }

    // 5. Write Pending Row First
    await this.mappingRepo.createPending(actionId, requestId, destinationCalendar.id);

    // 6. Insert Event into Native Calendar Provider
    try {
      const createParams: CreateEventParams = {
        title,
        startDate: startDateTime,
        endDate: endDateTime,
        allDay: false,
        location,
        actionId,
        alarms: prefs.enableCalendarAlarms ? [{ relativeOffset: -15 }] : undefined,
      };

      const androidEventId = await this.adapter.createEventAsync(
        destinationCalendar.id,
        createParams
      );

      // 7. Verify in Provider by Reading Back
      const verified = await this.adapter.getEventAsync(androidEventId);
      const verifiedInProvider = Boolean(verified);

      // 8. Update Mapping to Created
      await this.mappingRepo.markCreated(actionId, androidEventId);

      const honestSyncNotice = destinationCalendar.sourceMetadata.isGoogleAccount
        ? `Inserted into "${destinationCalendar.title}" (${destinationCalendar.accountName}); Google sync depends on account sync settings.`
        : `Inserted into device-local calendar "${destinationCalendar.title}" (offline on device; no cloud sync).`;

      return {
        taskId: task.taskId,
        actionId,
        agentName: 'calendar_agent',
        status: 'success',
        message: honestSyncNotice,
        output: {
          operation: 'create_event',
          action_id: actionId,
          android_event_id: androidEventId,
          calendar_id: destinationCalendar.id,
          calendar_source: {
            account_name: destinationCalendar.accountName,
            source_type: destinationCalendar.sourceType,
            is_device_local: destinationCalendar.sourceMetadata.isDeviceLocal,
            is_google_account: destinationCalendar.sourceMetadata.isGoogleAccount,
          },
          duplicate: false,
          defaults_applied: defaultsApplied,
          verified_in_provider: verifiedInProvider,
        },
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Calendar provider error occurred during insertion';
      await this.mappingRepo.markFailed(actionId, errMsg);

      return {
        taskId: task.taskId,
        actionId,
        agentName: 'calendar_agent',
        status: 'failure',
        message: `Failed to insert event into calendar: ${errMsg}`,
        output: {
          operation: 'create_event',
          action_id: actionId,
          calendar_id: destinationCalendar.id,
          error_code: 'provider_error' as CalendarErrorCode,
          duplicate: false,
          verified_in_provider: false,
        },
        error: errMsg,
      };
    }
  }

  /**
   * Updates an event that LifeOS previously created.
   */
  public async updateEvent(
    actionId: string,
    updates: UpdateEventParams
  ): Promise<AgentResult> {
    const mapping = await this.mappingRepo.findByActionId(actionId);
    if (!mapping || !mapping.android_event_id) {
      return {
        taskId: `update_${Date.now()}`,
        actionId,
        agentName: 'calendar_agent',
        status: 'failure',
        message: 'Cannot update: event was not found in LifeOS mapping table.',
        error: 'event_not_found',
      };
    }

    try {
      await this.adapter.updateEventAsync(mapping.android_event_id, updates);
      await this.mappingRepo.markUpdated(actionId);

      return {
        taskId: `update_${Date.now()}`,
        actionId,
        agentName: 'calendar_agent',
        status: 'success',
        message: `Event ${mapping.android_event_id} updated successfully.`,
        output: {
          operation: 'update_event',
          action_id: actionId,
          android_event_id: mapping.android_event_id,
        },
      };
    } catch (err: any) {
      return {
        taskId: `update_${Date.now()}`,
        actionId,
        agentName: 'calendar_agent',
        status: 'failure',
        message: `Failed to update event: ${err?.message}`,
        error: err?.message,
      };
    }
  }

  /**
   * Deletes an event that LifeOS created (called after user confirmation).
   */
  public async deleteEvent(actionId: string): Promise<AgentResult> {
    const mapping = await this.mappingRepo.findByActionId(actionId);
    if (!mapping || !mapping.android_event_id) {
      return {
        taskId: `del_${Date.now()}`,
        actionId,
        agentName: 'calendar_agent',
        status: 'failure',
        message: 'Cannot delete: event was not found in LifeOS mapping table.',
        error: 'event_not_found',
      };
    }

    try {
      await this.adapter.deleteEventAsync(mapping.android_event_id);
      await this.mappingRepo.markDeleted(actionId);

      return {
        taskId: `del_${Date.now()}`,
        actionId,
        agentName: 'calendar_agent',
        status: 'success',
        message: `Event ${mapping.android_event_id} deleted successfully from calendar.`,
        output: {
          operation: 'delete_event',
          action_id: actionId,
          android_event_id: mapping.android_event_id,
        },
      };
    } catch (err: any) {
      return {
        taskId: `del_${Date.now()}`,
        actionId,
        agentName: 'calendar_agent',
        status: 'failure',
        message: `Failed to delete event: ${err?.message}`,
        error: err?.message,
      };
    }
  }

  /**
   * Lists all LifeOS-created events with their live provider records.
   */
  public async listCreatedEvents(): Promise<
    Array<{ mapping: CalendarMappingRecord; event: CalendarEventRecord | null }>
  > {
    const mappings = await this.mappingRepo.listAll();
    const results: Array<{ mapping: CalendarMappingRecord; event: CalendarEventRecord | null }> = [];

    for (const m of mappings) {
      if (m.status !== 'deleted' && m.android_event_id) {
        const ev = await this.adapter.getEventAsync(m.android_event_id);
        results.push({ mapping: m, event: ev });
      } else {
        results.push({ mapping: m, event: null });
      }
    }

    return results;
  }

  private parseDateTime(dateStr: string, timeStr: string): Date | null {
    try {
      // If timeStr is already a full ISO string
      if (timeStr.includes('T')) {
        return new Date(timeStr);
      }

      // Format: YYYY-MM-DD
      const dateParts = dateStr.split('-').map(Number);
      if (dateParts.length !== 3) return null;
      const [year, month, day] = dateParts;

      // Format: HH:mm:ss or HH:mm or "3 PM"
      let hours = 0;
      let minutes = 0;
      let seconds = 0;

      if (timeStr.includes(':')) {
        const timeParts = timeStr.split(':').map((p) => parseInt(p, 10));
        hours = timeParts[0] || 0;
        minutes = timeParts[1] || 0;
        seconds = timeParts[2] || 0;
      } else {
        // e.g. "3 PM", "10 AM"
        const match = timeStr.match(/^(\d{1,2})\s*(am|pm)?$/i);
        if (match) {
          hours = parseInt(match[1], 10);
          const mer = match[2]?.toLowerCase();
          if (mer === 'pm' && hours < 12) hours += 12;
          if (mer === 'am' && hours === 12) hours = 0;
        } else {
          return null;
        }
      }

      return new Date(year, month - 1, day, hours, minutes, seconds);
    } catch {
      return null;
    }
  }
}
