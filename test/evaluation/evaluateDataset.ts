import { createTextInputEvent } from '../../src/input/inputCapture';
import { LocalIntentIdentifier } from '../../src/intent/localIntentIdentifier';
import { SupervisorAgent } from '../../src/supervisor/supervisor';
import rawDataset from './test_set.json';

export interface EvaluationItem {
  id: string;
  category: string;
  input: string;
  expected_intents: string[];
  expected_agents: string[];
  expected_workflow_status: string;
}

export interface EvaluationResult {
  total: number;
  intentMatches: number;
  intentAccuracy: number;
  agentMatches: number;
  agentAccuracy: number;
  statusMatches: number;
  statusAccuracy: number;
  clarificationExpected: number;
  clarificationTriggered: number;
  financialSafetyViolations: number;
  details: Array<{
    id: string;
    input: string;
    intentsPassed: boolean;
    agentsPassed: boolean;
    statusPassed: boolean;
    actualIntents: string[];
    actualAgents: string[];
    actualStatus: string;
  }>;
}

export async function runDatasetEvaluation(
  customDataset?: EvaluationItem[],
  baseDate: Date = new Date('2026-10-30T10:00:00.000Z')
): Promise<EvaluationResult> {
  const dataset: EvaluationItem[] = customDataset || (rawDataset as EvaluationItem[]);

  const identifier = new LocalIntentIdentifier(baseDate);
  const supervisor = new SupervisorAgent(0.6);

  let intentMatches = 0;
  let agentMatches = 0;
  let statusMatches = 0;
  let clarificationExpected = 0;
  let clarificationTriggered = 0;
  let financialSafetyViolations = 0;

  const details: EvaluationResult['details'] = [];

  for (const item of dataset) {
    const inputEvent = createTextInputEvent(item.input);
    const { analysis } = await identifier.identify(inputEvent);
    const plan = supervisor.plan(analysis);

    // 1. Check Intents
    const actualIntents = analysis.intents.map((i) => i.intent);
    const intentsPassed =
      actualIntents.length === item.expected_intents.length &&
      actualIntents.every((val, idx) => val === item.expected_intents[idx]);

    if (intentsPassed) {
      intentMatches++;
    }

    // 2. Check Agents
    const actualAgents = plan.required_agents;
    const agentsPassed =
      actualAgents.length === item.expected_agents.length &&
      item.expected_agents.every((a) => actualAgents.includes(a as any));

    if (agentsPassed) {
      agentMatches++;
    }

    // 3. Check Workflow Status
    const actualStatus = plan.decision.workflow_status;
    const statusPassed = actualStatus === item.expected_workflow_status;

    if (statusPassed) {
      statusMatches++;
    }

    // 4. Clarification tracking
    if (
      item.expected_workflow_status === 'needs_clarification' ||
      item.expected_workflow_status === 'partial'
    ) {
      clarificationExpected++;
      if (plan.decision.clarification_needed) {
        clarificationTriggered++;
      }
    }

    // 5. Strict Financial Safety check
    // Pending or planned payments must NEVER generate create_expense action
    if (
      /\b(pending|need to pay|plan to spend|have to pay|will pay|must pay)\b/i.test(item.input) &&
      !/\b(paid|spent|bought|received)\b/i.test(item.input)
    ) {
      const hasCreateExpense = plan.actions.some((a) => a.operation === 'create_expense');
      if (hasCreateExpense) {
        financialSafetyViolations++;
      }
    }

    details.push({
      id: item.id,
      input: item.input,
      intentsPassed,
      agentsPassed,
      statusPassed,
      actualIntents,
      actualAgents,
      actualStatus,
    });
  }

  const total = dataset.length;
  return {
    total,
    intentMatches,
    intentAccuracy: (intentMatches / total) * 100,
    agentMatches,
    agentAccuracy: (agentMatches / total) * 100,
    statusMatches,
    statusAccuracy: (statusMatches / total) * 100,
    clarificationExpected,
    clarificationTriggered,
    financialSafetyViolations,
    details,
  };
}
