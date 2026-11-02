import { Linking, Platform } from 'react-native';

export type VoiceLanguage = 'en-IN' | 'en-US';

export interface VoicePermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
}

export interface VoiceRecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}

export type VoiceRecognitionState = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceServiceCallbacks {
  onResult: (result: VoiceRecognitionResult) => void;
  onError: (errorMessage: string, errorCode?: string) => void;
  onStateChange?: (state: VoiceRecognitionState) => void;
}

let speechModule: any = null;

try {
  // Dynamically require to avoid crash if native module is missing or in mock environment
  const imported = require('expo-speech-recognition');
  speechModule = imported.ExpoSpeechRecognitionModule;
} catch (e) {
  console.warn('[VoiceService] expo-speech-recognition native module not available:', e);
}

export class VoiceService {
  private activeListenerSubscriptions: Array<{ remove: () => void }> = [];
  private currentState: VoiceRecognitionState = 'idle';

  public isAvailable(): boolean {
    return speechModule != null;
  }

  public async getPermissionsAsync(): Promise<VoicePermissionStatus> {
    if (!speechModule) {
      return { granted: false, canAskAgain: true, status: 'undetermined' };
    }

    try {
      const res = await speechModule.getPermissionsAsync();
      return {
        granted: res.granted,
        canAskAgain: res.canAskAgain,
        status: res.status as 'granted' | 'denied' | 'undetermined',
      };
    } catch (err) {
      console.warn('[VoiceService] Error checking permissions:', err);
      return { granted: false, canAskAgain: true, status: 'undetermined' };
    }
  }

  public async requestPermissionsAsync(): Promise<VoicePermissionStatus> {
    if (!speechModule) {
      return { granted: false, canAskAgain: false, status: 'denied' };
    }

    try {
      const res = await speechModule.requestPermissionsAsync();
      return {
        granted: res.granted,
        canAskAgain: res.canAskAgain,
        status: res.status as 'granted' | 'denied' | 'undetermined',
      };
    } catch (err) {
      console.warn('[VoiceService] Error requesting permissions:', err);
      return { granted: false, canAskAgain: false, status: 'denied' };
    }
  }

  public async openSettingsAsync(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (err) {
      console.warn('[VoiceService] Failed to open system settings:', err);
    }
  }

  public async startListening(
    language: VoiceLanguage = 'en-IN',
    callbacks: VoiceServiceCallbacks
  ): Promise<boolean> {
    if (!speechModule) {
      callbacks.onError(
        'Speech recognition requires an Expo development build with native modules on your device.',
        'module_unavailable'
      );
      this.setState('error', callbacks);
      return false;
    }

    // 1. Verify permissions
    const permission = await this.requestPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        callbacks.onError(
          'Microphone permission is permanently denied. Please enable it in Settings.',
          'permanently_denied'
        );
      } else {
        callbacks.onError('Microphone permission was denied.', 'denied');
      }
      this.setState('error', callbacks);
      return false;
    }

    // 2. Clear any lingering listeners
    this.cleanupListeners();

    try {
      this.setState('listening', callbacks);

      // Listen to speech results (interim and final)
      const resultSub = speechModule.addListener('result', (event: any) => {
        if (!event?.results || event.results.length === 0) return;

        const best = event.results[0];
        const transcript = best.transcript || '';
        const confidence = best.confidence !== -1 ? best.confidence : undefined;
        const isFinal = Boolean(event.isFinal);

        if (isFinal) {
          this.setState('idle', callbacks);
        }

        callbacks.onResult({
          transcript,
          isFinal,
          confidence,
        });
      });
      this.activeListenerSubscriptions.push(resultSub);

      // Listen to speech recognition errors
      const errorSub = speechModule.addListener('error', (event: any) => {
        const mappedMsg = this.mapErrorMessage(event?.error, event?.message);
        this.setState('error', callbacks);
        callbacks.onError(mappedMsg, event?.error || 'unknown');
      });
      this.activeListenerSubscriptions.push(errorSub);

      // Listen to start and end
      const startSub = speechModule.addListener('start', () => {
        this.setState('listening', callbacks);
      });
      this.activeListenerSubscriptions.push(startSub);

      const endSub = speechModule.addListener('end', () => {
        if (this.currentState === 'listening') {
          this.setState('idle', callbacks);
        }
      });
      this.activeListenerSubscriptions.push(endSub);

      // Start native speech recognizer
      speechModule.start({
        lang: language,
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        requiresOnDeviceRecognition: false, // fallback to device default
      });

      return true;
    } catch (err: any) {
      console.warn('[VoiceService] Failed to start speech recognition:', err);
      const msg = err?.message || 'Failed to start microphone service';
      callbacks.onError(msg, 'start_failed');
      this.setState('error', callbacks);
      this.cleanupListeners();
      return false;
    }
  }

  public async stopListening(): Promise<void> {
    if (!speechModule) return;
    try {
      speechModule.stop();
      this.setState('idle');
    } catch (err) {
      console.warn('[VoiceService] Failed to stop listening:', err);
    }
  }

  public async abortListening(): Promise<void> {
    if (!speechModule) return;
    try {
      speechModule.abort();
      this.setState('idle');
    } catch (err) {
      console.warn('[VoiceService] Failed to abort listening:', err);
    } finally {
      this.cleanupListeners();
    }
  }

  private cleanupListeners(): void {
    for (const sub of this.activeListenerSubscriptions) {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    }
    this.activeListenerSubscriptions = [];
  }

  private setState(state: VoiceRecognitionState, callbacks?: VoiceServiceCallbacks): void {
    this.currentState = state;
    callbacks?.onStateChange?.(state);
  }

  public getState(): VoiceRecognitionState {
    return this.currentState;
  }

  private mapErrorMessage(errorCode?: string, fallbackMessage?: string): string {
    switch (errorCode) {
      case 'no-speech':
      case 'speech-timeout':
        return 'No speech detected. Please speak clearly into the microphone.';
      case 'audio-capture':
        return 'Audio recording failed. Please check microphone settings.';
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Microphone or speech recognition permission was denied.';
      case 'network':
        return 'Network communication failed during speech recognition.';
      case 'busy':
        return 'Speech recognition service is currently busy. Please try again.';
      case 'language-not-supported':
        return 'Selected language model is not supported on this device.';
      default:
        return fallbackMessage || 'Speech recognition encountered an unexpected error.';
    }
  }
}

export const defaultVoiceService = new VoiceService();

