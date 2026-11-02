export const ExpoSpeechRecognitionModule = {
  requestPermissionsAsync: jest.fn().mockResolvedValue({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  }),
  getPermissionsAsync: jest.fn().mockResolvedValue({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  }),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  getStateAsync: jest.fn().mockResolvedValue({
    isRecognizing: false,
  }),
  getSpeechRecognitionServices: jest.fn().mockReturnValue(['com.google.android.as']),
  addListener: jest.fn().mockReturnValue({
    remove: jest.fn(),
  }),
  removeListeners: jest.fn(),
};

export const useSpeechRecognitionEvent = jest.fn();

