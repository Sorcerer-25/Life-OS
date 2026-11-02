import { ActionPlan, AgentName } from '../models/ActionPlan';
import { AgentResult } from '../models/AgentResult';
import { AgentTask } from '../models/AgentTask';
import { ReminderAgent, defaultReminderAgent } from './reminderAgent';

export interface Agent {
  readonly name: AgentName;
  execute(task: AgentTask): Promise<AgentResult>;
}

export class AgentRegistry {
  private agents: Map<AgentName, Agent> = new Map();

  constructor() {
    // Register Phase 1.8A agents
    this.register(defaultReminderAgent);
  }

  public register(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }

  public get(name: AgentName): Agent | undefined {
    return this.agents.get(name);
  }

  public has(name: AgentName): boolean {
    return this.agents.has(name);
  }
}

export class AgentDispatcher {
  private registry: AgentRegistry;

  constructor(registry?: AgentRegistry) {
    this.registry = registry || new AgentRegistry();
  }

  /**
   * Dispatches eligible actions from an ActionPlan.
   * Only ready actions are executed. Incomplete or clarification-requiring actions are never executed.
   */
  public async dispatch(actionPlan: ActionPlan): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    // Safety: If overall workflow is rejected or unsupported, no actions run
    if (
      actionPlan.decision.workflow_status === 'rejected' ||
      actionPlan.decision.workflow_status === 'unsupported'
    ) {
      return results;
    }

    for (const action of actionPlan.actions) {
      const taskId = `task_${action.action_id}`;

      // Incomplete actions requiring clarification are held back
      if (action.status === 'needs_clarification') {
        results.push({
          taskId,
          actionId: action.action_id,
          agentName: action.agent,
          status: 'needs_clarification',
          message:
            action.clarification_prompt ||
            `Action '${action.action_id}' requires user clarification before execution.`,
        });
        continue;
      }

      // Blocked actions are not dispatched
      if (action.status === 'blocked') {
        results.push({
          taskId,
          actionId: action.action_id,
          agentName: action.agent,
          status: 'failure',
          message: `Action '${action.action_id}' is blocked by dependencies.`,
          error: 'ACTION_BLOCKED',
        });
        continue;
      }

      // Check if action is ready
      if (action.status !== 'ready') {
        continue;
      }

      const agent = this.registry.get(action.agent);
      if (!agent) {
        // Agent not yet implemented in Phase 1.8A (e.g. Finance Agent, Calendar Agent)
        results.push({
          taskId,
          actionId: action.action_id,
          agentName: action.agent,
          status: 'failure',
          message: `Agent '${action.agent}' is not yet implemented or enabled in LifeOS Phase 1.8A.`,
          error: 'AGENT_NOT_REGISTERED',
        });
        continue;
      }

      // Construct typed AgentTask
      const task: AgentTask = {
        taskId,
        requestId: actionPlan.request_id,
        actionId: action.action_id,
        agentName: action.agent,
        operation: action.operation,
        data: action.data,
      };

      try {
        const result = await agent.execute(task);
        results.push(result);
      } catch (err: unknown) {
        results.push({
          taskId,
          actionId: action.action_id,
          agentName: action.agent,
          status: 'failure',
          message: `Unexpected error executing action '${action.action_id}': ${(err as Error).message}`,
          error: 'UNEXPECTED_EXECUTION_ERROR',
        });
      }
    }

    return results;
  }
}

export const defaultAgentRegistry = new AgentRegistry();
export const defaultAgentDispatcher = new AgentDispatcher(defaultAgentRegistry);

