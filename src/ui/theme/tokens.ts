import { ViewStyle } from 'react-native';

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
  round: 9999,
} as const;

export interface Shadows {
  none: ViewStyle;
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
}

export const shadows: Shadows = { none: {}, sm: {}, md: {}, lg: {} };
