import { InputEvent } from '../models/InputEvent';
import { IdentificationResult, IntentIdentifier } from './identifier';
import { LocalIntentIdentifier } from './localIntentIdentifier';

export type IntentEngineMode = 'local_rules' | 'auto' | 'rules_only' | 'llm';

export class IntentService implements IntentIdentifier {
  private localIdentifier: LocalIntentIdentifier;
  private mode: IntentEngineMode = 'local_rules';

  constructor(
    _llmProvider?: unknown,
    _ruleIdentifier?: unknown,
    baseDate?: Date
  ) {
    this.localIdentifier = new LocalIntentIdentifier(baseDate);
  }

  public setMode(mode: IntentEngineMode): void {
    this.mode = mode;
  }

  public getMode(): IntentEngineMode {
    return this.mode;
  }

  public async identify(input: InputEvent): Promise<IdentificationResult> {
    const res = await this.localIdentifier.identify(input);
    return {
      ...res,
      method: 'rule_based',
    };
  }
}

// Default application instance
export const defaultIntentService = new IntentService();
