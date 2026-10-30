import { z } from 'zod';
import { SupportedIntent } from './IntentAnalysis';

/**
 * Shared Canonical Entity Vocabulary
 * Independent schema defining canonical entity names, types, and required fields per intent.
 * Both the Intent Identifier and the Supervisor rely on this schema.
 */

export interface CanonicalEntities {
  amount?: number;
  currency?: string;
  category?: string;
  description?: string;
  title?: string;
  due_date?: string; // ISO date: YYYY-MM-DD
  due_date_text?: string; // Original relative phrase, e.g. "tomorrow", "next Friday"
  start_time?: string; // ISO datetime or ISO time HH:mm:ss
  end_time?: string;
  time_text?: string; // Original time phrase, e.g. "3 PM", "10 AM"
  duration?: string;
  bill_type?: string;
  merchant?: string;
  recipient?: string; // Person/recipient when explicitly stated, e.g. "Rahul"
  status?: string;
  type?: string;
  priority?: string;
  location?: string;
  [key: string]: unknown;
}

export const CanonicalEntitiesSchema = z
  .object({
    amount: z.number().positive().optional(),
    currency: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'due_date must be in ISO format YYYY-MM-DD')
      .optional(),
    due_date_text: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    time_text: z.string().optional(),
    duration: z.string().optional(),
    bill_type: z.string().min(1).optional(),
    merchant: z.string().min(1).optional(),
    recipient: z.string().min(1).optional(),
    status: z.string().optional(),
    type: z.string().optional(),
    priority: z.string().optional(),
    location: z.string().optional(),
  })
  .passthrough();

export interface IntentEntityRequirements {
  required: string[];
  optional: string[];
}

export const CANONICAL_INTENT_ENTITIES: Record<SupportedIntent, IntentEntityRequirements> = {
  expense_logged: {
    required: ['amount', 'currency', 'description'],
    optional: ['category', 'merchant', 'due_date', 'due_date_text', 'type'],
  },
  planned_expense: {
    required: ['amount', 'currency', 'description'],
    optional: ['category', 'merchant', 'bill_type', 'due_date', 'due_date_text', 'status'],
  },
  set_reminder: {
    required: ['title', 'due_date'],
    optional: ['due_date_text', 'start_time', 'time_text', 'category', 'recipient'],
  },
  bill_payment_reminder: {
    required: ['bill_type', 'due_date'],
    optional: ['amount', 'currency', 'due_date_text', 'merchant', 'title'],
  },
  add_task: {
    required: ['title'],
    optional: ['due_date', 'due_date_text', 'start_time', 'time_text', 'recipient', 'category', 'priority'],
  },
  schedule_event: {
    required: ['title', 'due_date', 'start_time'],
    optional: ['end_time', 'duration', 'due_date_text', 'time_text', 'location'],
  },
  unknown: {
    required: [],
    optional: ['description', 'status'],
  },
};

/**
 * Checks for missing required canonical entities for a given intent.
 */
export function computeMissingEntities(
  intent: SupportedIntent,
  entities: Record<string, unknown>
): string[] {
  const reqs = CANONICAL_INTENT_ENTITIES[intent];
  if (!reqs) return [];

  const missing: string[] = [];
  for (const field of reqs.required) {
    const val = entities[field];
    if (val === undefined || val === null || val === '') {
      // Special allowance: description can be satisfied by merchant or bill_type if present
      if (field === 'description' && (entities.merchant || entities.bill_type)) {
        continue;
      }
      missing.push(field);
    }
  }

  return missing;
}
