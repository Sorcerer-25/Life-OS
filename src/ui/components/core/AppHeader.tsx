import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';


interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  greeting?: string;
  dateText?: string;
  showStatusIndicator?: boolean;
  statusLabel?: string;
  rightAction?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title = 'LifeOS',
  subtitle,
  greeting,
  dateText,
  showStatusIndicator = true,
  statusLabel = 'Offline',
  rightAction,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          marginBottom: theme.spacing.md,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.brandingCol}>
          {dateText ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 2 }]}>
              {dateText}
            </Text>
          ) : null}
          <View style={styles.titleRow}>
            <Text style={[theme.typography.titleLarge, { color: theme.colors.textPrimary }]}>
              {greeting || title}
            </Text>
            {showStatusIndicator && (
              <View
                style={[
                  styles.offlineChip,
                  {
                    backgroundColor: theme.colors.successSurface,
                    borderColor: theme.colors.successBorder,
                  },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: theme.colors.success }]} />
                <Text style={[styles.offlineText, { color: theme.colors.successForeground }]}>
                  {statusLabel}
                </Text>
              </View>
            )}
          </View>
        </View>

        {rightAction ? <View style={styles.rightActionWrapper}>{rightAction}</View> : null}
      </View>

      {subtitle ? (
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandingCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightActionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  offlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
