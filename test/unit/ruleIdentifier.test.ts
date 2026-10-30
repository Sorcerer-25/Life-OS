import { createTextInputEvent } from '../../src/input/inputCapture';
import { RuleBasedIdentifier } from '../../src/intent/ruleIdentifier';

describe('Rule-Based Intent Identifier', () => {
  // Use fixed base date: Tuesday 2026-10-27
  const baseDate = new Date('2026-10-27T10:00:00.000Z');
  const identifier = new RuleBasedIdentifier(baseDate);

  describe('Acceptance Examples', () => {
    // 1. "I spent ₹250 on lunch today."
    it('Example 1: classifies "I spent ₹250 on lunch today." as expense_logged with create_expense', async () => {
      const input = createTextInputEvent('I spent ₹250 on lunch today.');
      const result = await identifier.identify(input);

      expect(result.method).toBe('rule_based');
      expect(result.plan.intent).toBe('expense_logged');
      expect(result.plan.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.plan.entities.amount).toBe(250);
      expect(result.plan.entities.currency).toBe('INR');
      expect(result.plan.entities.description).toMatch(/lunch/i);
      expect(result.plan.entities.date).toBe('2026-10-27');
      expect(result.plan.missing_fields).toHaveLength(0);
      expect(result.plan.required_agents).toEqual(['finance_agent']);

      expect(result.plan.actions).toHaveLength(1);
      expect(result.plan.actions[0].agent).toBe('finance_agent');
      expect(result.plan.actions[0].operation).toBe('create_expense');
    });

    // 2. "Remind me to pay the electricity bill tomorrow for ₹1200."
    it('Example 2: classifies "Remind me to pay the electricity bill tomorrow for ₹1200." as multi-agent bill_payment_reminder', async () => {
      const input = createTextInputEvent('Remind me to pay the electricity bill tomorrow for ₹1200.');
      const result = await identifier.identify(input);

      expect(result.plan.intent).toBe('bill_payment_reminder');
      expect(result.plan.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.plan.entities.bill_type).toBe('electricity');
      expect(result.plan.entities.amount).toBe(1200);
      expect(result.plan.entities.currency).toBe('INR');
      expect(result.plan.entities.due_date).toBe('2026-10-28'); // tomorrow relative to 2026-10-27
      expect(result.plan.missing_fields).toHaveLength(0);

      // Multi-agent selection
      expect(result.plan.required_agents).toEqual(
        expect.arrayContaining(['reminder_agent', 'finance_agent'])
      );

      // Finance action MUST be create_planned_expense, NOT create_expense!
      const reminderAction = result.plan.actions.find((a) => a.agent === 'reminder_agent');
      const financeAction = result.plan.actions.find((a) => a.agent === 'finance_agent');

      expect(reminderAction).toBeDefined();
      expect(reminderAction?.operation).toBe('create_reminder');

      expect(financeAction).toBeDefined();
      expect(financeAction?.operation).toBe('create_planned_expense');
      expect(financeAction?.operation).not.toBe('create_expense');
    });

    // 3. "My payment of ₹1200 is pending."
    it('Example 3 (Safety Rule): "My payment of ₹1200 is pending." must NEVER become a completed expense', async () => {
      const input = createTextInputEvent('My payment of ₹1200 is pending.');
      const result = await identifier.identify(input);

      // Must NOT be expense_logged
      expect(result.plan.intent).not.toBe('expense_logged');
      // Must NOT have create_expense action
      const hasCompletedExpense = result.plan.actions.some((a) => a.operation === 'create_expense');
      expect(hasCompletedExpense).toBe(false);

      expect(result.plan.entities.amount).toBe(1200);
      expect(result.plan.missing_fields.length).toBeGreaterThan(0);
      expect(result.plan.confidence).toBeLessThan(0.6);
    });

    // 4. "Remind me about the bill."
    it('Example 4: "Remind me about the bill." marks due_date as missing without guessing', async () => {
      const input = createTextInputEvent('Remind me about the bill.');
      const result = await identifier.identify(input);

      expect(result.plan.missing_fields).toContain('due_date');
      expect(result.plan.entities.due_date).toBeUndefined();
      expect(result.plan.confidence).toBeLessThan(0.6);
      expect(result.plan.requires_confirmation).toBe(true);
    });

    // 5. "Schedule a project review tomorrow at 3 PM."
    it('Example 5: "Schedule a project review tomorrow at 3 PM." extracts title, date, time and marks duration missing', async () => {
      const input = createTextInputEvent('Schedule a project review tomorrow at 3 PM.');
      const result = await identifier.identify(input);

      expect(result.plan.intent).toBe('schedule_event');
      expect(result.plan.entities.title).toMatch(/project review/i);
      expect(result.plan.entities.date).toBe('2026-10-28');
      expect(result.plan.entities.time).toBe('15:00:00');
      // Duration was not specified: must not invent duration!
      expect(result.plan.missing_fields).toContain('duration');
      expect(result.plan.required_agents).toEqual(['calendar_agent']);
      expect(result.plan.actions[0].operation).toBe('schedule_event');
    });

    // 6. "Add a task to clean my room."
    it('Example 6: classifies "Add a task to clean my room." as add_task', async () => {
      const input = createTextInputEvent('Add a task to clean my room.');
      const result = await identifier.identify(input);

      expect(result.plan.intent).toBe('add_task');
      expect(result.plan.entities.title).toMatch(/clean my room/i);
      expect(result.plan.required_agents).toEqual(['task_agent']);
      expect(result.plan.actions[0].operation).toBe('create_task');
      expect(result.plan.missing_fields).toHaveLength(0);
    });

    // 7. "I need to pay my internet bill next Friday."
    it('Example 7: "I need to pay my internet bill next Friday." marks missing amount', async () => {
      const input = createTextInputEvent('I need to pay my internet bill next Friday.');
      const result = await identifier.identify(input);

      expect(['planned_expense', 'bill_payment_reminder']).toContain(result.plan.intent);
      expect(result.plan.entities.bill_type).toBe('internet');
      // Today is Tuesday 2026-10-27; Friday is 2026-10-30
      expect(result.plan.entities.due_date).toBe('2026-10-30');
      // Amount is missing
      expect(result.plan.missing_fields).toContain('amount');
      expect(result.plan.confidence).toBeLessThan(0.7);
    });

    // 8. "I received a refund of ₹500 yesterday."
    it('Example 8: classifies "I received a refund of ₹500 yesterday." as expense_logged refund with date', async () => {
      const input = createTextInputEvent('I received a refund of ₹500 yesterday.');
      const result = await identifier.identify(input);

      expect(result.plan.intent).toBe('expense_logged');
      expect(result.plan.entities.amount).toBe(500);
      expect(result.plan.entities.currency).toBe('INR');
      expect(result.plan.entities.date).toBe('2026-10-26'); // yesterday relative to 2026-10-27
      expect(result.plan.required_agents).toEqual(['finance_agent']);
      expect(result.plan.actions[0].operation).toBe('create_expense');
    });
  });

  describe('Edge cases and safety', () => {
    it('classifies random gibberish as unknown with low confidence', async () => {
      const input = createTextInputEvent('xyz123 random noise hello');
      const result = await identifier.identify(input);

      expect(result.plan.intent).toBe('unknown');
      expect(result.plan.confidence).toBeLessThanOrEqual(0.3);
      expect(result.plan.missing_fields).toContain('intent_clarification');
      expect(result.plan.required_agents).toHaveLength(0);
      expect(result.plan.actions).toHaveLength(0);
    });
  });
});

