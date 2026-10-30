export type SourceType = 'text' | 'voice' | 'notification';

export interface InputEvent {
  requestId: string;
  sourceType: SourceType;
  rawText: string;
  sourceApp?: string | null;
  timestamp: string; // ISO 8601
}

