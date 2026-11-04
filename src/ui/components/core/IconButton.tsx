import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';

interface IconButtonProps {
  icon: string | React.ReactNode;
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

  const getDimension = () => {
    switch (size) {
      case 'sm':
        return 38;
      case 'lg':
        return 52;
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

  const dim = getDimension();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'ghost' ? 0 : 1,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      testID={testID}
    >
      {typeof icon === 'string' ? (
        <Text style={[styles.iconText, { fontSize: size === 'lg' ? 22 : size === 'sm' ? 16 : 18 }]}>
          {icon}
        </Text>
      ) : (
        icon
      )}

      {badgeCount !== undefined && badgeCount > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.badgeText}>
            {badgeCount > 99 ? '99+' : badgeCount}
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
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});

