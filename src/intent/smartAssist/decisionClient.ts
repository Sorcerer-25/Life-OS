import { SMART_ASSIST } from './config';
import { Questions } from './questions';

export type Answer = { confidence: number; noul: number } | {
  confidence: number; choice: string; probabilities: Record<string, number>;
};
export type Failure = 'invalid_key' | 'cooldown' | 'http' | 'safety' | 'malformed' | 'timeout' | 'cancelled' | 'network';
export type DecisionResult = { ok: true; answers: Record<string, Answer>; usage: Record<string, number> }
  | { ok: false; reason: Failure };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const probability = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

export function parseDecisionResponse(value: unknown, questions: Questions): DecisionResult {
  if (!record(value) || !record(value.answers)) return { ok: false, reason: 'malformed' };
  const answers: Record<string, Answer> = {};
  for (const [key, question] of Object.entries(questions)) {
    const a = value.answers[key];
    if (!record(a) || !probability(a.confidence)) return { ok: false, reason: 'malformed' };
    if (question.type === 'noul') {
      if (!probability(a.noul) || a.noul < 0.01 || a.noul > 0.99) return { ok: false, reason: 'malformed' };
      answers[key] = { noul: a.noul, confidence: a.confidence };
    } else {
      if (typeof a.choice !== 'string' || !Object.hasOwn(question.criteria, a.choice) || !record(a.probabilities)) return { ok: false, reason: 'malformed' };
      const probabilities: Record<string, number> = {};
      for (const option of Object.keys(question.criteria)) {
        const p = a.probabilities[option];
        if (!probability(p)) return { ok: false, reason: 'malformed' };
        probabilities[option] = p;
      }
      const total = Object.values(probabilities).reduce((sum, p) => sum + p, 0);
      if (Math.abs(total - 1) > 0.02 || Object.values(probabilities).some(p => p > probabilities[a.choice as string])) return { ok: false, reason: 'malformed' };
      answers[key] = { choice: a.choice, confidence: a.confidence, probabilities };
    }
  }
  const usage: Record<string, number> = {};
  if (record(value.usage)) for (const [key, n] of Object.entries(value.usage)) {
    if (/token/.test(key) && typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) usage[key] = n;
  }
  return { ok: true, answers, usage };
}
export function decisiveAnswer(a: Answer): string | boolean | undefined {
  if ('choice' in a) return a.confidence >= SMART_ASSIST.choiceConfidence && a.choice !== 'other' ? a.choice : undefined;
  return a.noul <= SMART_ASSIST.noulNo ? false : a.noul >= SMART_ASSIST.noulYes ? true : undefined;
}

/** Transport only. No call on construction, no logging, no downstream actions. */
export class DecisionClient {
  private cooldownUntil = 0;
  constructor(private readonly fetcher: (url: string, init?: RequestInit) => Promise<Response> = fetch, private readonly now = Date.now) {}
  async ask(key: string, maskedText: string, questions: Questions, options: {
    signal?: AbortSignal; onInvalidKey?: () => Promise<void>; retry?: boolean;
  } = {}): Promise<DecisionResult> {
    if (!key.trim()) return { ok: false, reason: 'invalid_key' };
    if (this.now() < this.cooldownUntil) return { ok: false, reason: 'cooldown' };
    if (options.signal?.aborted) return { ok: false, reason: 'cancelled' };
    const controller = new AbortController();
    let timeout = false;
    let rejectDeadline: (reason: Error) => void = () => {};
    const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
    const cancel = () => { controller.abort(); rejectDeadline(new Error('cancelled')); };
    options.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timeout = true; controller.abort(); rejectDeadline(new Error('timeout')); }, SMART_ASSIST.decisionTimeoutMs);
    try {
      for (let attempt = 0; attempt < (options.retry === false ? 1 : 2); attempt++) {
        let response: Response;
        try {
          response = await Promise.race([this.fetcher(SMART_ASSIST.decisionEndpoint, {
            method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: SMART_ASSIST.decisionModel, input: maskedText, questions }), signal: controller.signal,
          }), deadline]);
        } catch {
          if (controller.signal.aborted) return { ok: false, reason: timeout ? 'timeout' : 'cancelled' };
          if (attempt === 0 && options.retry !== false) continue;
          return { ok: false, reason: 'network' };
        }
        if (response.status === 401 || response.status === 403) {
          try { await options.onInvalidKey?.(); } catch { /* Never expose storage errors. */ }
          return { ok: false, reason: 'invalid_key' };
        }
        if (response.status === 429) {
          this.cooldownUntil = this.now() + SMART_ASSIST.cooldownMs;
          return { ok: false, reason: 'cooldown' };
        }
        if (response.status >= 500 && attempt === 0 && options.retry !== false) continue;
        let body: unknown;
        try { body = await Promise.race([response.json(), deadline]); }
        catch { return { ok: false, reason: timeout ? 'timeout' : controller.signal.aborted ? 'cancelled' : 'malformed' }; }
        if (!response.ok) {
          const safety = response.status === 400 && record(body) && record(body.error) && ['safety', 'blocklist'].includes(String(body.error.code));
          return { ok: false, reason: safety ? 'safety' : 'http' };
        }
        return parseDecisionResponse(body, questions);
      }
      return { ok: false, reason: 'network' };
    } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel); }
  }
}
