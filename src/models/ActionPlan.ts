export type IntentType =
  | 'expense_logged'
  | 'planned_expense'
  | 'set_reminder'
  | 'bill_payment_reminder'
  | 'add_task'
  | 'schedule_event'
  | 'unknown';

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

export interface ActionItem {
  action_id: string;
  agent: AgentName;
  operation: string;
  depends_on: string[];
  data: Record<string, unknown>;
}

export interface ActionPlan {
  request_id: string;
  source: ActionPlanSource;
  intent: IntentType;
  confidence: number; // 0.0 - 1.0 (model-reported)
  entities: Record<string, unknown>;
  missing_fields: string[];
  required_agents: AgentName[];
  actions: ActionItem[];
  requires_confirmation: boolean;
  execution_mode: string;
}

