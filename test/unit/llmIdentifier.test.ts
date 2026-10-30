import { createTextInputEvent } from '../../src/input/inputCapture';
import { LlmIntentIdentifier } from '../../src/intent/llmIdentifier';
import { MockLlmProvider } from '../../src/intent/llmProvider';
import { RuleBasedIdentifier } from '../../src/intent/ruleIdentifier';

describe('LLM-Based Intent Identifier with Fallback', () => {
  const baseDate = new Date('2026-10-27T10:00:00.000Z');
  const fallback = new RuleBasedIdentifier(baseDate);

  it('uses LLM output when valid and matching ActionPlan schema', async () => {
    const mockProvider = new MockLlmProvider([
      () =>
        JSON.stringify({
          request_id: 'req_123',
          source: {
            type: 'text',
            raw_input: 'Remind me to call Mom tomorrow at 5 PM',
            timestamp: '2026-10-27T10:00:00.000Z',
          },
          intent: 'set_reminder',
          confidence: 0.95,
          entities: {
            title: 'Call Mom',
            date: '2026-10-28',
            time: '17:00:00',
          },
          missing_fields: [],
          required_agents: ['reminder_agent'],
          actions: [
            {
              action_id: 'act_001',
              agent: 'reminder_agent',
              operation: 'create_reminder',
              depends_on: [],
              data: { title: 'Call Mom', date: '2026-10-28', time: '17:00:00' },
            },
          ],
          requires_confirmation: false,
          execution_mode: 'pending',
        }),
    ]);

    const identifier = new LlmIntentIdentifier(mockProvider, fallback, baseDate);
    const input = createTextInputEvent('Remind me to call Mom tomorrow at 5 PM');
    const result = await identifier.identify(input);

    expect(result.method).toBe('llm');
    expect(result.plan.intent).toBe('set_reminder');
    expect(result.plan.confidence).toBe(0.95);
    expect(result.plan.required_agents).toEqual(['reminder_agent']);
    expect(mockProvider.callCount).toBe(1);
  });

  it('retries once when initial LLM response is malformed, then succeeds if retry valid', async () => {
    const mockProvider = new MockLlmProvider([
      // First attempt: malformed JSON
      () => '{ "intent": "set_reminder", invalid_json... ',
      // Retry attempt: valid JSON
      () =>
        JSON.stringify({
          request_id: 'req_123',
          source: {
            type: 'text',
            raw_input: 'Add a task to buy groceries',
            timestamp: '2026-10-27T10:00:00.000Z',
          },
          intent: 'add_task',
          confidence: 0.9,
          entities: { title: 'buy groceries' },
          missing_fields: [],
          required_agents: ['task_agent'],
          actions: [
            {
              action_id: 'act_001',
              agent: 'task_agent',
              operation: 'create_task',
              depends_on: [],
              data: { title: 'buy groceries' },
            },
          ],
          requires_confirmation: false,
          execution_mode: 'pending',
        }),
    ]);

    const identifier = new LlmIntentIdentifier(mockProvider, fallback, baseDate);
    const input = createTextInputEvent('Add a task to buy groceries');
    const result = await identifier.identify(input);

    expect(result.method).toBe('llm');
    expect(result.plan.intent).toBe('add_task');
    expect(result.warning).toMatch(/1 retry/);
    expect(mockProvider.callCount).toBe(2);
  });

  it('falls back to rule-based identifier when LLM returns invalid schema even after retry', async () => {
    const mockProvider = new MockLlmProvider([
      // Attempt 1: invalid schema (unknown intent)
      () =>
        JSON.stringify({
          intent: 'unsupported_alien_intent',
          confidence: 0.9,
        }),
      // Attempt 2: still invalid
      () =>
        JSON.stringify({
          intent: 'another_unsupported_intent',
          confidence: 0.9,
        }),
    ]);

    const identifier = new LlmIntentIdentifier(mockProvider, fallback, baseDate);
    const input = createTextInputEvent('I spent ₹250 on lunch today.');
    const result = await identifier.identify(input);

    expect(result.method).toBe('fallback_rule_based');
    expect(result.warning).toMatch(/validation failed after retry/);
    // Verified that rule-based fallback accurately classified the input
    expect(result.plan.intent).toBe('expense_logged');
    expect(result.plan.entities.amount).toBe(250);
  });

  it('falls back to rule-based identifier when LLM API throws network error', async () => {
    const mockProvider = new MockLlmProvider([
      () => {
        throw new Error('Network connection refused (ECONNREFUSED)');
      },
    ]);

    const identifier = new LlmIntentIdentifier(mockProvider, fallback, baseDate);
    const input = createTextInputEvent('I spent ₹250 on lunch today.');
    const result = await identifier.identify(input);

    expect(result.method).toBe('fallback_rule_based');
    expect(result.warning).toMatch(/LLM request failed/);
    expect(result.plan.intent).toBe('expense_logged');
  });

  it('falls back to rule-based identifier immediately when LLM provider is not configured', async () => {
    const mockProvider = new MockLlmProvider();
    mockProvider.configured = false; // no API key

    const identifier = new LlmIntentIdentifier(mockProvider, fallback, baseDate);
    const input = createTextInputEvent('Remind me to pay the electricity bill tomorrow for ₹1200.');
    const result = await identifier.identify(input);

    expect(result.method).toBe('fallback_rule_based');
    expect(result.warning).toMatch(/not configured/);
    expect(result.plan.intent).toBe('bill_payment_reminder');
    expect(mockProvider.callCount).toBe(0); // Did not make any API calls
  });
});

