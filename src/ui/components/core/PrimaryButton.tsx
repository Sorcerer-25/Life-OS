import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: string | React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: 'teal' | 'navy' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  testID?: string;
  accessibilityLabel?: string;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  icon,
  isLoading = false,
  disabled = false,
  style,
  variant = 'teal',
  size = 'md',
  testID,
  accessibilityLabel,
}) => {
  const { theme } = useTheme();

  const getBackgroundColor = () => {
    if (disabled && !isLoading) {
      return theme.colors.surfaceSubtle;
    }
    switch (variant) {
      case 'danger':
        return theme.colors.error;
      case 'navy':
        return theme.colors.surfaceElevated;
      case 'teal':
      default:
        return theme.colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled && !isLoading) {
      return theme.colors.textMuted;
    }
    switch (variant) {
      case 'danger':
        return '#ffffff';
      case 'navy':
        return theme.colors.primaryLight;
      case 'teal':
      default:
        return theme.colors.primaryForeground;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: theme.spacing.xs + 2, paddingHorizontal: theme.spacing.md };
      case 'lg':
        return { paddingVertical: theme.spacing.md + 2, paddingHorizontal: theme.spacing.xl };
      case 'md':
      default:
        return { paddingVertical: theme.spacing.sm + 3, paddingHorizontal: theme.spacing.lg };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getPadding(),
        {
          backgroundColor: getBackgroundColor(),
          borderRadius: theme.radii.md,
          borderColor: variant === 'navy' ? theme.colors.border : 'transparent',
          borderWidth: variant === 'navy' ? 1 : 0,
        },
        theme.shadows.sm,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      testID={testID}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
    >
      {isLoading ? (
        <View style={styles.contentRow}>
          <ActivityIndicator color={getTextColor()} size="small" />
          <Text
            style={[
              theme.typography.titleSmall,
              { color: getTextColor(), marginLeft: theme.spacing.sm },
            ]}
          >
            Processing...
          </Text>
        </View>
      ) : (
        <View style={styles.contentRow}>
          {typeof icon === 'string' ? (
            <Text style={[styles.iconText, { marginRight: theme.spacing.xs }]}>{icon}</Text>
          ) : icon ? (
            <View style={{ marginRight: theme.spacing.xs }}>{icon}</View>
          ) : null}
          <Text
            style={[
              size === 'sm' ? theme.typography.bodyMedium : theme.typography.titleSmall,
              { color: getTextColor(), fontWeight: '700' },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Ensures accessible touch target
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
  },
});

