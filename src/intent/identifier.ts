import { ActionPlan } from '../models/ActionPlan';
import { InputEvent } from '../models/InputEvent';

export type IdentificationMethod = 'llm' | 'rule_based' | 'fallback_rule_based';

export interface IdentificationResult {
  plan: ActionPlan;
  method: IdentificationMethod;
  warning?: string;
  executionTimeMs?: number;
}

export interface IntentIdentifier {
  identify(input: InputEvent): Promise<IdentificationResult>;
}

