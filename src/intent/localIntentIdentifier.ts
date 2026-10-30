import { InputEvent } from '../models/InputEvent';
import {
  DetectedIntent,
  IntentAnalysis,
  UnsupportedComponent,
} from '../models/IntentAnalysis';
import { detectCalendarIntent } from './detectors/calendarDetector';
import { detectExpenseIntent } from './detectors/expenseDetector';
import { detectReminderIntent } from './detectors/reminderDetector';
import { detectTaskIntent } from './detectors/taskDetector';
import { detectUnsupportedCapability } from './detectors/unsupportedDetector';
import { IdentificationResult, IntentIdentifier } from './identifier';
import { validateIntentAnalysis } from './intentAnalysisValidator';
import { normalizeAndSegmentInput } from './normalization/normalizeInput';

export class LocalIntentIdentifier implements IntentIdentifier {
  private baseDate?: Date;

  constructor(baseDate?: Date) {
    this.baseDate = baseDate;
  }

  public async identify(input: InputEvent): Promise<IdentificationResult> {
    const startTime = Date.now();
    const raw = input.rawText.trim();
    const now = this.baseDate || new Date(input.timestamp || Date.now());

    const analysis = this.analyze(input, raw, now);
    const validation = validateIntentAnalysis(analysis);

    if (!validation.success || !validation.data) {
      // Safe fallback if internal validation ever fails
      const fallbackAnalysis: IntentAnalysis = {
        request_id: input.requestId,
        source: {
          type: input.sourceType,
          raw_input: input.rawText,
          timestamp: input.timestamp,
          source_app: input.sourceApp ?? null,
        },
        intents: [],
        ordering_hints: [],
        overall_missing: ['internal_parsing_error'],
        unsupported_components: [],
        unrecognized_components: [raw],
      };

      return {
        analysis: fallbackAnalysis,
        method: 'rule_based',
        warning: `Local parser validation error: ${validation.errors?.join(', ')}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    return {
      analysis: validation.data,
      method: 'rule_based',
      executionTimeMs: Date.now() - startTime,
    };
  }

  private analyze(input: InputEvent, rawText: string, now: Date): IntentAnalysis {
    const normalized = normalizeAndSegmentInput(rawText);

    const detectedIntents: DetectedIntent[] = [];
    const unsupportedComponents: UnsupportedComponent[] = [];
    const unrecognizedComponents: string[] = [];

    let currentSequence = 1;

    for (const segment of normalized.segments) {
      const segText = segment.text.trim();
      if (!segText) continue;

      // 1. Check for unsupported capabilities first (e.g. Flight booking, Hotel reservation)
      const unsupported = detectUnsupportedCapability(segText);
      if (unsupported) {
        unsupportedComponents.push(unsupported);
        continue;
      }

      // 2. Try specialized domain detectors in order
      let detected: DetectedIntent | null = null;

      // Expense / Finance
      detected = detectExpenseIntent(segText, currentSequence, now);

      // Reminder (bills or general reminders)
      if (!detected) {
        detected = detectReminderIntent(segText, currentSequence, now);
      }

      // Tasks
      if (!detected) {
        detected = detectTaskIntent(segText, currentSequence, now);
      }

      // Calendar
      if (!detected) {
        detected = detectCalendarIntent(segText, currentSequence, now);
      }

      // 3. If an intent is matched, add it
      if (detected) {
        detectedIntents.push(detected);
        currentSequence++;
      } else {
        // 4. Unrecognized input (e.g. "Blue seven running quickly.")
        unrecognizedComponents.push(segText);
      }
    }

    // Filter ordering hints to only reference valid detected intent sequences
    const validSeqSet = new Set(detectedIntents.map((i) => i.sequence));
    const validOrderingHints = normalized.orderingHints.filter(
      (h) =>
        validSeqSet.has(h.from_sequence) &&
        validSeqSet.has(h.to_sequence) &&
        h.from_sequence !== h.to_sequence
    );

    const overallMissing: string[] = [];
    if (detectedIntents.length === 0 && unsupportedComponents.length === 0) {
      overallMissing.push('unrecognized_input');
    }

    return {
      request_id: input.requestId,
      source: {
        type: input.sourceType,
        raw_input: input.rawText,
        timestamp: input.timestamp,
        source_app: input.sourceApp ?? null,
      },
      intents: detectedIntents,
      ordering_hints: validOrderingHints,
      overall_missing: overallMissing,
      unsupported_components: unsupportedComponents,
      unrecognized_components: unrecognizedComponents,
    };
  }
}

