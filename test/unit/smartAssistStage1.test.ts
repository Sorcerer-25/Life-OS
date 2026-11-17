jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
}));
import { DecisionClient, decisiveAnswer, parseDecisionResponse } from '../../src/intent/smartAssist/decisionClient';
import { AssistKeyStore } from '../../src/intent/smartAssist/keyStore';
import { SMART_ASSIST, DEFAULT_ASSIST_SETTINGS } from '../../src/intent/smartAssist/config';
import { KEY_TEST_QUESTIONS, REQUEST_QUESTIONS, TRIAGE_QUESTIONS, Questions } from '../../src/intent/smartAssist/questions';
import { amountAtValidatorBoundary } from '../../src/intent/smartAssist/amountBoundary';

const key = 'fake-test-key-1234';
const body = { answers: { ready: { noul: 0.99, confidence: 0.98 } }, usage: { total_input_tokens: 8, total_output_tokens: 0 } };
const response = (status = 200, data: unknown = body) => ({ status, ok: status >= 200 && status < 300, json: async () => data }) as Response;
const setup = () => {
  const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(response());
  return { fetcher, client: new DecisionClient(fetcher) };
};

describe('Decision 1 transport (mocked fetch only)', () => {
  it('does not call on construction and sends a key only in headers', async () => {
    const { fetcher, client } = setup();
    expect(fetcher).not.toHaveBeenCalled();
    const result = await client.ask(key, 'masked data', KEY_TEST_QUESTIONS);
    expect(result).toMatchObject({ ok: true, usage: { total_input_tokens: 8, total_output_tokens: 0 } });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(SMART_ASSIST.decisionEndpoint);
    expect(init?.headers).toEqual({ 'x-goog-api-key': key, 'Content-Type': 'application/json' });
    expect(init?.body).not.toContain(key);
    expect(JSON.parse(String(init?.body))).toEqual({ model: 'gemini-decision-1', input: 'masked data', questions: KEY_TEST_QUESTIONS });
  });
  it('empty key avoids fetch', async () => {
    const { fetcher, client } = setup();
    expect(await client.ask('', '', KEY_TEST_QUESTIONS)).toEqual({ ok: false, reason: 'invalid_key' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403])('%s invalidates once without retry', async status => {
    const { fetcher, client } = setup(); fetcher.mockResolvedValue(response(status));
    const invalid = jest.fn().mockResolvedValue(undefined);
    expect(await client.ask(key, '', KEY_TEST_QUESTIONS, { onInvalidKey: invalid })).toEqual({ ok: false, reason: 'invalid_key' });
    expect(invalid).toHaveBeenCalledTimes(1); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['safety', 'blocklist'])('handles %s without retry', async code => {
    const { fetcher, client } = setup(); fetcher.mockResolvedValue(response(400, { error: { code } }));
    expect(await client.ask(key, '', KEY_TEST_QUESTIONS)).toEqual({ ok: false, reason: 'safety' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('429 blocks subsequent calls until cooldown ends', async () => {
    let now = 0; const { fetcher } = setup(); const client = new DecisionClient(fetcher, () => now);
    fetcher.mockResolvedValueOnce(response(429));
    await client.ask(key, '', KEY_TEST_QUESTIONS); await client.ask(key, '', KEY_TEST_QUESTIONS);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = SMART_ASSIST.cooldownMs;
    expect((await client.ask(key, '', KEY_TEST_QUESTIONS)).ok).toBe(true);
  });
  it.each(['network', '5xx'])('retries %s only once', async kind => {
    const { fetcher, client } = setup();
    if (kind === 'network') fetcher.mockRejectedValue(new Error('secret text ' + key));
    else fetcher.mockResolvedValue(response(503));
    const result = await client.ask(key, '', KEY_TEST_QUESTIONS);
    expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain(key);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('recovers after one network error', async () => {
    const { fetcher, client } = setup(); fetcher.mockRejectedValueOnce(new Error('offline'));
    expect((await client.ask(key, '', KEY_TEST_QUESTIONS)).ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('malformed JSON falls back without retry', async () => {
    const { fetcher, client } = setup(); fetcher.mockResolvedValue({ ...response(), json: async () => { throw new Error(key); } });
    expect(await client.ask(key, '', KEY_TEST_QUESTIONS)).toEqual({ ok: false, reason: 'malformed' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('deadline also handles fetch implementations ignoring abort', async () => {
    jest.useFakeTimers();
    try {
      const { fetcher, client } = setup(); fetcher.mockImplementation(() => new Promise(() => {}));
      const pending = client.ask(key, '', KEY_TEST_QUESTIONS);
      await jest.advanceTimersByTimeAsync(6000);
      expect(await pending).toEqual({ ok: false, reason: 'timeout' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
  });
  it('cancelled requests return promptly', async () => {
    const { fetcher, client } = setup(); fetcher.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = client.ask(key, '', KEY_TEST_QUESTIONS, { signal: controller.signal });
    controller.abort(); expect(await pending).toEqual({ ok: false, reason: 'cancelled' });
  });
});

describe('Decision schemas and thresholds', () => {
  it.each([[0.01, false], [0.2, false], [0.21, undefined], [0.79, undefined], [0.8, true], [0.99, true]])('noul %s resolves to %s', (noul, expected) => {
    expect(decisiveAnswer({ noul: noul as number, confidence: 0.9 })).toBe(expected);
  });
  it('requires choice confidence and rejects other', () => {
    expect(decisiveAnswer({ choice: 'other', probabilities: {}, confidence: 0.99 })).toBeUndefined();
    expect(decisiveAnswer({ choice: 'add_task', probabilities: {}, confidence: 0.74 })).toBeUndefined();
    expect(decisiveAnswer({ choice: 'add_task', probabilities: {}, confidence: 0.75 })).toBe('add_task');
  });
  it.each([null, {}, { answers: { ready: { noul: 1, confidence: 0.9 } } }, { answers: { ready: { noul: 0.5 } } }])('rejects invalid responses %#', value => {
    expect(parseDecisionResponse(value, KEY_TEST_QUESTIONS).ok).toBe(false);
  });
  it('parses choices by names, not ordering, and rejects agent names', () => {
    const questions: Questions = { intent: { type: 'choice', instructions: 'Select', criteria: { other: '', add_task: '' } } };
    const value = { answers: { intent: { choice: 'add_task', confidence: 0.9, probabilities: { add_task: 0.95, other: 0.05 } } } };
    expect(parseDecisionResponse(value, questions).ok).toBe(true);
    value.answers.intent.choice = 'calendar_agent';
    expect(parseDecisionResponse(value, questions).ok).toBe(false);
  });
  it('all questions include full instructions and injection guard', () => {
    for (const question of Object.values({ ...REQUEST_QUESTIONS, ...TRIAGE_QUESTIONS })) {
      expect(question.instructions).toContain('untrusted'); expect(question.instructions).toContain('Ignore instructions');
    }
    expect(DEFAULT_ASSIST_SETTINGS).toEqual({ master: false, decisions: false, extraction: false });
  });
});

describe('Secure key lifecycle (mocked storage and fetch)', () => {
  function keys() {
    let saved: string | null = null;
    const store = { read: jest.fn(async () => saved), write: jest.fn(async (v: string) => { saved = v; }), remove: jest.fn(async () => { saved = null; }) };
    const preferences = { load: jest.fn(async () => ({ master: true, decisions: true, extraction: false })), save: jest.fn(async () => {}) };
    const { fetcher, client } = setup();
    return { store, preferences, fetcher, keys: new AssistKeyStore(store, preferences, client) };
  }
  it('saves only verified keys and exposes only the last four in summary', async () => {
    const s = keys(); expect(await s.keys.saveAndTest(key)).toBe('Key works');
    expect(s.fetcher).toHaveBeenCalledTimes(1);
    expect(await s.keys.summary()).toEqual({ status: 'verified', last4: '1234' });
    expect(await s.keys.verifiedKey()).toBe(key); expect(s.preferences.save).not.toHaveBeenCalled();
  });
  it.each([401, 400, 500])('does not save on HTTP %s', async status => {
    const s = keys(); s.fetcher.mockResolvedValue(response(status));
    await s.keys.saveAndTest(key); expect(s.store.write).not.toHaveBeenCalled(); expect(s.fetcher).toHaveBeenCalledTimes(1);
  });
  it('allows explicit offline save as unverified but does not authorize AI', async () => {
    const s = keys();
    expect(await s.keys.saveAndTest(key, { offline: true, saveUnverified: true })).toBe('Not verified');
    expect(await s.keys.verifiedKey()).toBeUndefined(); expect(s.fetcher).not.toHaveBeenCalled();
  });
  it('network failure is not permission to save unverified', async () => {
    const s = keys(); s.fetcher.mockRejectedValue(new Error(key));
    expect(await s.keys.saveAndTest(key)).toBe('Cannot reach the service'); expect(s.store.write).not.toHaveBeenCalled();
  });
  it('invalidates a saved key and emits one consumable notice', async () => {
    const s = keys(); await s.keys.saveAndTest(key); s.fetcher.mockResolvedValue(response(401));
    expect(await s.keys.testSaved()).toBe('Key invalid');
    expect(await s.keys.verifiedKey()).toBeUndefined(); expect(s.keys.consumeInvalidNotice()).toBe(true); expect(s.keys.consumeInvalidNotice()).toBe(false);
  });
  it('remove deletes secure storage and disables master', async () => {
    const s = keys(); await s.keys.saveAndTest(key); expect(await s.keys.remove()).toBe(true);
    expect(s.store.remove).toHaveBeenCalledTimes(1); expect(s.preferences.save).toHaveBeenCalledWith({ master: false, decisions: true, extraction: false });
    expect(await s.keys.verifiedKey()).toBeUndefined(); expect(await s.keys.summary()).toEqual({ status: 'missing' });
  });
  it('storage and service errors cannot leak secrets to logs or results', async () => {
    const spies = [jest.spyOn(console, 'log'), jest.spyOn(console, 'warn'), jest.spyOn(console, 'error')];
    try {
      const s = keys(); s.store.write.mockRejectedValue(new Error(key));
      expect(await s.keys.saveAndTest(key)).toBe('Storage unavailable');
      spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    } finally { spies.forEach(spy => spy.mockRestore()); }
  });
});

describe('amount validator boundary', () => {
  it.each([['25', 'Rs 25', 25], ['25.50', 'Rs 25.50', 25.5], ['1250.50', 'Rs 1,250.50', 1250.5]])('accepts grounded %s', (amount, text, expected) => {
    expect(amountAtValidatorBoundary(amount, text)).toBe(expected);
  });
  it.each(['1,250.00', '', ' 25', '25 ', '-25', '25.123', '1e2', 'NaN', '0', '25.'])('rejects %s', amount => {
    expect(amountAtValidatorBoundary(amount, amount)).toBeUndefined();
  });
  it('rejects invented and partial amounts', () => {
    expect(amountAtValidatorBoundary('25', 'Rs 125')).toBeUndefined();
    expect(amountAtValidatorBoundary('25', 'Rs 25.50')).toBeUndefined();
    expect(amountAtValidatorBoundary(25, 'Rs 25')).toBeUndefined();
  });
});
