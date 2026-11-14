import { useReducedMotion } from './Motion';
import React, { useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { Icon, IconName } from './Icon';

interface IconButtonProps {
  icon: IconName | string | React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  badgeCount?: number;
  variant?: 'subtle' | 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  badgeCount,
  variant = 'subtle',
  size = 'md',
  disabled = false,
  style,
  testID,
}) => {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    if (reducedMotion) return;
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 24 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  };

  const getDimension = () => {
    switch (size) {
      case 'sm':
        return 36;
      case 'lg':
        return 50;
      case 'md':
      default:
        return 44; // Ensures minimum accessible touch target
    }
  };

  const getBackgroundColor = () => {
    if (variant === 'ghost') return 'transparent';
    if (variant === 'primary') return theme.colors.primary;
    if (variant === 'danger') return theme.colors.errorSurface;
    return theme.colors.surfaceSubtle;
  };

  const getBorderColor = () => {
    if (variant === 'ghost') return 'transparent';
    if (variant === 'primary') return 'transparent';
    if (variant === 'danger') return theme.colors.errorBorder;
    return theme.colors.border;
  };

  const getIconColor = () => {
    if (variant === 'primary') return theme.colors.primaryForeground;
    if (variant === 'danger') return theme.colors.error;
    return theme.colors.textPrimary;
  };

  const dim = getDimension();
  const iconSize = 18;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            width: dim,
            height: dim,
            borderRadius: 10,
            backgroundColor: getBackgroundColor(),
            borderColor: getBorderColor(),
            borderWidth: variant === 'ghost' ? 0 : 1,
            opacity: disabled ? 0.4 : 1,
          },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        testID={testID}
      >
        {typeof icon === 'string' ? (
          icon.length > 2 || icon.match(/^[a-z\-]+$/i) ? (
            <Icon name={icon} size={iconSize} color={getIconColor()} />
          ) : (
            <Text style={[styles.iconText, { fontSize: iconSize, color: getIconColor() }]}>
              {icon}
            </Text>
          )
        ) : (
          icon
        )}

        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.colors.agentInbox }]}>
            <Text style={[styles.badgeText, { color: theme.colors.textInverse }]}>
              {badgeCount > 99 ? '99+' : badgeCount}
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
    position: 'relative',
  },
  iconText: {
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
