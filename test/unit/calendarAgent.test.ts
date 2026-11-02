import { CalendarAgent } from '../../src/calendar/calendarAgent';
import {
  setSelectedCalendarId,
  updateCalendarPreferences,
} from '../../src/calendar/calendarSettings';
import { MemoryMappingRepository } from '../../src/calendar/memoryMappingRepository';
import { MockCalendarAdapter } from '../../src/calendar/mockCalendarAdapter';
import { AgentTask } from '../../src/models/AgentTask';
import { SUPERVISOR_MAPPING_REGISTRY } from '../../src/supervisor/mappingRegistry';

describe('CalendarAgent Automated Test Suite', () => {
  let adapter: MockCalendarAdapter;
  let mappingRepo: MemoryMappingRepository;
  let agent: CalendarAgent;

  beforeEach(async () => {
    adapter = new MockCalendarAdapter();
    mappingRepo = new MemoryMappingRepository();
    agent = new CalendarAgent(adapter, mappingRepo);

    await setSelectedCalendarId('cal_google_primary');
    await updateCalendarPreferences({
      selectedCalendarId: 'cal_google_primary',
      defaultDurationMinutes: 60,
      enableCalendarAlarms: false,
      createCalendarEventForTasks: false,
    });
  });

  // 1. Create Event
  it('1. Create: successfully creates an event, writes pending row first, embeds marker, marks created', async () => {
    const task: AgentTask = {
      taskId: 'task_001',
      requestId: 'req_001',
      actionId: 'req_001_1_create_event',
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'Project Architecture Review',
        date: '2026-11-05',
        start_time: '14:00:00',
        end_time: '15:30:00',
        location: 'Room 302',
      },
    };

    const res = await agent.execute(task);

    expect(res.status).toBe('success');
    expect(res.output?.operation).toBe('create_event');
    expect(res.output?.action_id).toBe('req_001_1_create_event');
    expect(res.output?.android_event_id).toBeDefined();
    expect(res.output?.verified_in_provider).toBe(true);
    expect(res.output?.duplicate).toBe(false);
    expect(res.message).toContain('Inserted into');
    expect(res.message).toContain('Google sync depends on account sync settings');

    // Verify mapping row in SQLite / mapping repository
    const mapping = await mappingRepo.findByActionId('req_001_1_create_event');
    expect(mapping).toBeDefined();
    expect(mapping!.status).toBe('created');
    expect(mapping!.android_event_id).toBe(res.output?.android_event_id);
    expect(mapping!.calendar_id).toBe('cal_google_primary');

    // Verify event in provider has actionId marker embedded
    const nativeEvent = await adapter.getEventAsync(res.output!.android_event_id as string);
    expect(nativeEvent).toBeDefined();
    expect(nativeEvent!.title).toBe('Project Architecture Review');
    expect(nativeEvent!.description).toContain('[LifeOS action_id: req_001_1_create_event]');
  });

  // 2. Duplicate Create (Idempotency)
  it('2. Duplicate Create: calling again returns duplicate: true and existing event id without re-inserting', async () => {
    const task: AgentTask = {
      taskId: 'task_002',
      requestId: 'req_002',
      actionId: 'req_002_1_create_event',
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'Weekly Standup',
        date: '2026-11-06',
        start_time: '09:30:00',
      },
    };

    // First call
    const firstRes = await agent.execute(task);
    expect(firstRes.status).toBe('success');
    const firstEventId = firstRes.output?.android_event_id;
    const initialEventCount = adapter.getAllEvents().length;

    // Duplicate call with same action_id
    const secondRes = await agent.execute(task);
    expect(secondRes.status).toBe('success');
    expect(secondRes.output?.duplicate).toBe(true);
    expect(secondRes.output?.android_event_id).toBe(firstEventId);
    expect(secondRes.output?.verified_in_provider).toBe(true);
    expect(secondRes.message).toContain('duplicate request');

    // Ensure no second event was inserted into provider
    expect(adapter.getAllEvents().length).toBe(initialEventCount);
  });

  // 3. Event Deleted Outside LifeOS
  it('3. Event Deleted Outside LifeOS: reports event_not_found and does not silently recreate', async () => {
    const task: AgentTask = {
      taskId: 'task_003',
      requestId: 'req_003',
      actionId: 'req_003_1_create_event',
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'One-time Sync',
        date: '2026-11-07',
        start_time: '11:00:00',
      },
    };

    const firstRes = await agent.execute(task);
    const eventId = firstRes.output?.android_event_id as string;

    // Simulate user deleting the event outside LifeOS directly in Google Calendar / Device Calendar
    adapter.simulateExternalDeletion(eventId);

    // Call again with same action_id
    const secondRes = await agent.execute(task);
    expect(secondRes.status).toBe('failure');
    expect(secondRes.error).toBe('event_not_found');
    expect(secondRes.output?.error_code).toBe('event_not_found');
    expect(secondRes.message).toContain('deleted outside the app');

    // Ensure it was NOT silently recreated
    expect(await adapter.getEventAsync(eventId)).toBeNull();
  });

  // 4. Pending-row Recovery
  it('4. Crash Recovery: recovers from pending row by searching marker before re-inserting', async () => {
    const actionId = 'req_crash_recovery_001';
    const requestId = 'req_crash';

    // Simulate an app crash midway: event was inserted into provider, but row remained 'pending'
    const start = new Date('2026-11-08T10:00:00.000Z');
    const end = new Date('2026-11-08T11:00:00.000Z');

    const nativeId = await adapter.createEventAsync('cal_google_primary', {
      title: 'Crash Recovered Meeting',
      startDate: start,
      endDate: end,
      actionId,
    });

    // Set pending row in mapping table
    mappingRepo.setRecordDirectly({
      action_id: actionId,
      request_id: requestId,
      android_event_id: null,
      calendar_id: 'cal_google_primary',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    });

    const task: AgentTask = {
      taskId: 'task_crash',
      requestId,
      actionId,
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'Crash Recovered Meeting',
        date: '2026-11-08',
        start_time: '10:00:00',
      },
    };

    const res = await agent.execute(task);
    expect(res.status).toBe('success');
    expect(res.output?.duplicate).toBe(true);
    expect(res.output?.android_event_id).toBe(nativeId);
    expect(res.message).toContain('Crash recovery');

    // Verify mapping row was transitioned to 'created'
    const updatedMapping = await mappingRepo.findByActionId(actionId);
    expect(updatedMapping?.status).toBe('created');
    expect(updatedMapping?.android_event_id).toBe(nativeId);
  });

  // 5. Missing End Time Default
  it('5. Missing End Time: defaults to start + 60 minutes and marks default in result', async () => {
    const task: AgentTask = {
      taskId: 'task_005',
      requestId: 'req_005',
      actionId: 'req_005_1_create_event',
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'Interview Candidate',
        date: '2026-11-09',
        start_time: '15:00:00',
        // end_time is intentionally omitted
      },
    };

    const res = await agent.execute(task);
    expect(res.status).toBe('success');
    expect(res.output?.defaults_applied).toEqual({
      durationMinutes: 60,
      defaultEndTime: true,
    });

    const event = await adapter.getEventAsync(res.output!.android_event_id as string);
    const start = new Date(event!.startDate);
    const end = new Date(event!.endDate);
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000); // exactly 60 minutes
  });

  // 6. Missing Start Time Clarification
  it('6. Missing Start Time: returns needs_clarification and never guesses', async () => {
    const task: AgentTask = {
      taskId: 'task_006',
      requestId: 'req_006',
      actionId: 'req_006_1_create_event',
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'Unscheduled Discussion',
        date: '2026-11-10',
        // start_time is missing
      },
    };

    const res = await agent.execute(task);
    expect(res.status).toBe('needs_clarification');
    expect(res.error).toBe('invalid_time');
    expect(res.output?.error_code).toBe('invalid_time');
    expect(res.message).toContain('Start time');
  });

  // 7. Permission Denied
  it('7. Permission Denied: returns failure with permission_denied error code without crashing', async () => {
    adapter.permissionStatus = 'denied';

    const task: AgentTask = {
      taskId: 'task_007',
      requestId: 'req_007',
      actionId: 'req_007_1_create_event',
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'Blocked Event',
        date: '2026-11-11',
        start_time: '10:00:00',
      },
    };

    const res = await agent.execute(task);
    expect(res.status).toBe('failure');
    expect(res.error).toBe('permission_denied');
    expect(res.output?.error_code).toBe('permission_denied');
    expect(res.message).toContain('permission was denied');
  });

  // 8. No Writable Calendar
  it('8. No Writable Calendar: returns needs_clarification with no_writable_calendar', async () => {
    adapter.setCalendarList([]); // No calendars on device

    const task: AgentTask = {
      taskId: 'task_008',
      requestId: 'req_008',
      actionId: 'req_008_1_create_event',
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'Orphan Event',
        date: '2026-11-12',
        start_time: '10:00:00',
      },
    };

    const res = await agent.execute(task);
    expect(res.status).toBe('needs_clarification');
    expect(res.error).toBe('no_writable_calendar');
    expect(res.output?.error_code).toBe('no_writable_calendar');
  });

  // 9. Provider Internal Error
  it('9. Provider Error: marks mapping row failed and returns error result', async () => {
    adapter.simulateProviderError = true;

    const task: AgentTask = {
      taskId: 'task_009',
      requestId: 'req_009',
      actionId: 'req_009_1_create_event',
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'Failing Event',
        date: '2026-11-13',
        start_time: '10:00:00',
      },
    };

    const res = await agent.execute(task);
    expect(res.status).toBe('failure');
    expect(res.output?.error_code).toBe('provider_error');

    const mapping = await mappingRepo.findByActionId('req_009_1_create_event');
    expect(mapping?.status).toBe('failed');
    expect(mapping?.last_error).toContain('simulated');
  });

  // 10. Update Event
  it('10. Update Event: updates native event and mapping timestamp for LifeOS-created event', async () => {
    const task: AgentTask = {
      taskId: 'task_010',
      requestId: 'req_010',
      actionId: 'req_010_1_create_event',
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'Original Title',
        date: '2026-11-14',
        start_time: '14:00:00',
      },
    };

    const createRes = await agent.execute(task);
    const actionId = 'req_010_1_create_event';

    const updateRes = await agent.updateEvent(actionId, {
      title: 'Updated Meeting Title',
      location: 'Conference Room B',
    });

    expect(updateRes.status).toBe('success');
    expect(updateRes.output?.operation).toBe('update_event');

    const native = await adapter.getEventAsync(createRes.output!.android_event_id as string);
    expect(native?.title).toBe('Updated Meeting Title');
    expect(native?.location).toBe('Conference Room B');

    const mapping = await mappingRepo.findByActionId(actionId);
    expect(mapping?.status).toBe('updated');
  });

  // 11. Delete Event
  it('11. Delete Event: deletes event from native provider and marks mapping deleted', async () => {
    const task: AgentTask = {
      taskId: 'task_011',
      requestId: 'req_011',
      actionId: 'req_011_1_create_event',
      agentName: 'calendar_agent',
      operation: 'create_event',
      data: {
        title: 'Event To Delete',
        date: '2026-11-15',
        start_time: '16:00:00',
      },
    };

    const createRes = await agent.execute(task);
    const androidEventId = createRes.output!.android_event_id as string;
    const actionId = 'req_011_1_create_event';

    const delRes = await agent.deleteEvent(actionId);
    expect(delRes.status).toBe('success');
    expect(delRes.output?.operation).toBe('delete_event');

    // Event should be gone from provider
    expect(await adapter.getEventAsync(androidEventId)).toBeNull();

    // Mapping should be 'deleted'
    const mapping = await mappingRepo.findByActionId(actionId);
    expect(mapping?.status).toBe('deleted');
  });

  // 12. Optional Task Calendar Sync Config Flag
  it('12. Task Calendar Sync: when enabled, creates a calendar event for tasks with due date and time', async () => {
    // Disabled by default
    await updateCalendarPreferences({ createCalendarEventForTasks: false });
    const mappingEntriesDefault = SUPERVISOR_MAPPING_REGISTRY.add_task;
    const calendarOpDefault = mappingEntriesDefault.find((m) => m.operation === 'create_event');
    expect(calendarOpDefault).toBeDefined();
    // Condition should return false when disabled
    expect(calendarOpDefault!.condition!({ title: 'Task', due_date: '2026-11-20', start_time: '10:00:00' })).toBe(false);

    // Enabled via settings
    await updateCalendarPreferences({ createCalendarEventForTasks: true });
    expect(calendarOpDefault!.condition!({ title: 'Task', due_date: '2026-11-20', start_time: '10:00:00' })).toBe(true);
    // Task without start_time should still return false
    expect(calendarOpDefault!.condition!({ title: 'Task', due_date: '2026-11-20' })).toBe(false);
  });
});

