import { ScalePressable } from './Motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from './Icon';

export type TabKey = 'home' | 'inbox' | 'activity' | 'settings';

interface BottomNavBarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onOpenQuickInput?: () => void;
  unreadInboxCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickInput,
  unreadInboxCount = 0,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.outerContainer, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View
        style={[
          styles.floatingBar,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
          theme.shadows.lg,
        ]}
      >
        {/* 1. Home Tab */}
        <ScalePressable style={styles.tabItem}
          onPress={() => onSelectTab('home')}
          activeOpacity={0.7}
          accessibilityLabel="Home Tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'home' }}
        >
          <Icon
            name="home" filled={activeTab === 'home'}
            size={22}
            color={activeTab === 'home' ? theme.colors.primary : theme.colors.textSecondary}
          />
          {activeTab === 'home' ? (
            <>
              <Text style={[styles.activeLabel, { color: theme.colors.primary }]}>Home</Text>
              <View style={[styles.limeDot, { backgroundColor: theme.colors.primary }]} />
            </>
          ) : null}
        </ScalePressable>

        {/* 2. Inbox Tab */}
        <ScalePressable style={styles.tabItem}
          onPress={() => onSelectTab('inbox')}
          activeOpacity={0.7}
          accessibilityLabel="Inbox Tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'inbox' }}
        >
          <View style={styles.iconBadgeWrapper}>
            <Icon
              name="inbox" filled={activeTab === 'inbox'}
              size={22}
              color={activeTab === 'inbox' ? theme.colors.primary : theme.colors.textSecondary}
            />
            {unreadInboxCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.colors.agentInbox }]}>
                <Text style={styles.badgeText}>
                  {unreadInboxCount > 99 ? '99+' : unreadInboxCount}
                </Text>
              </View>
            )}
          </View>
          {activeTab === 'inbox' ? (
            <>
              <Text style={[styles.activeLabel, { color: theme.colors.primary }]}>Inbox</Text>
              <View style={[styles.limeDot, { backgroundColor: theme.colors.primary }]} />
            </>
          ) : null}
        </ScalePressable>

        {/* 3. Center Raised Quick Input Action */}
        <ScalePressable style={styles.centerButtonContainer}
          onPress={onOpenQuickInput || (() => onSelectTab('home'))}
          activeOpacity={0.85}
          accessibilityLabel="Quick Capture Request"
          accessibilityRole="button"
        >
          <View
            style={[
              styles.centerCircle,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderColor: theme.colors.border,
              },
              theme.shadows.md,
            ]}
          >
            <Icon name="plus" size={22} color={theme.colors.textPrimary} />
          </View>
        </ScalePressable>

        {/* 4. Activity Tab */}
        <ScalePressable style={styles.tabItem}
          onPress={() => onSelectTab('activity')}
          activeOpacity={0.7}
          accessibilityLabel="Activity Tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'activity' }}
        >
          <Icon
            name="clock" filled={activeTab === 'activity'}
            size={22}
            color={activeTab === 'activity' ? theme.colors.primary : theme.colors.textSecondary}
          />
          {activeTab === 'activity' ? (
            <>
              <Text style={[styles.activeLabel, { color: theme.colors.primary }]}>Activity</Text>
              <View style={[styles.limeDot, { backgroundColor: theme.colors.primary }]} />
            </>
          ) : null}
        </ScalePressable>

        {/* 5. Settings Tab */}
        <ScalePressable style={styles.tabItem}
          onPress={() => onSelectTab('settings')}
          activeOpacity={0.7}
          accessibilityLabel="Settings Tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'settings' }}
        >
          <Icon
            name="settings" filled={activeTab === 'settings'}
            size={22}
            color={activeTab === 'settings' ? theme.colors.primary : theme.colors.textSecondary}
          />
          {activeTab === 'settings' ? (
            <>
              <Text style={[styles.activeLabel, { color: theme.colors.primary }]}>Settings</Text>
              <View style={[styles.limeDot, { backgroundColor: theme.colors.primary }]} />
            </>
          ) : null}
        </ScalePressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 0,
    zIndex: 100,
  },
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingVertical: 8,
  },
  activeLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  limeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  iconBadgeWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#0B0F14',
    fontSize: 13,
    fontWeight: '800',
  },
  centerButtonContainer: {
    top: -14,
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
  },
  centerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
