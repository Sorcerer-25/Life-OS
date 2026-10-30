import {
  parseIntentAnalysis,
  validateIntentAnalysis,
} from '../../src/intent/intentAnalysisValidator';
import { IntentAnalysis } from '../../src/models/IntentAnalysis';

describe('IntentAnalysis Schema Validator', () => {
  const validAnalysis: IntentAnalysis = {
    request_id: 'req_001',
    source: {
      type: 'text',
      raw_input: 'Remind me to pay the electricity bill tomorrow for ₹1200',
      timestamp: '2026-10-30T10:00:00.000Z',
      source_app: null,
    },
    intents: [
      {
        sequence: 1,
        intent: 'bill_payment_reminder',
        confidence: 0.95,
        entities: {
          bill_type: 'electricity',
          amount: 1200,
          currency: 'INR',
          due_date: '2026-10-31',
          due_date_text: 'tomorrow',
        },
        missing: [],
      },
    ],
    ordering_hints: [],
    overall_missing: [],
    unsupported_components: [],
    unrecognized_components: [],
  };

  it('validates a complete, valid IntentAnalysis successfully', () => {
    const result = validateIntentAnalysis(validAnalysis);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.intents[0].intent).toBe('bill_payment_reminder');
  });

  it('rejects an IntentAnalysis containing agent names or operations (strict architectural boundary)', () => {
    const forbiddenAnalysis = {
      ...validAnalysis,
      intents: [
        {
          ...validAnalysis.intents[0],
          agent: 'reminder_agent', // Forbidden!
        },
      ],
    };

    const result = validateIntentAnalysis(forbiddenAnalysis);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('Forbidden field'))).toBe(true);
  });

  it('rejects an IntentAnalysis with duplicate sequence numbers', () => {
    const duplicateSeq = {
      ...validAnalysis,
      intents: [
        {
          sequence: 1,
          intent: 'set_reminder',
          confidence: 0.9,
          entities: { title: 'Call Mom' },
          missing: [],
        },
        {
          sequence: 1, // Duplicate!
          intent: 'add_task',
          confidence: 0.85,
          entities: { title: 'Clean room' },
          missing: [],
        },
      ],
    };

    const result = validateIntentAnalysis(duplicateSeq);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('Duplicate sequence number'))).toBe(true);
  });

  it('rejects ordering_hints that reference non-existent sequence numbers', () => {
    const invalidHint = {
      ...validAnalysis,
      ordering_hints: [
        {
          from_sequence: 1,
          to_sequence: 99, // Does not exist
          relationship: 'sequence' as const,
        },
      ],
    };

    const result = validateIntentAnalysis(invalidHint);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('does not exist'))).toBe(true);
  });

  it('rejects self-referencing ordering_hints (from_sequence === to_sequence)', () => {
    const selfRef = {
      ...validAnalysis,
      ordering_hints: [
        {
          from_sequence: 1,
          to_sequence: 1,
          relationship: 'sequence' as const,
        },
      ],
    };

    const result = validateIntentAnalysis(selfRef);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('cannot reference the same sequence'))).toBe(true);
  });

  it('rejects unsupported intents', () => {
    const unsupported = {
      ...validAnalysis,
      intents: [
        {
          sequence: 1,
          intent: 'unsupported_magic_intent',
          confidence: 0.5,
          entities: {},
          missing: [],
        },
      ],
    };

    const result = validateIntentAnalysis(unsupported);
    expect(result.success).toBe(false);
  });

  it('parseIntentAnalysis throws on invalid schema', () => {
    expect(() => parseIntentAnalysis({ invalid: 'object' })).toThrow(/Invalid IntentAnalysis/);
  });
});

