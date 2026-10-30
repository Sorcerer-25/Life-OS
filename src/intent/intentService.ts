import { Config } from '../config/environment';
import { InputEvent } from '../models/InputEvent';
import { IdentificationResult, IntentIdentifier } from './identifier';
import { LlmIntentIdentifier } from './llmIdentifier';
import { GeminiProvider, LlmProvider } from './llmProvider';
import { RuleBasedIdentifier } from './ruleIdentifier';

export type IntentEngineMode = 'auto' | 'llm' | 'rules_only';

export class IntentService implements IntentIdentifier {
  private llmIdentifier: LlmIntentIdentifier;
  private ruleIdentifier: RuleBasedIdentifier;
  private mode: IntentEngineMode = 'auto';

  constructor(
    llmProvider?: LlmProvider,
    ruleIdentifier?: RuleBasedIdentifier,
    baseDate?: Date
  ) {
    this.ruleIdentifier = ruleIdentifier || new RuleBasedIdentifier(baseDate);

    const provider =
      llmProvider ||
      new GeminiProvider(
        () => Config.getGeminiApiKey(),
        () => Config.getLlmModel()
      );

    this.llmIdentifier = new LlmIntentIdentifier(provider, this.ruleIdentifier, baseDate);
  }

  public setMode(mode: IntentEngineMode): void {
    this.mode = mode;
  }

  public getMode(): IntentEngineMode {
    return this.mode;
  }

  public async identify(input: InputEvent): Promise<IdentificationResult> {
    if (this.mode === 'rules_only') {
      const res = await this.ruleIdentifier.identify(input);
      return {
        ...res,
        method: 'rule_based',
        warning: 'Engine running in explicit rules-only mode.',
      };
    }

    if (this.mode === 'llm' && !Config.isLlmConfigured()) {
      const res = await this.ruleIdentifier.identify(input);
      return {
        ...res,
        method: 'fallback_rule_based',
        warning: 'LLM mode selected but API key is missing. Used rule-based fallback.',
      };
    }

    // 'auto' or 'llm' with configured provider
    return await this.llmIdentifier.identify(input);
  }
}

// Default application instance
export const defaultIntentService = new IntentService();

