import {
  cleanAndParseJson,
  parseActionPlan,
  validateActionPlan,
} from '../../src/intent/schemaValidator';
import { ActionPlan } from '../../src/models/ActionPlan';

describe('ActionPlan Schema Validator', () => {
  const validPlan: ActionPlan = {
    request_id: 'req_001',
    source: {
      type: 'text',
      raw_input: 'Remind me to pay electricity bill tomorrow for 1200',
      source_app: null,
      timestamp: '2026-10-27T10:00:00.000Z',
    },
    intent: 'bill_payment_reminder',
    confidence: 0.95,
    entities: {
      bill_type: 'electricity',
      amount: 1200,
      currency: 'INR',
      due_date: '2026-10-28',
    },
    missing_fields: [],
    required_agents: ['reminder_agent', 'finance_agent'],
    actions: [
      {
        action_id: 'act_001',
        agent: 'reminder_agent',
        operation: 'create_reminder',
        depends_on: [],
        data: { title: 'Pay electricity bill' },
      },
      {
        action_id: 'act_002',
        agent: 'finance_agent',
        operation: 'create_planned_expense',
        depends_on: ['act_001'],
        data: { amount: 1200, currency: 'INR' },
      },
    ],
    requires_confirmation: false,
    execution_mode: 'pending',
  };

  it('validates a complete, conformant ActionPlan successfully', () => {
    const result = validateActionPlan(validPlan);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.intent).toBe('bill_payment_reminder');
  });

  it('rejects an ActionPlan with an unsupported intent', () => {
    const invalid = { ...validPlan, intent: 'unsupported_intent' };
    const result = validateActionPlan(invalid);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('intent'))).toBe(true);
  });

  it('rejects an ActionPlan with an invalid agent name in required_agents', () => {
    const invalid = { ...validPlan, required_agents: ['unauthorized_agent'] };
    const result = validateActionPlan(invalid);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('required_agents'))).toBe(true);
  });

  it('rejects an ActionPlan with an invalid agent in actions', () => {
    const invalid = {
      ...validPlan,
      actions: [
        {
          action_id: 'act_x',
          agent: 'invalid_bot',
          operation: 'do_something',
          depends_on: [],
          data: {},
        },
      ],
    };
    const result = validateActionPlan(invalid);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('actions.0.agent'))).toBe(true);
  });

  it('rejects confidence out of range (> 1.0 or < 0.0)', () => {
    const high = { ...validPlan, confidence: 1.5 };
    expect(validateActionPlan(high).success).toBe(false);

    const negative = { ...validPlan, confidence: -0.2 };
    expect(validateActionPlan(negative).success).toBe(false);
  });

  it('rejects an invalid timestamp in source', () => {
    const invalid = {
      ...validPlan,
      source: { ...validPlan.source, timestamp: 'invalid-date' },
    };
    const result = validateActionPlan(invalid);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('timestamp'))).toBe(true);
  });

  it('parses valid plan with parseActionPlan or throws error for invalid', () => {
    expect(() => parseActionPlan(validPlan)).not.toThrow();
    expect(() => parseActionPlan({ invalid: true })).toThrow(/Invalid ActionPlan schema/);
  });

  it('cleanAndParseJson strips markdown codeblocks correctly', () => {
    const rawWithMarkdown = '```json\n{"hello": "world"}\n```';
    const parsed = cleanAndParseJson(rawWithMarkdown) as { hello: string };
    expect(parsed.hello).toBe('world');

    const rawPlain = '{"hello": "plain"}';
    const parsedPlain = cleanAndParseJson(rawPlain) as { hello: string };
    expect(parsedPlain.hello).toBe('plain');
  });
});

