export const Linking = {
  openSettings: jest.fn().mockResolvedValue(true),
  openURL: jest.fn().mockResolvedValue(true),
  canOpenURL: jest.fn().mockResolvedValue(true),
};

export const Platform = {
  OS: 'android',
  select: (obj: any) => obj.android || obj.default,
};

export const AppRegistry = {
  registerHeadlessTask: jest.fn(),
  registerComponent: jest.fn(),
};

export const NativeModules: Record<string, any> = {
  LifeOSNotificationListener: {
    isPermissionGranted: jest.fn().mockResolvedValue(false),
    openNotificationSettings: jest.fn().mockResolvedValue(true),
    getListenerStatus: jest.fn().mockResolvedValue({
      isPermissionGranted: false,
      isConnected: false,
      captureEnabled: false,
      queueSize: 0,
    }),
    requestRebind: jest.fn().mockResolvedValue(true),
    updateSettings: jest.fn().mockResolvedValue(true),
    drainPendingNotifications: jest.fn().mockResolvedValue([]),
  },
};

export class NativeEventEmitter {
  addListener = jest.fn().mockReturnValue({ remove: jest.fn() });
  removeListeners = jest.fn();
}

export const AppState = {
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
};

export default {
  Linking,
  Platform,
  AppRegistry,
  NativeModules,
  NativeEventEmitter,
  AppState,
};

