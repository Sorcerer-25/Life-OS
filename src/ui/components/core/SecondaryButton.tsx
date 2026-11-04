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

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: string | React.ReactNode;
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
        style,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      testID={testID}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
    >
      {isLoading ? (
        <ActivityIndicator color={theme.colors.textSecondary} size="small" />
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
              { color: theme.colors.textPrimary, fontWeight: '600' },
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
    borderWidth: 1,
    minHeight: 44, // Accessible touch target
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 15,
  },
});

