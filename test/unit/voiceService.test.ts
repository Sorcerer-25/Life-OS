import { ExpoSpeechRecognitionModule } from '../mocks/expo-speech-recognition-mock';
import { VoiceService } from '../../src/voice/voiceService';

describe('VoiceService Unit Tests', () => {
  let voiceService: VoiceService;

  beforeEach(() => {
    jest.clearAllMocks();
    voiceService = new VoiceService();
  });

  it('checks permissions successfully when granted', async () => {
    (ExpoSpeechRecognitionModule.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });

    const status = await voiceService.getPermissionsAsync();
    expect(status.granted).toBe(true);
    expect(status.status).toBe('granted');
  });

  it('handles permission denied properly', async () => {
    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
      granted: false,
      canAskAgain: true,
    });

    const onError = jest.fn();
    const started = await voiceService.startListening('en-IN', {
      onResult: jest.fn(),
      onError,
    });

    expect(started).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      'Microphone permission was denied.',
      'denied'
    );
  });

  it('detects permanently denied permission and reports setting recommendation', async () => {
    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });

    const onError = jest.fn();
    const started = await voiceService.startListening('en-IN', {
      onResult: jest.fn(),
      onError,
    });

    expect(started).toBe(false);
    expect(onError).toHaveBeenCalledWith(
      'Microphone permission is permanently denied. Please enable it in Settings.',
      'permanently_denied'
    );
  });

  it('starts listening and processes interim and final results', async () => {
    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });

    let resultHandler: ((event: any) => void) | null = null;
    (ExpoSpeechRecognitionModule.addListener as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'result') {
        resultHandler = handler;
      }
      return { remove: jest.fn() };
    });

    const onResult = jest.fn();
    const onError = jest.fn();

    const started = await voiceService.startListening('en-IN', {
      onResult,
      onError,
    });

    expect(started).toBe(true);
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'en-IN',
        interimResults: true,
      })
    );

    // Simulate interim result
    if (resultHandler) {
      (resultHandler as any)({
        isFinal: false,
        results: [{ transcript: 'Schedule a meeting', confidence: 0.85 }],
      });
    }

    expect(onResult).toHaveBeenCalledWith({
      transcript: 'Schedule a meeting',
      isFinal: false,
      confidence: 0.85,
    });

    // Simulate final result
    if (resultHandler) {
      (resultHandler as any)({
        isFinal: true,
        results: [{ transcript: 'Schedule a meeting tomorrow at 3 PM', confidence: 0.95 }],
      });
    }

    expect(onResult).toHaveBeenCalledWith({
      transcript: 'Schedule a meeting tomorrow at 3 PM',
      isFinal: true,
      confidence: 0.95,
    });
  });

  it('handles recognition errors without crashing', async () => {
    (ExpoSpeechRecognitionModule.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
      granted: true,
      canAskAgain: true,
    });

    let errorHandler: ((event: any) => void) | null = null;
    (ExpoSpeechRecognitionModule.addListener as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'error') {
        errorHandler = handler;
      }
      return { remove: jest.fn() };
    });

    const onError = jest.fn();

    await voiceService.startListening('en-IN', {
      onResult: jest.fn(),
      onError,
    });

    if (errorHandler) {
      (errorHandler as any)({
        error: 'no-speech',
        message: 'No speech recognized',
      });
    }

    expect(onError).toHaveBeenCalledWith(
      'No speech detected. Please speak clearly into the microphone.',
      'no-speech'
    );
  });
});
