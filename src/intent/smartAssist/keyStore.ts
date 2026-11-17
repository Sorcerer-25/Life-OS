import * as SecureStore from 'expo-secure-store';
import { DecisionClient } from './decisionClient';
import { KEY_TEST_QUESTIONS } from './questions';
import { assistPreferences } from './preferences';

type KeyStatus = 'verified' | 'unverified' | 'invalid';
type KeyRecord = { key: string; status: KeyStatus };
export type KeyResult = 'Key works' | 'Key invalid' | 'Cannot reach the service' | 'Not verified' | 'Storage unavailable';
const SLOT = 'lifeos.smart_assist.key';
const nativeStore = {
  read: () => SecureStore.getItemAsync(SLOT),
  write: (value: string) => SecureStore.setItemAsync(SLOT, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  remove: () => SecureStore.deleteItemAsync(SLOT),
};

export class AssistKeyStore {
  private disabled = false;
  private generation = 0;
  private invalidNotice = false;
  constructor(private store = nativeStore, private preferences = assistPreferences, private client = new DecisionClient()) {}
  private async read(): Promise<KeyRecord | undefined> {
    try {
      const raw = await this.store.read();
      if (!raw) return undefined;
      const value = JSON.parse(raw);
      if (typeof value.key !== 'string' || !value.key || !['verified', 'unverified', 'invalid'].includes(value.status)) return undefined;
      return value;
    } catch { return undefined; }
  }
  async summary(): Promise<{ status: KeyStatus | 'missing'; last4?: string }> {
    const value = await this.read();
    return value ? { status: value.status, last4: value.key.slice(-4) } : { status: 'missing' };
  }
  /** For transport use only; never pass this result to UI, history, or logging. */
  async verifiedKey(): Promise<string | undefined> {
    if (this.disabled) return undefined;
    const value = await this.read();
    return value?.status === 'verified' ? value.key : undefined;
  }
  consumeInvalidNotice(): boolean {
    const notice = this.invalidNotice; this.invalidNotice = false; return notice;
  }
  async markInvalid(): Promise<void> {
    this.disabled = true;
    const value = await this.read();
    if (!value || value.status === 'invalid') return;
    this.invalidNotice = true;
    try { await this.store.write(JSON.stringify({ ...value, status: 'invalid' })); } catch { /* Fail closed in memory. */ }
  }
  async saveAndTest(candidate: string, options: { offline?: boolean; saveUnverified?: boolean } = {}): Promise<KeyResult> {
    const generation = ++this.generation;
    const key = candidate.trim();
    if (!key || /\s/.test(key)) return 'Key invalid';
    let status: KeyStatus = 'verified';
    if (options.offline) {
      if (!options.saveUnverified) return 'Cannot reach the service';
      status = 'unverified';
    } else {
      // Explicit validation is the only call allowed before a key is verified.
      const result = await this.client.ask(key, 'ready', KEY_TEST_QUESTIONS, { retry: false });
      if (!result.ok) return result.reason === 'invalid_key' ? 'Key invalid' : 'Cannot reach the service';
    }
    if (generation !== this.generation) return 'Cannot reach the service';
    try {
      await this.store.write(JSON.stringify({ key, status }));
      this.disabled = false; this.invalidNotice = false;
      return status === 'verified' ? 'Key works' : 'Not verified';
    } catch { return 'Storage unavailable'; }
  }
  async testSaved(): Promise<KeyResult> {
    const value = await this.read();
    if (!value) return 'Key invalid';
    const result = await this.saveAndTest(value.key);
    if (result === 'Key invalid') await this.markInvalid();
    return result;
  }
  async remove(): Promise<boolean> {
    ++this.generation; this.disabled = true; this.invalidNotice = false;
    let success = true;
    try { await this.store.remove(); } catch { success = false; }
    try { await this.preferences.save({ ...await this.preferences.load(), master: false }); } catch { success = false; }
    return success;
  }
}
