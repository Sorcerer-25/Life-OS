import { AgentName } from './ActionPlan';

export interface AgentTask {
  taskId: string;
  requestId: string;
  actionId: string;
  agentName: AgentName;
  operation: string;
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
}

