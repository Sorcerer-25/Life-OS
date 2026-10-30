import { DetectedIntent } from './IntentAnalysis';

export type AgentName =
  | 'reminder_agent'
  | 'finance_agent'
  | 'task_agent'
  | 'calendar_agent';

export interface ActionPlanSource {
  type: 'text' | 'voice' | 'notification';
  raw_input: string;
  source_app?: string | null;
  timestamp: string; // ISO 8601
}

// Discriminated Unions for Action Payloads (Section 5)
export interface ExpensePayload {
  operation: 'create_expense';
  amount: number;
  currency: string;
  description: string;
  date?: string;
  category?: string;
  type?: 'expense' | 'income' | 'refund';
}

export interface PlannedExpensePayload {
  operation: 'create_planned_expense';
  amount?: number;
  currency?: string;
  description: string;
  bill_type?: string;
  due_date?: string;
  category?: string;
  status?: string;
}

export interface ReminderPayload {
  operation: 'create_reminder';
  title: string;
  due_date?: string;
  time?: string;
  recipient?: string;
  amount?: number;
  currency?: string;
}

export interface TaskPayload {
  operation: 'create_task';
  title: string;
  due_date?: string;
  time?: string;
  recipient?: string;
  priority?: string;
}

export interface CalendarEventPayload {
  operation: 'create_event';
  title: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  duration?: string;
  location?: string;
}

export type ActionPayload =
  | ExpensePayload
  | PlannedExpensePayload
  | ReminderPayload
  | TaskPayload
  | CalendarEventPayload
  | Record<string, unknown>;

export type ActionStatus = 'ready' | 'needs_clarification' | 'blocked' | 'rejected';

export interface ActionItem {
  action_id: string; // Deterministic: e.g. req_001_1_create_reminder
  sequence: number; // originating intent sequence
  agent: AgentName;
  operation: string;
  data: ActionPayload;
  depends_on: string[]; // action_id dependencies
  requires_confirmation: boolean; // true for any financial transactions
  status: ActionStatus;
  reason?: string;
  clarification_prompt?: string;
}

export type SupervisorWorkflowStatus =
  | 'ready'
  | 'partial'
  | 'needs_clarification'
  | 'unsupported'
  | 'rejected'
  | 'completed';

export interface SupervisorDecision {
  workflow_status: SupervisorWorkflowStatus;
  reasons: string[];
  clarification_needed: boolean;
  clarification_questions: string[];
  unsupported_explanations: string[];
}

export interface ActionPlan {
  request_id: string;
  source: ActionPlanSource;
  intents: DetectedIntent[];
  required_agents: AgentName[];
  actions: ActionItem[];
  decision: SupervisorDecision;
  execution_mode: 'pending' | 'dry_run' | 'dispatched';
}
