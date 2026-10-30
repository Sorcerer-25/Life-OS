import { InputEvent } from '../models/InputEvent';
import { IntentAnalysis } from '../models/IntentAnalysis';

export type IdentificationMethod = 'llm' | 'rule_based' | 'fallback_rule_based';

export interface IdentificationResult {
  analysis: IntentAnalysis;
  method: IdentificationMethod;
  warning?: string;
  executionTimeMs?: number;
}

export interface IntentIdentifier {
  identify(input: InputEvent): Promise<IdentificationResult>;
}
