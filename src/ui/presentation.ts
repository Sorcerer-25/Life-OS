import { AgentResult } from '../models/AgentResult';
import { ActionPlan } from '../models/ActionPlan';
import type { AgentType } from './components/core/IconTile';

export function agentType(value = ''): AgentType {
  if (/calendar|schedule|event/.test(value)) return 'calendar';
  if (/reminder/.test(value)) return 'reminder';
  if (/task/.test(value)) return 'task';
  if (/finance|expense|bill/.test(value)) return 'expense';
  return 'inbox';
}
export function humanLabel(value: string) {
  const labels: Record<string, string> = {
    schedule_event: 'Calendar event', create_event: 'Add to Calendar', calendar_agent: 'Calendar',
    set_reminder: 'Reminder', create_reminder: 'Plan a reminder', reminder_agent: 'Reminder',
    add_task: 'Task', create_task: 'Plan a task', task_agent: 'Task',
    expense_logged: 'Expense', planned_expense: 'Planned expense', create_expense: 'Review expense',
    create_planned_expense: 'Review planned expense', finance_agent: 'Finance', bill_payment_reminder: 'Bill reminder',
  };
  return labels[value] || value.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());
}
export function actionDate(data: Record<string, unknown>): string {
  const date = data.date || data.due_date;
  if (typeof date !== 'string' || !date) return '';
  const time = data.start_time || data.time;
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T${typeof time === 'string' && /^\d{2}:\d{2}/.test(time) ? time : '00:00:00'}` : date);
  if (Number.isNaN(parsed.getTime())) return [date, time].filter(Boolean).join(', ');
  return parsed.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}) });
}
/** Completion copy must reflect actual provider evidence, not just an approved plan. */
export function notificationResult(plan: ActionPlan | null | undefined, raw: unknown): string {
  const results = raw && typeof raw === 'object' ? Object.values(raw) as AgentResult[] : [];
  const lines = results.filter(result => result && typeof result === 'object').map(result => {
    const date = actionDate((plan?.actions.find(action => action.action_id === result.actionId)?.data || {}) as Record<string, unknown>);
    if (result.status !== 'success') return result.status === 'needs_clarification' ? 'More details needed' : 'Action could not be completed';
    if (result.agentName === 'calendar_agent') return ['Added to Calendar', date, result.output?.verified_in_provider === true ? 'Verified' : 'Verification unavailable'].filter(Boolean).join(' · ');
    if (result.agentName === 'reminder_agent') return 'Reminder plan approved · Not scheduled';
    if (result.agentName === 'task_agent') return 'Task plan approved · Not created';
    if (result.agentName === 'finance_agent') return 'Expense saved for review · No payment made';
    return 'Plan approved';
  });
  return lines.length ? lines.join('\n') : 'Plan approved · No execution details available';
}
