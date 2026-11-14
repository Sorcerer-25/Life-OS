import { useReducedMotion } from './Motion';
import React, { useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { Icon, IconName } from './Icon';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName | string | React.ReactNode;
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
  const reducedMotion = useReducedMotion();
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (reducedMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 24,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

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
        return theme.colors.primary; // Lime accent
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
        return theme.colors.textPrimary;
      case 'teal':
      default:
        return theme.colors.primaryForeground; // #0B0F14 on Lime
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
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
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
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        activeOpacity={0.88}
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
              <View style={{ marginRight: theme.spacing.xs + 2 }}>
                <Icon name={icon} size={18} color={getTextColor()} />
              </View>
            ) : icon ? (
              <View style={{ marginRight: theme.spacing.xs + 2 }}>{icon}</View>
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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
