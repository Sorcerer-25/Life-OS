export type SupportedIntent =
  | 'expense_logged'
  | 'planned_expense'
  | 'set_reminder'
  | 'bill_payment_reminder'
  | 'add_task'
  | 'schedule_event'
  | 'unknown';

export interface IntentAnalysisSource {
  type: 'text' | 'voice' | 'notification';
  raw_input: string;
  timestamp: string; // ISO 8601
  source_app?: string | null;
}

export interface DetectedIntent {
  sequence: number; // 1-based, order of appearance, unique
  intent: SupportedIntent;
  confidence: number; // 0..1, model-reported, per intent
  entities: Record<string, unknown>; // canonical entities
  missing: string[]; // required entities missing for THIS intent
  raw_segment?: string; // the specific text segment matched
}

export interface OrderingHint {
  from_sequence: number; // runs first
  to_sequence: number; // runs after from_sequence
  relationship: 'sequence' | 'dependency';
}

export interface UnsupportedComponent {
  raw_text: string;
  capability: string; // e.g. "flight_booking", "hotel_search", "weather_query"
  reason: string; // clear explanation why LifeOS does not support this in Phase 1
}

export interface IntentAnalysis {
  request_id: string;
  source: IntentAnalysisSource;
  intents: DetectedIntent[];
  ordering_hints: OrderingHint[];
  overall_missing: string[]; // information affecting the whole request
  unsupported_components: UnsupportedComponent[];
  unrecognized_components: string[];
}
