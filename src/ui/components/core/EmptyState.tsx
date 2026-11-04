import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { PrimaryButton } from './PrimaryButton';

interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '✨',
  title,
  description,
  actionLabel,
  onAction,
  style,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderSubtle,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.xl,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: theme.colors.surfaceSubtle,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {typeof icon === 'string' ? <Text style={styles.iconText}>{icon}</Text> : icon}
      </View>

      <Text
        style={[
          theme.typography.titleMedium,
          { color: theme.colors.textPrimary, marginTop: theme.spacing.md, textAlign: 'center' },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          theme.typography.bodyMedium,
          {
            color: theme.colors.textSecondary,
            marginTop: theme.spacing.xs,
            textAlign: 'center',
            lineHeight: 20,
          },
        ]}
      >
        {description}
      </Text>

      {actionLabel && onAction && (
        <View style={{ marginTop: theme.spacing.lg }}>
          <PrimaryButton label={actionLabel} onPress={onAction} size="sm" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginVertical: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconText: {
    fontSize: 28,
  },
});
