import { createTextInputEvent } from '../../src/input/inputCapture';
import { IntentService } from '../../src/intent/intentService';
import { MockLlmProvider } from '../../src/intent/llmProvider';
import { RuleBasedIdentifier } from '../../src/intent/ruleIdentifier';

describe('IntentService Coordinator (Emits IntentAnalysis)', () => {
  const baseDate = new Date('2026-10-30T10:00:00.000Z');

  it('runs local rule-based identifier in local_rules or rules_only mode', async () => {
    const mockLlm = new MockLlmProvider();
    const service = new IntentService(mockLlm, new RuleBasedIdentifier(baseDate), baseDate);
    service.setMode('rules_only');

    const input = createTextInputEvent('I spent ₹250 on lunch today.');
    const result = await service.identify(input);

    expect(result.method).toBe('rule_based');
    expect(result.analysis.intents[0].intent).toBe('expense_logged');
    expect(result.analysis.intents[0].entities.amount).toBe(250);
    expect(mockLlm.callCount).toBe(0);
  });

  it('routes to deterministic local engine without network calls', async () => {
    const mockLlm = new MockLlmProvider();
    mockLlm.configured = false;

    const service = new IntentService(mockLlm, new RuleBasedIdentifier(baseDate), baseDate);

    const input = createTextInputEvent('Remind me to pay the electricity bill tomorrow for ₹1200.');
    const result = await service.identify(input);

    expect(result.method).toBe('rule_based');
    expect(result.analysis.intents[0].intent).toBe('bill_payment_reminder');
    expect(mockLlm.callCount).toBe(0);
  });
});
