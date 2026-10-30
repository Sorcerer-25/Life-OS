import { createTextInputEvent } from '../../src/input/inputCapture';
import { IntentService } from '../../src/intent/intentService';
import { MockLlmProvider } from '../../src/intent/llmProvider';
import { RuleBasedIdentifier } from '../../src/intent/ruleIdentifier';

describe('IntentService Coordinator', () => {
  const baseDate = new Date('2026-10-27T10:00:00.000Z');

  it('runs rule-based identifier directly when set to rules_only mode', async () => {
    const mockLlm = new MockLlmProvider();
    const service = new IntentService(mockLlm, new RuleBasedIdentifier(baseDate), baseDate);
    service.setMode('rules_only');

    const input = createTextInputEvent('I spent ₹250 on lunch today.');
    const result = await service.identify(input);

    expect(result.method).toBe('rule_based');
    expect(result.plan.intent).toBe('expense_logged');
    expect(result.plan.entities.amount).toBe(250);
    // Verified that LLM was not called
    expect(mockLlm.callCount).toBe(0);
  });

  it('falls back to rule-based engine when in auto mode and LLM provider is unconfigured', async () => {
    const mockLlm = new MockLlmProvider();
    mockLlm.configured = false;

    const service = new IntentService(mockLlm, new RuleBasedIdentifier(baseDate), baseDate);
    service.setMode('auto');

    const input = createTextInputEvent('Remind me to pay the electricity bill tomorrow for ₹1200.');
    const result = await service.identify(input);

    expect(result.method).toBe('fallback_rule_based');
    expect(result.plan.intent).toBe('bill_payment_reminder');
    expect(result.warning).toBeDefined();
    expect(mockLlm.callCount).toBe(0);
  });
});

