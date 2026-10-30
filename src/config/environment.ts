/**
 * Environment configuration for LifeOS.
 * Reads API keys and settings from process.env with fallback to in-memory overrides.
 *
 * NOTE: Production mobile apps must route LLM calls through a secure backend proxy
 * rather than storing provider API keys directly in client storage.
 */

interface LifeOsConfig {
  geminiApiKey?: string;
  llmModel: string;
  confidenceThreshold: number;
}

const currentConfig: LifeOsConfig = {
  geminiApiKey:
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    undefined,
  llmModel:
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_LLM_MODEL) ||
    'gemini-1.5-flash',
  confidenceThreshold: 0.6,
};

export const Config = {
  getGeminiApiKey(): string | undefined {
    return currentConfig.geminiApiKey;
  },

  setGeminiApiKey(key: string): void {
    currentConfig.geminiApiKey = key.trim() || undefined;
  },

  isLlmConfigured(): boolean {
    return Boolean(currentConfig.geminiApiKey && currentConfig.geminiApiKey.length > 5);
  },

  getLlmModel(): string {
    return currentConfig.llmModel;
  },

  setLlmModel(model: string): void {
    currentConfig.llmModel = model;
  },

  getConfidenceThreshold(): number {
    return currentConfig.confidenceThreshold;
  },

  setConfidenceThreshold(val: number): void {
    currentConfig.confidenceThreshold = Math.max(0, Math.min(1, val));
  },
};

