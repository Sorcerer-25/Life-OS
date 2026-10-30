import { z } from 'zod';
import { CanonicalEntitiesSchema } from '../models/canonicalEntities';
import { IntentAnalysis, SupportedIntent } from '../models/IntentAnalysis';

export const SupportedIntents: [SupportedIntent, ...SupportedIntent[]] = [
  'expense_logged',
  'planned_expense',
  'set_reminder',
  'bill_payment_reminder',
  'add_task',
  'schedule_event',
  'unknown',
];

export const IntentAnalysisSourceSchema = z.object({
  type: z.enum(['text', 'voice', 'notification']),
  raw_input: z.string(),
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'timestamp must be a valid ISO 8601 date string',
  }),
  source_app: z.string().nullable().optional(),
});

export const DetectedIntentSchema = z.object({
  sequence: z.number().int().positive('sequence must be a positive integer >= 1'),
  intent: z.enum(SupportedIntents),
  confidence: z.number().min(0, 'confidence must be >= 0').max(1, 'confidence must be <= 1'),
  entities: CanonicalEntitiesSchema.default({}),
  missing: z.array(z.string()).default([]),
  raw_segment: z.string().optional(),
});

export const OrderingHintSchema = z.object({
  from_sequence: z.number().int().positive(),
  to_sequence: z.number().int().positive(),
  relationship: z.enum(['sequence', 'dependency']),
});

export const UnsupportedComponentSchema = z.object({
  raw_text: z.string(),
  capability: z.string(),
  reason: z.string(),
});

export const IntentAnalysisSchema = z
  .object({
    request_id: z.string().min(1, 'request_id cannot be empty'),
    source: IntentAnalysisSourceSchema,
    intents: z.array(DetectedIntentSchema).default([]),
    ordering_hints: z.array(OrderingHintSchema).default([]),
    overall_missing: z.array(z.string()).default([]),
    unsupported_components: z.array(UnsupportedComponentSchema).default([]),
    unrecognized_components: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    // 1. Check sequence uniqueness
    const seqSet = new Set<number>();
    for (let i = 0; i < data.intents.length; i++) {
      const seq = data.intents[i].sequence;
      if (seqSet.has(seq)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate sequence number ${seq} detected in intents`,
          path: ['intents', i, 'sequence'],
        });
      }
      seqSet.add(seq);
    }

    // 2. Check ordering_hints reference valid sequence numbers
    for (let i = 0; i < data.ordering_hints.length; i++) {
      const hint = data.ordering_hints[i];
      if (hint.from_sequence === hint.to_sequence) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ordering_hint cannot reference the same sequence (${hint.from_sequence}) as both from and to`,
          path: ['ordering_hints', i],
        });
      }
      if (!seqSet.has(hint.from_sequence)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ordering_hint from_sequence ${hint.from_sequence} does not exist in intents`,
          path: ['ordering_hints', i, 'from_sequence'],
        });
      }
      if (!seqSet.has(hint.to_sequence)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ordering_hint to_sequence ${hint.to_sequence} does not exist in intents`,
          path: ['ordering_hints', i, 'to_sequence'],
        });
      }
    }
  });

const FORBIDDEN_AGENT_KEYS = ['agent', 'required_agents', 'actions', 'operation', 'agent_name'];

function findForbiddenKeys(obj: unknown, path: string = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const errors: string[] = [];
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      errors.push(...findForbiddenKeys(item, `${path}[${idx}]`));
    });
  } else {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (FORBIDDEN_AGENT_KEYS.includes(key.toLowerCase())) {
        errors.push(
          `Forbidden field '${key}' found at ${path || 'root'}. IntentAnalysis must not contain agent names or operations.`
        );
      }
      if (typeof val === 'object' && val !== null) {
        errors.push(...findForbiddenKeys(val, `${path ? path + '.' : ''}${key}`));
      }
    }
  }
  return errors;
}

export interface IntentAnalysisValidationResult {
  success: boolean;
  data?: IntentAnalysis;
  errors?: string[];
}

export function validateIntentAnalysis(input: unknown): IntentAnalysisValidationResult {
  const forbiddenErrors = findForbiddenKeys(input);
  if (forbiddenErrors.length > 0) {
    return {
      success: false,
      errors: forbiddenErrors,
    };
  }

  const result = IntentAnalysisSchema.safeParse(input);
  if (result.success) {
    return {
      success: true,
      data: result.data as IntentAnalysis,
    };
  }
  return {
    success: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`
    ),
  };
}

export function parseIntentAnalysis(input: unknown): IntentAnalysis {
  const validation = validateIntentAnalysis(input);
  if (!validation.success || !validation.data) {
    throw new Error(`Invalid IntentAnalysis: ${validation.errors?.join('; ')}`);
  }
  return validation.data;
}
