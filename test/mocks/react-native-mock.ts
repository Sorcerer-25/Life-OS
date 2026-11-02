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

export default {
  Linking,
  Platform,
  AppRegistry,
};

