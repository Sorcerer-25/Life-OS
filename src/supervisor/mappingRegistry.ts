import { AgentName } from '../models/ActionPlan';
import { SupportedIntent } from '../models/IntentAnalysis';

export interface OperationMapping {
  operation: string;
  agent: AgentName;
  condition?: (entities: Record<string, unknown>) => boolean;
  requiredEntities: string[];
  requiresConfirmation: boolean;
}

/**
 * Central Mapping Registry (Single Source of Truth)
 * Owns all intent -> agent & operation rules with conditions.
 */
export const SUPERVISOR_MAPPING_REGISTRY: Record<SupportedIntent, OperationMapping[]> = {
  set_reminder: [
    {
      operation: 'create_reminder',
      agent: 'reminder_agent',
      requiredEntities: ['title', 'due_date'],
      requiresConfirmation: false,
    },
  ],
  bill_payment_reminder: [
    {
      operation: 'create_reminder',
      agent: 'reminder_agent',
      requiredEntities: ['bill_type', 'due_date'],
      requiresConfirmation: false,
    },
    {
      operation: 'create_planned_expense',
      agent: 'finance_agent',
      condition: (entities) => entities.amount !== undefined && entities.amount !== null,
      requiredEntities: ['bill_type'],
      requiresConfirmation: true, // All financial operations require confirmation
    },
  ],
  planned_expense: [
    {
      operation: 'create_planned_expense',
      agent: 'finance_agent',
      requiredEntities: ['amount', 'currency'],
      requiresConfirmation: true, // All financial operations require confirmation
    },
  ],
  expense_logged: [
    {
      operation: 'create_expense',
      agent: 'finance_agent',
      requiredEntities: ['amount', 'currency', 'description'],
      requiresConfirmation: true, // All financial operations require confirmation
    },
  ],
  add_task: [
    {
      operation: 'create_task',
      agent: 'task_agent',
      requiredEntities: ['title'],
      requiresConfirmation: false,
    },
  ],
  schedule_event: [
    {
      operation: 'create_event',
      agent: 'calendar_agent',
      requiredEntities: ['title', 'due_date', 'start_time'],
      requiresConfirmation: false,
    },
  ],
  unknown: [],
};

