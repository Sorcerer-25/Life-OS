import { InputEvent } from '../models/InputEvent';
import { IdentificationResult, IntentIdentifier } from './identifier';
import { LocalIntentIdentifier } from './localIntentIdentifier';

/**
 * RuleBasedIdentifier is the local, deterministic Intent Identifier for LifeOS.
 * It delegates to the modular LocalIntentIdentifier pipeline.
 */
export class RuleBasedIdentifier implements IntentIdentifier {
  private localIdentifier: LocalIntentIdentifier;

  constructor(baseDate?: Date) {
    this.localIdentifier = new LocalIntentIdentifier(baseDate);
  }

  public async identify(input: InputEvent): Promise<IdentificationResult> {
    return this.localIdentifier.identify(input);
  }
}
