import { InputEvent, SourceType } from '../models/InputEvent';

/**
 * Generates a unique request ID with a readable prefix and timestamp.
 */
export function generateRequestId(prefix: string = 'req'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Creates a normalized InputEvent for manual text input.
 */
export function createTextInputEvent(rawText: string): InputEvent {
  return {
    requestId: generateRequestId('req_text'),
    sourceType: 'text',
    rawText: rawText,
    sourceApp: null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generic factory for creating InputEvents (extensible for voice and notification later).
 */
export function createInputEvent(params: {
  rawText: string;
  sourceType: SourceType;
  sourceApp?: string | null;
  timestamp?: string;
  requestId?: string;
}): InputEvent {
  return {
    requestId: params.requestId || generateRequestId(`req_${params.sourceType}`),
    sourceType: params.sourceType,
    rawText: params.rawText,
    sourceApp: params.sourceApp ?? null,
    timestamp: params.timestamp || new Date().toISOString(),
  };
}

