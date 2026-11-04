import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  greeting?: string;
  dateText?: string;
  showStatusIndicator?: boolean;
  statusLabel?: string;
  unreadCount?: number;
  onOpenInbox?: () => void;
  onToggleTheme?: () => void;
  onOpenSettings?: () => void;
  rightAction?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title = 'LifeOS',
  subtitle,
  greeting,
  dateText,
  showStatusIndicator = true,
  statusLabel = 'Local Deterministic',
  unreadCount = 0,
  onOpenInbox,
  onToggleTheme,
  onOpenSettings,
  rightAction,
}) => {
  const { theme, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.lg,
          marginBottom: theme.spacing.md,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.brandingCol}>
          {dateText && (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginBottom: 2 }]}>
              {dateText}
            </Text>
          )}
          <View style={styles.titleRow}>
            <Text style={[theme.typography.titleLarge, { color: theme.colors.primaryLight }]}>
              {greeting || title}
            </Text>
            {greeting && (
              <View
                style={[
                  styles.badgeTag,
                  {
                    backgroundColor: theme.colors.primaryMuted,
                    borderColor: theme.colors.primaryDark,
                  },
                ]}
              >
                <Text style={[styles.badgeTagText, { color: theme.colors.primaryLight }]}>LifeOS</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionsRow}>
          {onToggleTheme && (
            <TouchableOpacity
              style={[
                styles.iconBtn,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={onToggleTheme}
              accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              activeOpacity={0.7}
            >
              <Text style={styles.iconBtnText}>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>
          )}

          {onOpenInbox && (
            <TouchableOpacity
              style={[
                styles.iconBtn,
                {
                  backgroundColor: unreadCount > 0 ? theme.colors.infoSurface : theme.colors.surfaceSubtle,
                  borderColor: unreadCount > 0 ? theme.colors.infoBorder : theme.colors.border,
                },
              ]}
              onPress={onOpenInbox}
              accessibilityLabel="Notification Inbox"
              activeOpacity={0.7}
            >
              <Text style={styles.iconBtnText}>📥</Text>
              {unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: theme.colors.info }]}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {onOpenSettings && (
            <TouchableOpacity
              style={[
                styles.iconBtn,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={onOpenSettings}
              accessibilityLabel="Settings"
              activeOpacity={0.7}
            >
              <Text style={styles.iconBtnText}>⚙️</Text>
            </TouchableOpacity>
          )}

          {rightAction}
        </View>
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

      {showStatusIndicator && (
        <View style={[styles.statusRow, { marginTop: theme.spacing.sm }]}>
          <View style={[styles.statusDot, { backgroundColor: theme.colors.success }]} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Engine: <Text style={{ color: theme.colors.successForeground, fontWeight: '700' }}>{statusLabel}</Text>
          </Text>
        </View>
      )}
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
  badgeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  iconBtnText: {
    fontSize: 16,
  },
  unreadBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});

