import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { IconTile } from './IconTile';
import { IconName } from './Icon';
import { PrimaryButton } from './PrimaryButton';

interface EmptyStateProps {
  icon?: IconName | string | React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
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
        {typeof icon === 'string' ? (
          icon.length > 2 || icon.match(/^[a-z\-]+$/i) ? (
            <IconTile name={icon as IconName} color={icon === 'calendar' ? theme.colors.agentCalendar : icon === 'bell' ? theme.colors.agentReminder : theme.colors.agentInbox} />
          ) : (
            <Text style={styles.iconText}>{icon}</Text>
          )
        ) : (
          icon
        )}
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
            lineHeight: 22,
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
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  iconText: {
    fontSize: 24,
  },
});
