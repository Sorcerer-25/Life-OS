import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  actionLabel?: string;
  onAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  badge,
  actionLabel,
  onAction,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { marginBottom: theme.spacing.sm, marginTop: theme.spacing.md }]}>
      <View style={styles.leftCol}>
        <View style={styles.titleRow}>
          <Text style={[theme.typography.titleMedium, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
          {badge !== undefined && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.primaryMuted,
                  borderColor: theme.colors.primaryDark,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: theme.colors.primaryLight }]}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle ? (
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7} style={styles.actionBtn}>
          <Text style={[theme.typography.label, { color: theme.colors.primaryLight }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
});
