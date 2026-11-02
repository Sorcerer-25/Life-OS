import { RuleBasedIdentifier } from '../../src/intent/ruleIdentifier';
import { SupervisorAgent } from '../../src/supervisor/supervisor';
import { InputEvent } from '../../src/models/InputEvent';
import { DetectedIntent } from '../../src/models/IntentAnalysis';

describe('User 17 Target Test Cases', () => {
  const baseDate = new Date('2026-11-02T10:00:00Z');
  const identifier = new RuleBasedIdentifier(baseDate);
  const supervisor = new SupervisorAgent();

  const makeEvent = (rawText: string): InputEvent => ({
    requestId: 'test_req',
    sourceType: 'text',
    rawText,
    timestamp: baseDate.toISOString(),
  });

  test('1. Record an expense of ₹500 for shopping.', async () => {
    const res = await identifier.identify(makeEvent('Record an expense of ₹500 for shopping.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['expense_logged']);
    const plan = supervisor.plan(res.analysis);
    expect(plan.required_agents).toContain('finance_agent');
    expect(plan.actions[0].operation).toBe('create_expense');
    expect((plan.actions[0].data as any).amount).toBe(500);
  });

  test('2. Had dinner outside, cost me 350.', async () => {
    const res = await identifier.identify(makeEvent('Had dinner outside, cost me 350.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['expense_logged']);
    expect(res.analysis.intents[0].entities.amount).toBe(350);
  });

  test('3. ₹90 for tea and snacks.', async () => {
    const res = await identifier.identify(makeEvent('₹90 for tea and snacks.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['expense_logged']);
    expect(res.analysis.intents[0].entities.amount).toBe(90);
    expect(res.analysis.intents[0].entities.currency).toBe('INR');
  });

  test('4. Add 250 as my travel expense.', async () => {
    const res = await identifier.identify(makeEvent('Add 250 as my travel expense.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['expense_logged']);
    expect(res.analysis.intents[0].entities.amount).toBe(250);
  });

  test('5. My internet bill of ₹799 is due on Friday.', async () => {
    const res = await identifier.identify(makeEvent('My internet bill of ₹799 is due on Friday.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['planned_expense']);
    expect(res.analysis.intents[0].entities.amount).toBe(799);
    expect(res.analysis.intents[0].entities.bill_type).toBe('internet');
  });

  test('6. I haven\'t paid my college fees yet.', async () => {
    const res = await identifier.identify(makeEvent('I haven\'t paid my college fees yet.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['planned_expense']);
    expect(res.analysis.intents[0].missing).toContain('amount');
  });

  test('7. Keep ₹500 aside for groceries tomorrow.', async () => {
    const res = await identifier.identify(makeEvent('Keep ₹500 aside for groceries tomorrow.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['planned_expense']);
    expect(res.analysis.intents[0].entities.amount).toBe(500);
  });

  test('8. Schedule a payment of ₹1500 for tomorrow.', async () => {
    const res = await identifier.identify(makeEvent('Schedule a payment of ₹1500 for tomorrow.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['planned_expense']);
    const plan = supervisor.plan(res.analysis);
    expect(plan.required_agents).toEqual(['finance_agent']);
    expect(plan.required_agents).not.toContain('calendar_agent');
  });

  test('9. I owe my friend ₹300.', async () => {
    const res = await identifier.identify(makeEvent('I owe my friend ₹300.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['planned_expense']);
    expect(res.analysis.intents[0].entities.amount).toBe(300);
  });

  test('10. I paid ₹500 yesterday, but another ₹700 is still due.', async () => {
    const res = await identifier.identify(makeEvent('I paid ₹500 yesterday, but another ₹700 is still due.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['expense_logged', 'planned_expense']);
    const plan = supervisor.plan(res.analysis);
    expect(plan.required_agents).toEqual(['finance_agent']);
    expect(plan.actions.length).toBe(2);
  });

  test('11. Don\'t let me forget to carry my laptop tomorrow.', async () => {
    const res = await identifier.identify(makeEvent('Don\'t let me forget to carry my laptop tomorrow.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['set_reminder']);
    expect(res.analysis.intents[0].entities.due_date).toBeDefined();
  });

  test('12. Remind me about the meeting in two hours.', async () => {
    const res = await identifier.identify(makeEvent('Remind me about the meeting in two hours.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['set_reminder']);
    expect(res.analysis.intents[0].entities.start_time).toBeDefined();
    expect(res.analysis.intents[0].entities.due_date).toBeDefined();
  });

  test('13. I need a reminder to drink water every morning.', async () => {
    const res = await identifier.identify(makeEvent('I need a reminder to drink water every morning.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['set_reminder']);
    expect(res.analysis.intents[0].entities.recurrence).toBe('every morning');
  });

  test('14. Ping me to check my emails after lunch.', async () => {
    const res = await identifier.identify(makeEvent('Ping me to check my emails after lunch.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['set_reminder']);
  });

  test('15. Remind me to renew my subscription on the 15th.', async () => {
    const res = await identifier.identify(makeEvent('Remind me to renew my subscription on the 15th.'));
    expect(res.analysis.intents.length).toBeGreaterThan(0);
    expect(['set_reminder', 'bill_payment_reminder']).toContain(res.analysis.intents[0].intent);
    expect(res.analysis.intents[0].entities.due_date).toBeDefined();
  });

  test('16. Create an event for my exam on December 5.', async () => {
    const res = await identifier.identify(makeEvent('Create an event for my exam on December 5.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['schedule_event']);
    expect(res.analysis.intents[0].entities.due_date).toBe('2026-12-05');
  });

  test('17. I paid ₹500 for lunch remind me tomorrow.', async () => {
    const res = await identifier.identify(makeEvent('I paid ₹500 for lunch remind me tomorrow.'));
    expect(res.analysis.intents.map((i: DetectedIntent) => i.intent)).toEqual(['expense_logged', 'set_reminder']);
  });
});
