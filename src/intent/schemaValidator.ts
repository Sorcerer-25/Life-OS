import { z } from 'zod';
import { ActionPlan, AgentName, IntentType } from '../models/ActionPlan';

export const AllowedIntents: [IntentType, ...IntentType[]] = [
  'expense_logged',
  'planned_expense',
  'set_reminder',
  'bill_payment_reminder',
  'add_task',
  'schedule_event',
  'unknown',
];

export const AllowedAgents: [AgentName, ...AgentName[]] = [
  'reminder_agent',
  'finance_agent',
  'task_agent',
  'calendar_agent',
];

export const ActionPlanSourceSchema = z.object({
  type: z.enum(['text', 'voice', 'notification']),
  raw_input: z.string(),
  source_app: z.string().nullable().optional(),
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Timestamp must be a valid ISO 8601 date string',
  }),
});

export const ActionItemSchema = z.object({
  action_id: z.string().min(1, 'action_id cannot be empty'),
  agent: z.enum(AllowedAgents),
  operation: z.string().min(1, 'operation cannot be empty'),
  depends_on: z.array(z.string()).default([]),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const ActionPlanSchema = z.object({
  request_id: z.string().min(1, 'request_id cannot be empty'),
  source: ActionPlanSourceSchema,
  intent: z.enum(AllowedIntents),
  confidence: z.number().min(0, 'confidence must be >= 0').max(1, 'confidence must be <= 1'),
  entities: z.record(z.string(), z.unknown()).default({}),
  missing_fields: z.array(z.string()).default([]),
  required_agents: z.array(z.enum(AllowedAgents)).default([]),
  actions: z.array(ActionItemSchema).default([]),
  requires_confirmation: z.boolean().default(false),
  execution_mode: z.string().default('pending'),
});

export interface ValidationResult {
  success: boolean;
  data?: ActionPlan;
  errors?: string[];
}

/**
 * Validates an unknown object against the ActionPlan schema.
 */
export function validateActionPlan(input: unknown): ValidationResult {
  const result = ActionPlanSchema.safeParse(input);
  if (result.success) {
    return {
      success: true,
      data: result.data as ActionPlan,
    };
  }
  return {
    success: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`
    ),
  };
}

/**
 * Parses and returns the typed ActionPlan, throwing an error if invalid.
 */
export function parseActionPlan(input: unknown): ActionPlan {
  const validation = validateActionPlan(input);
  if (!validation.success || !validation.data) {
    throw new Error(
      `Invalid ActionPlan schema: ${validation.errors?.join('; ')}`
    );
  }
  return validation.data;
}

/**
 * Strips markdown code fencing (e.g. ```json ... ```) and parses JSON string safely.
 */
export function cleanAndParseJson(raw: string): unknown {
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
    cleaned = cleaned.trim();
  }
  return JSON.parse(cleaned);
}

