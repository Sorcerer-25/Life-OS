import { InputEvent, InputEventMetadata, SourceType } from '../models/InputEvent';

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
  const ts = new Date().toISOString();
  return {
    requestId: generateRequestId('req_text'),
    sourceType: 'text',
    source: 'text',
    rawText: rawText,
    raw_input: rawText,
    sourceApp: null,
    source_app: null,
    timestamp: ts,
  };
}

export interface CreateVoiceInputParams {
  rawTranscript: string;
  language?: string;
  confidence?: number;
  timestamp?: string;
  requestId?: string;
  metadata?: InputEventMetadata;
}

/**
 * Creates a normalized InputEvent for voice input.
 */
export function createVoiceInputEvent(params: CreateVoiceInputParams): InputEvent {
  const ts = params.timestamp || new Date().toISOString();
  const raw = params.rawTranscript;
  return {
    requestId: params.requestId || generateRequestId('req_voice'),
    sourceType: 'voice',
    source: 'voice',
    rawText: raw,
    raw_input: raw,
    sourceApp: null,
    source_app: null,
    timestamp: ts,
    metadata: {
      language: params.language || 'en-IN',
      recognition_confidence: params.confidence,
      ...params.metadata,
    },
  };
}

export interface CreateNotificationInputParams {
  rawText: string;
  sourceApp: string;
  notificationId?: string;
  category?: string;
  timestamp?: string;
  requestId?: string;
  metadata?: InputEventMetadata;
}

/**
 * Creates a normalized InputEvent for notification input.
 */
export function createNotificationInputEvent(params: CreateNotificationInputParams): InputEvent {
  const ts = params.timestamp || new Date().toISOString();
  return {
    requestId: params.requestId || generateRequestId('req_notif'),
    sourceType: 'notification',
    source: 'notification',
    rawText: params.rawText,
    raw_input: params.rawText,
    sourceApp: params.sourceApp,
    source_app: params.sourceApp,
    timestamp: ts,
    metadata: {
      notificationId: params.notificationId,
      category: params.category,
      ...params.metadata,
    },
  };
}

/**
 * Generic factory for creating InputEvents.
 */
export function createInputEvent(params: {
  rawText?: string;
  raw_input?: string;
  sourceType?: SourceType;
  source?: SourceType;
  sourceApp?: string | null;
  source_app?: string | null;
  timestamp?: string;
  requestId?: string;
  metadata?: InputEventMetadata;
}): InputEvent {
  const resolvedType = params.sourceType || params.source || 'text';
  const resolvedText = params.rawText ?? params.raw_input ?? '';
  const resolvedApp = params.sourceApp ?? params.source_app ?? null;
  const ts = params.timestamp || new Date().toISOString();

  return {
    requestId: params.requestId || generateRequestId(`req_${resolvedType}`),
    sourceType: resolvedType,
    source: resolvedType,
    rawText: resolvedText,
    raw_input: resolvedText,
    sourceApp: resolvedApp,
    source_app: resolvedApp,
    timestamp: ts,
    metadata: params.metadata,
  };
}
