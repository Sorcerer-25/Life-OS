import { useReducedMotion } from './Motion';
import React, { useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { Icon, IconName } from './Icon';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName | string | React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
  testID?: string;
  accessibilityLabel?: string;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  label,
  onPress,
  icon,
  isLoading = false,
  disabled = false,
  style,
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

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: theme.spacing.xs + 2, paddingHorizontal: theme.spacing.md };
      case 'lg':
        return { paddingVertical: theme.spacing.md + 2, paddingHorizontal: theme.spacing.xl };
      case 'md':
      default:
        return { paddingVertical: theme.spacing.sm + 2, paddingHorizontal: theme.spacing.lg };
    }
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          getPadding(),
          {
            backgroundColor: theme.colors.surfaceSubtle,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        activeOpacity={0.8}
        testID={testID}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color={theme.colors.textSecondary} size="small" />
        ) : (
          <View style={styles.contentRow}>
            {typeof icon === 'string' ? (
              <View style={{ marginRight: theme.spacing.xs + 2 }}>
                <Icon name={icon} size={18} color={theme.colors.textPrimary} />
              </View>
            ) : icon ? (
              <View style={{ marginRight: theme.spacing.xs + 2 }}>{icon}</View>
            ) : null}
            <Text
              style={[
                size === 'sm' ? theme.typography.bodyMedium : theme.typography.titleSmall,
                { color: theme.colors.textPrimary, fontWeight: '600' },
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
    borderWidth: 1,
    minHeight: 44,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
