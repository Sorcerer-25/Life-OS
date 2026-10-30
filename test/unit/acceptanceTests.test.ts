import { createTextInputEvent } from '../../src/input/inputCapture';
import { LocalIntentIdentifier } from '../../src/intent/localIntentIdentifier';
import { SupervisorAgent } from '../../src/supervisor/supervisor';

describe('Phase 1.5A Acceptance Tests (End-to-End Local Pipeline)', () => {
  // Anchored reference date: Friday, Oct 30, 2026, 10:00:00 AM UTC
  const baseDate = new Date('2026-10-30T10:00:00.000Z');
  let identifier: LocalIntentIdentifier;
  let supervisor: SupervisorAgent;

  beforeEach(() => {
    identifier = new LocalIntentIdentifier(baseDate);
    supervisor = new SupervisorAgent(0.6);
  });

  // Acceptance Test 1: Single reminder
  it('Acceptance Test 1: Single reminder with explicit date and time', async () => {
    const input = createTextInputEvent('Remind me to submit my assignment tomorrow at 10 AM.');
    const { analysis } = await identifier.identify(input);

    expect(analysis.intents.length).toBe(1);
    const intent = analysis.intents[0];
    expect(intent.intent).toBe('set_reminder');
    expect(intent.entities.title?.toString().toLowerCase()).toContain('assignment');
    expect(intent.entities.due_date).toBe('2026-10-31'); // tomorrow relative to 2026-10-30
    expect(intent.entities.start_time).toBe('10:00:00');
    expect(intent.missing).toEqual([]);

    const plan = supervisor.plan(analysis);
    expect(plan.decision.workflow_status).toBe('ready');
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].agent).toBe('reminder_agent');
    expect(plan.actions[0].operation).toBe('create_reminder');
    expect(plan.actions[0].requires_confirmation).toBe(false);
    expect(plan.actions[0].status).toBe('ready');
  });

  // Acceptance Test 2: Multiple intents (completed expense + task with recipient)
  it('Acceptance Test 2: Multi-intent compound sentence preserving order and entities', async () => {
    const input = createTextInputEvent(
      'I paid ₹200 for lunch and need to send Rahul the project report by 5 PM.'
    );
    const { analysis } = await identifier.identify(input);

    expect(analysis.intents.length).toBe(2);

    // Intent 1: Expense Logged
    const exp = analysis.intents[0];
    expect(exp.intent).toBe('expense_logged');
    expect(exp.entities.amount).toBe(200);
    expect(exp.entities.currency).toBe('INR');
    expect(exp.entities.description?.toString().toLowerCase()).toContain('lunch');
    expect(exp.missing).toEqual([]);

    // Intent 2: Task
    const task = analysis.intents[1];
    expect(task.intent).toBe('add_task');
    expect(task.entities.recipient).toBe('Rahul');
    expect(task.entities.title?.toString().toLowerCase()).toContain('project report');

    const plan = supervisor.plan(analysis);
    expect(plan.decision.workflow_status).toBe('ready');
    expect(plan.required_agents).toContain('finance_agent');
    expect(plan.required_agents).toContain('task_agent');

    expect(plan.actions.length).toBe(2);
    // Financial operation requires explicit confirmation
    expect(plan.actions[0].agent).toBe('finance_agent');
    expect(plan.actions[0].operation).toBe('create_expense');
    expect(plan.actions[0].requires_confirmation).toBe(true);

    // Task operation does not require confirmation
    expect(plan.actions[1].agent).toBe('task_agent');
    expect(plan.actions[1].operation).toBe('create_task');
    expect(plan.actions[1].requires_confirmation).toBe(false);
  });

  // Acceptance Test 3: Planned expense (Strict financial safety)
  it('Acceptance Test 3: Planned expense must never be classified as expense_logged', async () => {
    const input = createTextInputEvent('I need to pay my electricity bill of ₹1200 tomorrow.');
    const { analysis } = await identifier.identify(input);

    expect(analysis.intents.length).toBe(1);
    const intent = analysis.intents[0];
    expect(intent.intent).toBe('planned_expense');
    expect(intent.intent).not.toBe('expense_logged');
    expect(intent.entities.amount).toBe(1200);
    expect(intent.entities.currency).toBe('INR');
    expect(intent.entities.bill_type).toBe('electricity');
    expect(intent.entities.due_date).toBe('2026-10-31');

    const plan = supervisor.plan(analysis);
    expect(plan.decision.workflow_status).toBe('ready');
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].agent).toBe('finance_agent');
    expect(plan.actions[0].operation).toBe('create_planned_expense');
    // Financial operations require confirmation
    expect(plan.actions[0].requires_confirmation).toBe(true);
  });

  // Acceptance Test 4: Ambiguous reminder (Missing due date -> Clarification needed)
  it('Acceptance Test 4: Ambiguous reminder missing required date triggers clarification', async () => {
    const input = createTextInputEvent('Remind me about the payment.');
    const { analysis } = await identifier.identify(input);

    expect(analysis.intents.length).toBe(1);
    const intent = analysis.intents[0];
    expect(intent.missing).toContain('due_date');

    const plan = supervisor.plan(analysis);
    expect(plan.decision.workflow_status).toBe('needs_clarification');
    expect(plan.decision.clarification_needed).toBe(true);
    expect(plan.decision.clarification_questions.length).toBeGreaterThan(0);
    expect(plan.actions[0].status).toBe('needs_clarification');
  });

  // Acceptance Test 5: Unsupported flight search
  it('Acceptance Test 5: Unsupported flight search flags capability without misleading clarification', async () => {
    const input = createTextInputEvent('Find me the cheapest flight to Mumbai.');
    const { analysis } = await identifier.identify(input);

    expect(analysis.intents.length).toBe(0);
    expect(analysis.unsupported_components).toBeDefined();
    expect(analysis.unsupported_components!.length).toBeGreaterThan(0);
    expect(analysis.unsupported_components![0].capability).toContain('flight_search');

    const plan = supervisor.plan(analysis);
    expect(plan.decision.workflow_status).toBe('unsupported');
    expect(plan.actions.length).toBe(0);
    expect(plan.decision.clarification_needed).toBe(false);
    expect(plan.decision.unsupported_explanations.length).toBeGreaterThan(0);
  });

  // Acceptance Test 6: Partial workflow (Complete expense + Incomplete reminder)
  it('Acceptance Test 6: Incomplete reminder does not block independent completed expense', async () => {
    const input = createTextInputEvent('I paid ₹300 for lunch and remind me about the payment.');
    const { analysis } = await identifier.identify(input);

    expect(analysis.intents.length).toBe(2);
    // Intent 1 is complete expense
    expect(analysis.intents[0].intent).toBe('expense_logged');
    expect(analysis.intents[0].missing).toEqual([]);

    // Intent 2 is incomplete reminder
    expect(analysis.intents[1].intent).toBe('set_reminder');
    expect(analysis.intents[1].missing).toContain('due_date');

    const plan = supervisor.plan(analysis);
    expect(plan.decision.workflow_status).toBe('partial');
    expect(plan.decision.clarification_needed).toBe(true);
    expect(plan.actions.length).toBe(2);

    // Expense action is ready (NOT blocked)
    const expenseAction = plan.actions.find((a) => a.operation === 'create_expense');
    expect(expenseAction).toBeDefined();
    expect(expenseAction!.status).toBe('ready');

    // Reminder action needs clarification
    const reminderAction = plan.actions.find((a) => a.operation === 'create_reminder');
    expect(reminderAction).toBeDefined();
    expect(reminderAction!.status).toBe('needs_clarification');
  });

  // Acceptance Test 7: Multiple distinct reminders
  it('Acceptance Test 7: Two distinct reminders preserve individual dates and details', async () => {
    const input = createTextInputEvent(
      'Remind me to call Rahul tomorrow and submit my assignment on Friday.'
    );
    const { analysis } = await identifier.identify(input);

    expect(analysis.intents.length).toBe(2);

    const first = analysis.intents[0];
    expect(first.entities.title?.toString().toLowerCase()).toContain('call rahul');
    expect(first.entities.due_date).toBe('2026-10-31'); // tomorrow

    const second = analysis.intents[1];
    expect(second.entities.title?.toString().toLowerCase()).toContain('assignment');
    expect(second.entities.due_date).toBe('2026-11-06'); // next Friday (Oct 30 was Friday, so next Friday is Nov 6)

    const plan = supervisor.plan(analysis);
    expect(plan.decision.workflow_status).toBe('ready');
    expect(plan.actions.length).toBe(2);
  });

  // Acceptance Test 8: Unrecognized input
  it('Acceptance Test 8: Unrecognized gibberish input produces rejected workflow and suggests rephrase', async () => {
    const input = createTextInputEvent('Blue seven running quickly.');
    const { analysis } = await identifier.identify(input);

    expect(analysis.intents.length).toBe(0);
    expect(analysis.unrecognized_components).toBeDefined();
    expect(analysis.unrecognized_components!.length).toBeGreaterThan(0);

    const plan = supervisor.plan(analysis);
    expect(plan.decision.workflow_status).toBe('rejected');
    expect(plan.actions.length).toBe(0);
    expect(plan.decision.reasons[0]).toContain('rephrasing');
  });
});
