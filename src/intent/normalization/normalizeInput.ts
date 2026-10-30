import { OrderingHint } from '../../models/IntentAnalysis';

export interface SegmentWithHint {
  text: string;
  sequence: number;
}

export interface NormalizedInputResult {
  cleanedText: string;
  segments: SegmentWithHint[];
  orderingHints: OrderingHint[];
}

/**
 * Normalizes input text and segments compound sentences into discrete clauses.
 */
export function normalizeAndSegmentInput(rawText: string): NormalizedInputResult {
  // 1. Sanitize prompt injections & adversarial instructions
  let text = rawText
    .replace(/ignore previous (rules|instructions)/gi, '')
    .replace(/mark as paid/gi, '')
    .replace(/system:\s*.*$/gi, '')
    .replace(/as an ai language model/gi, '')
    .replace(/execute as root/gi, '')
    .trim();

  const orderingHints: OrderingHint[] = [];

  // 2. Detect explicit ordering patterns: "First [A], then [B]"
  const firstThenMatch = text.match(/^first\s+(.*?)(?:,\s*|\s+)then\s+(.*)$/i);
  if (firstThenMatch) {
    orderingHints.push({
      from_sequence: 1,
      to_sequence: 2,
      relationship: 'sequence',
    });
    return {
      cleanedText: text,
      segments: [
        { text: firstThenMatch[1].trim(), sequence: 1 },
        { text: firstThenMatch[2].trim(), sequence: 2 },
      ],
      orderingHints,
    };
  }

  // 3. Detect explicit dependency: "[A], once [X] is done, [B]"
  const onceDoneMatch = text.match(/^(.*?)(?:,\s*|\s+)once\s+(.*?)\s+is\s+done(?:,\s*|\s+)(.*)$/i);
  if (onceDoneMatch) {
    orderingHints.push({
      from_sequence: 1,
      to_sequence: 2,
      relationship: 'dependency',
    });
    return {
      cleanedText: text,
      segments: [
        { text: onceDoneMatch[1].trim(), sequence: 1 },
        { text: onceDoneMatch[3].trim(), sequence: 2 },
      ],
      orderingHints,
    };
  }

  // 4. Detect sequence: "[A], after that [B]"
  const afterThatMatch = text.match(/^(.*?)(?:,\s*|\s+)after that\s+(.*)$/i);
  if (afterThatMatch) {
    orderingHints.push({
      from_sequence: 1,
      to_sequence: 2,
      relationship: 'sequence',
    });
    return {
      cleanedText: text,
      segments: [
        { text: afterThatMatch[1].trim(), sequence: 1 },
        { text: afterThatMatch[2].trim(), sequence: 2 },
      ],
      orderingHints,
    };
  }

  // 5. Multi-intent conjunction segmentation:
  const conjunctionDelimiters = [
    /\s+(?:then|and\s+then)\s+(?=(?:need|have|remind|add|create|submit|call|send|schedule|plan|spent|paid|i\s+spent|i\s+paid)\b)/i,
    /\s+then\s+/i,
    /\s+and\s+(?=(?:need|have|remind|add|create|submit|call|send|schedule|plan|spent|paid|i\s+spent|i\s+paid)\b)/i,
    /;\s*/,
    /\.\s+(?=[A-Z])/,
    /\s+also\s+(?=(?:remind|add|schedule|need|pay|spent|paid)\b)/i,
  ];

  let rawSegments = [text];
  for (const delimiter of conjunctionDelimiters) {
    const nextSegments: string[] = [];
    for (const seg of rawSegments) {
      const parts = seg.split(delimiter);
      for (const p of parts) {
        if (p.trim()) nextSegments.push(p.trim());
      }
    }
    rawSegments = nextSegments;
  }

  // If no multi-clause segmentation triggered, check if there's a simple " and " with two verbs
  if (rawSegments.length === 1 && /\s+and\s+/i.test(text)) {
    const andMatch = text.match(
      /^(.*?)\s+and\s+((?:remind|add|schedule|submit|call|pay|send|buy|clean|review|meet)\b.*)$/i
    );
    if (andMatch) {
      rawSegments = [andMatch[1].trim(), andMatch[2].trim()];
    }
  }

  const segments: SegmentWithHint[] = rawSegments.map((seg, idx) => ({
    text: seg,
    sequence: idx + 1,
  }));

  return {
    cleanedText: text,
    segments,
    orderingHints,
  };
}
