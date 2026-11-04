import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export type StatusVariant =
  | 'ready'
  | 'partial'
  | 'needs_clarification'
  | 'unsupported'
  | 'rejected'
  | 'blocked'
  | 'new'
  | 'analysed'
  | 'actioned'
  | 'dismissed'
  | 'failed'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'confirmation_required'
  | 'in_provider'
  | 'deleted';

interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  style,
}) => {
  const { theme } = useTheme();

  const getBadgeConfig = () => {
    const s = status.toLowerCase();
    switch (s) {
      case 'ready':
      case 'actioned':
      case 'success':
      case 'in_provider':
      case 'created':
        return {
          bg: theme.colors.successSurface,
          border: theme.colors.successBorder,
          text: theme.colors.successForeground,
          defaultLabel: s === 'in_provider' ? '✓ IN PROVIDER' : s.toUpperCase(),
        };

      case 'partial':
      case 'warning':
      case 'analysed':
        return {
          bg: theme.colors.warningSurface,
          border: theme.colors.warningBorder,
          text: theme.colors.warningForeground,
          defaultLabel: s.toUpperCase(),
        };

      case 'needs_clarification':
      case 'clarify':
        return {
          bg: theme.colors.warningSurface,
          border: theme.colors.warningBorder,
          text: theme.colors.warningForeground,
          defaultLabel: '❓ CLARIFICATION NEEDED',
        };

      case 'new':
      case 'info':
        return {
          bg: theme.colors.infoSurface,
          border: theme.colors.infoBorder,
          text: theme.colors.infoForeground,
          defaultLabel: s.toUpperCase(),
        };

      case 'confirmation_required':
      case 'confirmation req':
      case 'confirmation_req':
        return {
          bg: 'rgba(234, 88, 12, 0.12)',
          border: 'rgba(234, 88, 12, 0.35)',
          text: '#FB923C',
          defaultLabel: '⚠️ CONFIRMATION REQ',
        };

      case 'blocked':
      case 'unsupported':
      case 'rejected':
      case 'failed':
      case 'error':
      case 'deleted':
        return {
          bg: theme.colors.errorSurface,
          border: theme.colors.errorBorder,
          text: theme.colors.errorForeground,
          defaultLabel: s.toUpperCase(),
        };

      case 'dismissed':
      default:
        return {
          bg: theme.colors.surfaceSubtle,
          border: theme.colors.border,
          text: theme.colors.textSecondary,
          defaultLabel: s.toUpperCase(),
        };
    }
  };

  const config = getBadgeConfig();
  const textLabel = label || config.defaultLabel;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: size === 'sm' ? 2 : 4,
          paddingHorizontal: size === 'sm' ? 6 : 8,
          borderRadius: theme.radii.xs,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.text,
            fontSize: size === 'sm' ? 10 : 11,
          },
        ]}
      >
        {textLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
