/**
 * LifeOS Design System - Color Palette
 * Direction: Calm, premium, minimal.
 * Accents: Deep Navy and Vibrant Teal/Cyan.
 * Neutral surfaces: High-contrast, clean elevation hierarchy.
 */

export interface ThemeColors {
  // Backgrounds & Surfaces
  background: string;
  surface: string;
  surfaceSubtle: string;
  surfaceElevated: string;
  card: string;
  cardElevated: string;
  cardHighlight: string;

  // Borders & Dividers
  border: string;
  borderSubtle: string;
  borderFocus: string;
  divider: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textInverse: string;

  // Primary & Accent (Teal / Cyan & Deep Navy)
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryMuted: string;
  primaryForeground: string;

  accent: string;
  accentForeground: string;

  // Semantic Status
  success: string;
  successSurface: string;
  successBorder: string;
  successForeground: string;

  warning: string;
  warningSurface: string;
  warningBorder: string;
  warningForeground: string;

  error: string;
  errorSurface: string;
  errorBorder: string;
  errorForeground: string;

  info: string;
  infoSurface: string;
  infoBorder: string;
  infoForeground: string;

  // Interactive
  touchFeedback: string;
  overlay: string;
  shadow: string;
}

export const darkColors: ThemeColors = {
  // Deep navy and obsidian surfaces
  background: '#070B14',
  surface: '#0E1626',
  surfaceSubtle: '#131D31',
  surfaceElevated: '#1A263D',
  card: '#0F1A2E',
  cardElevated: '#17233B',
  cardHighlight: '#1E2F4F',

  // Crisp subtle borders
  border: '#1E2C44',
  borderSubtle: '#141E30',
  borderFocus: '#14B8A6',
  divider: '#162236',

  // Clear legible text hierarchy
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textMuted: '#475569',
  textInverse: '#070B14',

  // Vibrant teal accent
  primary: '#14B8A6',
  primaryLight: '#2DD4BF',
  primaryDark: '#0D9488',
  primaryMuted: 'rgba(20, 184, 166, 0.14)',
  primaryForeground: '#042F2E',

  accent: '#38BDF8',
  accentForeground: '#082F49',

  // Semantic
  success: '#10B981',
  successSurface: 'rgba(16, 185, 129, 0.12)',
  successBorder: 'rgba(16, 185, 129, 0.3)',
  successForeground: '#34D399',

  warning: '#F59E0B',
  warningSurface: 'rgba(245, 158, 11, 0.12)',
  warningBorder: 'rgba(245, 158, 11, 0.3)',
  warningForeground: '#FBBF24',

  error: '#F43F5E',
  errorSurface: 'rgba(244, 63, 94, 0.12)',
  errorBorder: 'rgba(244, 63, 94, 0.3)',
  errorForeground: '#FDA4AF',

  info: '#0284C7',
  infoSurface: 'rgba(2, 132, 199, 0.12)',
  infoBorder: 'rgba(2, 132, 199, 0.3)',
  infoForeground: '#38BDF8',

  touchFeedback: 'rgba(255, 255, 255, 0.06)',
  overlay: 'rgba(2, 6, 14, 0.82)',
  shadow: '#000000',
};

export const lightColors: ThemeColors = {
  // Clean neutral surfaces with calm slate undertone
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  cardHighlight: '#F0FDFA',

  // Subtle clean dividers
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  borderFocus: '#0D9488',
  divider: '#E2E8F0',

  // High contrast text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Premium teal / deep cyan
  primary: '#0D9488',
  primaryLight: '#14B8A6',
  primaryDark: '#042F2E',
  primaryMuted: 'rgba(13, 148, 136, 0.10)',
  primaryForeground: '#FFFFFF',

  accent: '#0284C7',
  accentForeground: '#FFFFFF',

  // Semantic
  success: '#059669',
  successSurface: '#ECFDF5',
  successBorder: '#A7F3D0',
  successForeground: '#065F46',

  warning: '#D97706',
  warningSurface: '#FFFBEB',
  warningBorder: '#FDE68A',
  warningForeground: '#92400E',

  error: '#E11D48',
  errorSurface: '#FFF1F2',
  errorBorder: '#FECDD3',
  errorForeground: '#9F1239',

  info: '#0284C7',
  infoSurface: '#F0F9FF',
  infoBorder: '#BAE6FD',
  infoForeground: '#0369A1',

  touchFeedback: 'rgba(0, 0, 0, 0.04)',
  overlay: 'rgba(15, 23, 42, 0.55)',
  shadow: '#0F172A',
};

