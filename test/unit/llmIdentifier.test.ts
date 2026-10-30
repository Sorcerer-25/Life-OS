import { createTextInputEvent } from '../../src/input/inputCapture';
import { LlmIntentIdentifier } from '../../src/intent/llmIdentifier';
import { MockLlmProvider } from '../../src/intent/llmProvider';
import { RuleBasedIdentifier } from '../../src/intent/ruleIdentifier';

describe('LLM-Based Intent Identifier with IntentAnalysis & Fallback', () => {
  const baseDate = new Date('2026-10-30T10:00:00.000Z');
  const fallback = new RuleBasedIdentifier(baseDate);

  it('uses LLM output when valid and conforming to IntentAnalysis schema', async () => {
    const mockProvider = new MockLlmProvider([
      () =>
        JSON.stringify({
          request_id: 'req_123',
          source: {
            type: 'text',
            raw_input: 'Remind me to call Mom tomorrow at 5 PM',
            timestamp: '2026-10-30T10:00:00.000Z',
          },
          intents: [
            {
              sequence: 1,
              intent: 'set_reminder',
              confidence: 0.95,
              entities: {
                title: 'Call Mom',
                due_date: '2026-10-31',
                due_date_text: 'tomorrow',
                start_time: '17:00:00',
                time_text: '5 PM',
              },
              missing: [],
            },
          ],
          ordering_hints: [],
          overall_missing: [],
        }),
    ]);

    const identifier = new LlmIntentIdentifier(mockProvider, fallback, baseDate);
    const input = createTextInputEvent('Remind me to call Mom tomorrow at 5 PM');
    const result = await identifier.identify(input);

    expect(result.method).toBe('llm');
    expect(result.analysis.intents[0].intent).toBe('set_reminder');
    expect(result.analysis.intents[0].confidence).toBe(0.95);
    expect(mockProvider.callCount).toBe(1);
  });

  it('retries once when initial LLM response is malformed, then succeeds if retry is valid', async () => {
    const mockProvider = new MockLlmProvider([
      // First attempt: invalid JSON
      () => '{ "intents": "invalid JSON... ',
      // Retry attempt: valid IntentAnalysis
      () =>
        JSON.stringify({
          request_id: 'req_123',
          source: {
            type: 'text',
            raw_input: 'Add a task to buy groceries',
            timestamp: '2026-10-30T10:00:00.000Z',
          },
          intents: [
            {
              sequence: 1,
              intent: 'add_task',
              confidence: 0.9,
              entities: { title: 'buy groceries' },
              missing: [],
            },
          ],
          ordering_hints: [],
          overall_missing: [],
        }),
    ]);

    const identifier = new LlmIntentIdentifier(mockProvider, fallback, baseDate);
    const input = createTextInputEvent('Add a task to buy groceries');
    const result = await identifier.identify(input);

    expect(result.method).toBe('llm');
    expect(result.analysis.intents[0].intent).toBe('add_task');
    expect(result.warning).toMatch(/1 retry/);
    expect(mockProvider.callCount).toBe(2);
  });

  it('falls back to rule-based identifier when LLM returns invalid schema even after retry', async () => {
    const mockProvider = new MockLlmProvider([
      // Attempt 1: unsupported intent
      () =>
        JSON.stringify({
          request_id: 'req_123',
          source: { type: 'text', raw_input: 'test', timestamp: '2026-10-30T10:00:00.000Z' },
          intents: [{ sequence: 1, intent: 'alien_magic_intent', confidence: 0.9, entities: {}, missing: [] }],
          ordering_hints: [],
          overall_missing: [],
        }),
      // Attempt 2: still invalid
      () =>
        JSON.stringify({
          request_id: 'req_123',
          source: { type: 'text', raw_input: 'test', timestamp: '2026-10-30T10:00:00.000Z' },
          intents: [{ sequence: 1, intent: 'another_invalid_intent', confidence: 0.9, entities: {}, missing: [] }],
          ordering_hints: [],
          overall_missing: [],
        }),
    ]);

    const identifier = new LlmIntentIdentifier(mockProvider, fallback, baseDate);
    const input = createTextInputEvent('I spent ₹250 on lunch today.');
    const result = await identifier.identify(input);

    expect(result.method).toBe('fallback_rule_based');
    expect(result.warning).toMatch(/validation failed after retry/);
    expect(result.analysis.intents[0].intent).toBe('expense_logged');
    expect(result.analysis.intents[0].entities.amount).toBe(250);
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
    expect(result.analysis.intents[0].intent).toBe('expense_logged');
  });

  it('falls back to rule-based identifier immediately when LLM provider is not configured', async () => {
    const mockProvider = new MockLlmProvider();
    mockProvider.configured = false; // No API key

    const identifier = new LlmIntentIdentifier(mockProvider, fallback, baseDate);
    const input = createTextInputEvent('Remind me to pay the electricity bill tomorrow for ₹1200.');
    const result = await identifier.identify(input);

    expect(result.method).toBe('fallback_rule_based');
    expect(result.warning).toMatch(/not configured/);
    expect(result.analysis.intents[0].intent).toBe('bill_payment_reminder');
    expect(mockProvider.callCount).toBe(0);
  });
});
