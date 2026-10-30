import { AgentName } from './ActionPlan';

export type AgentStatus = 'success' | 'failure' | 'needs_clarification';

export interface AgentResult {
  taskId: string;
  actionId: string;
  agentName: AgentName;
  status: AgentStatus;
  message: string;
  output?: Record<string, unknown>;
  error?: string;
}

