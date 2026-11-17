export const SMART_ASSIST = {
  decisionModel: 'gemini-decision-1',
  decisionEndpoint: 'https://generativelanguage.googleapis.com/v1beta/decisions',
  liteModel: 'gemini-3.1-flash-lite',
  liteThinking: null, // Structured extraction settings await verified specification.
  choiceConfidence: 0.75,
  noulNo: 0.2,
  noulYes: 0.8,
  offlineConfidence: 0.75,
  decisionTimeoutMs: 6000,
  liteTimeoutMs: 10000,
  cooldownMs: 60000,
  dailyCap: 100,
  cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  questionVersion: '1',
} as const;

export interface AssistSettings {
  master: boolean;
  decisions: boolean;
  extraction: boolean;
}
export const DEFAULT_ASSIST_SETTINGS: AssistSettings = { master: false, decisions: false, extraction: false };
