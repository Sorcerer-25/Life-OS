import { ActionPayload, AgentName } from './ActionPlan';

export interface AgentTask {
  taskId: string;
  requestId: string;
  actionId: string;
  agentName: AgentName;
  operation: string;
  data: ActionPayload | Record<string, unknown>;
  context?: Record<string, unknown>;
}

