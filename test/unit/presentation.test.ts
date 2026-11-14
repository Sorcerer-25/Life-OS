import { actionDate, agentType, notificationResult } from '../../src/ui/presentation';
import { ActionPlan } from '../../src/models/ActionPlan';

describe('User-facing execution summaries', () => {
  it('only says Verified when the calendar provider has verified the event', () => {
    const raw = { action1: { actionId: 'action1', agentName: 'calendar_agent', status: 'success', output: { verified_in_provider: true } } };
    expect(notificationResult(null, raw)).toBe('Added to Calendar · Verified');
    raw.action1.output.verified_in_provider = false;
    expect(notificationResult(null, raw)).toBe('Added to Calendar · Verification unavailable');
  });
  it('does not claim placeholder reminder or task executors created anything', () => {
    expect(notificationResult(null, { one: { agentName: 'reminder_agent', status: 'success' } })).toContain('Not scheduled');
    expect(notificationResult(null, { one: { agentName: 'task_agent', status: 'success' } })).toContain('Not created');
    expect(notificationResult(null, null)).not.toContain('Verified');
  });
  it('shows the scheduled date from the action associated with the execution result', () => {
    const data = { date: '2026-11-13', start_time: '17:00' };
    const plan = { actions: [{ action_id: 'calendar1', data }] } as unknown as ActionPlan;
    const summary = notificationResult(plan, { calendar1: { actionId: 'calendar1', agentName: 'calendar_agent', status: 'success', output: { verified_in_provider: true } } });
    expect(summary).toContain(actionDate(data));
    expect(actionDate(data)).not.toBe('');
  });
  it('uses the same calendar, reminder, task and inbox identity for actual agent names', () => {
    expect(['calendar_agent', 'reminder_agent', 'task_agent', 'notification'].map(agentType)).toEqual(['calendar', 'reminder', 'task', 'inbox']);
  });
});
