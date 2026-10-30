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
      timestamp: '2026-10-30T10:00:00.000Z',
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
        },
        missing: [],
      },
    ],
    required_agents: ['reminder_agent', 'finance_agent'],
    actions: [
      {
        action_id: 'req_001_1_create_reminder',
        sequence: 1,
        agent: 'reminder_agent',
        operation: 'create_reminder',
        depends_on: [],
        data: { title: 'Pay electricity bill' },
        requires_confirmation: false,
        status: 'ready',
      },
      {
        action_id: 'req_001_1_create_planned_expense',
        sequence: 1,
        agent: 'finance_agent',
        operation: 'create_planned_expense',
        depends_on: ['req_001_1_create_reminder'],
        data: { amount: 1200, currency: 'INR' },
        requires_confirmation: true,
        status: 'ready',
      },
    ],
    decision: {
      workflow_status: 'ready',
      reasons: ['All proposed actions validated successfully.'],
      clarification_needed: false,
      clarification_questions: [],
      unsupported_explanations: [],
    },
    execution_mode: 'pending',
  };

  it('validates a complete, conformant ActionPlan successfully', () => {
    const result = validateActionPlan(validPlan);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.actions).toHaveLength(2);
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
          sequence: 1,
          agent: 'invalid_bot',
          operation: 'do_something',
          depends_on: [],
          data: {},
          requires_confirmation: false,
          status: 'ready' as const,
        },
      ],
    };
    const result = validateActionPlan(invalid);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.includes('actions.0.agent'))).toBe(true);
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
