import { TextStyle } from 'react-native';

export interface TypographyScale {
  display: TextStyle;
  titleLarge: TextStyle;
  titleMedium: TextStyle;
  titleSmall: TextStyle;
  bodyLarge: TextStyle;
  bodyMedium: TextStyle;
  bodySmall: TextStyle;
  label: TextStyle;
  caption: TextStyle;
  code: TextStyle;
}

export const typography: TypographyScale = {
  display: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  titleLarge: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  titleMedium: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  titleSmall: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
};
