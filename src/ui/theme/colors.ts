/**
 * LifeOS Design System - Color Palette
 * Direction: Calm, premium, minimal dark-mode-first.
 * Primary Accent: Vibrant Lime (#C6F432)
 * Agent Colors: Reminder (#FF9F43), Calendar (#5AA9FF), Task (#FF7A59), Inbox (#B79CFF)
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

  // Primary Accent (Vibrant Lime #C6F432)
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

  // Agent Specific Colors
  agentReminder: string;
  agentCalendar: string;
  agentTask: string;
  agentInbox: string;

  // Interactive
  touchFeedback: string;
  overlay: string;
  shadow: string;
}

export const darkColors: ThemeColors = {
  // Minimal obsidian & slate surfaces
  background: '#0B0F14',
  surface: '#141A22',
  surfaceSubtle: '#18202A',
  surfaceElevated: '#1E2633',
  card: '#141A22',
  cardElevated: '#18202A',
  cardHighlight: '#1E2734',

  // Crisp subtle borders
  border: '#232B36',
  borderSubtle: '#1B222B',
  borderFocus: '#C6F432',
  divider: '#1C232D',

  // Legible text hierarchy
  textPrimary: '#F2F4F7',
  textSecondary: '#8B95A5',
  textTertiary: '#8B95A5',
  textMuted: '#8B95A5',
  textInverse: '#0B0F14',

  // Accent: Lime (#C6F432) - reserved only for primary actions and active tab
  primary: '#C6F432',
  primaryLight: '#D6FA5A',
  primaryDark: '#A6D41A',
  primaryMuted: 'rgba(198, 244, 50, 0.15)',
  primaryForeground: '#0B0F14',

  accent: '#C6F432',
  accentForeground: '#0B0F14',

  // Semantic
  success: '#3DDC97',
  successSurface: 'rgba(61, 220, 151, 0.15)',
  successBorder: 'rgba(61, 220, 151, 0.35)',
  successForeground: '#3DDC97',

  warning: '#FFC53D',
  warningSurface: 'rgba(255, 197, 61, 0.15)',
  warningBorder: 'rgba(255, 197, 61, 0.35)',
  warningForeground: '#FFC53D',

  error: '#FF5C6C',
  errorSurface: 'rgba(255, 92, 108, 0.15)',
  errorBorder: 'rgba(255, 92, 108, 0.35)',
  errorForeground: '#FF5C6C',

  info: '#5AA9FF',
  infoSurface: 'rgba(90, 169, 255, 0.15)',
  infoBorder: 'rgba(90, 169, 255, 0.35)',
  infoForeground: '#5AA9FF',

  // Agent Colors (One colour per agent)
  agentReminder: '#FF9F43', // Orange
  agentCalendar: '#5AA9FF', // Blue
  agentTask: '#FF7A59',     // Coral
  agentInbox: '#B79CFF',    // Violet

  touchFeedback: 'rgba(255, 255, 255, 0.05)',
  overlay: 'rgba(11, 15, 20, 0.85)',
  shadow: '#000000',
};

export const lightColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  cardHighlight: '#F8FAFC',

  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  borderFocus: '#7BA400',
  divider: '#E2E8F0',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  primary: '#85B300',
  primaryLight: '#9EC718',
  primaryDark: '#5E7F00',
  primaryMuted: 'rgba(133, 179, 0, 0.15)',
  primaryForeground: '#0B0F14',

  accent: '#85B300',
  accentForeground: '#0B0F14',

  success: '#10B981',
  successSurface: 'rgba(16, 185, 129, 0.12)',
  successBorder: 'rgba(16, 185, 129, 0.3)',
  successForeground: '#065F46',

  warning: '#F59E0B',
  warningSurface: 'rgba(245, 158, 11, 0.12)',
  warningBorder: 'rgba(245, 158, 11, 0.3)',
  warningForeground: '#92400E',

  error: '#EF4444',
  errorSurface: 'rgba(239, 68, 68, 0.12)',
  errorBorder: 'rgba(239, 68, 68, 0.3)',
  errorForeground: '#991B1B',

  info: '#3B82F6',
  infoSurface: 'rgba(59, 130, 246, 0.12)',
  infoBorder: 'rgba(59, 130, 246, 0.3)',
  infoForeground: '#1D4ED8',

  agentReminder: '#FF9F43',
  agentCalendar: '#5AA9FF',
  agentTask: '#FF7A59',
  agentInbox: '#B79CFF',

  touchFeedback: 'rgba(0, 0, 0, 0.04)',
  overlay: 'rgba(15, 23, 42, 0.6)',
  shadow: '#0F172A',
};
