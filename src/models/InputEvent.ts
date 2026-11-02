export type SourceType = 'text' | 'voice' | 'notification';

export interface InputEventMetadata {
  language?: string;
  recognition_confidence?: number;
  notificationId?: string;
  category?: string;
  [key: string]: unknown;
}

export interface InputEvent {
  requestId: string;
  sourceType: SourceType;
  /** Alias for sourceType */
  source?: SourceType;
  rawText: string;
  /** Alias for rawText */
  raw_input?: string;
  sourceApp?: string | null;
  /** Alias for sourceApp */
  source_app?: string | null;
  timestamp: string; // ISO 8601
  metadata?: InputEventMetadata;
}
