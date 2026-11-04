import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';

export type TabKey = 'home' | 'input' | 'inbox' | 'activity' | 'settings';

interface BottomNavBarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  unreadInboxCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  unreadInboxCount = 0,
}) => {
  const { theme } = useTheme();

  const tabs: Array<{ key: TabKey; label: string; icon: string; isProminent?: boolean }> = [
    { key: 'home', label: 'Home', icon: '🏠' },
    { key: 'inbox', label: 'Inbox', icon: '📥' },
    { key: 'input', label: 'Input', icon: '⚡', isProminent: true },
    { key: 'activity', label: 'Activity', icon: '⏱️' },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <View
      style={[
        styles.barContainer,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        theme.shadows.lg,
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;

        if (tab.isProminent) {
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.prominentTabContainer}
              onPress={() => onSelectTab(tab.key)}
              activeOpacity={0.8}
              accessibilityLabel={`${tab.label} Tab`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <View
                style={[
                  styles.prominentCircle,
                  {
                    backgroundColor: isActive ? theme.colors.primaryLight : theme.colors.primary,
                    borderColor: theme.colors.surface,
                  },
                  theme.shadows.md,
                ]}
              >
                <Text style={styles.prominentIcon}>{tab.icon}</Text>
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? theme.colors.primaryLight : theme.colors.textSecondary,
                    fontWeight: '700',
                    marginTop: 2,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onSelectTab(tab.key)}
            activeOpacity={0.7}
            accessibilityLabel={`${tab.label} Tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.iconWrapper}>
              <Text style={[styles.tabIcon, { opacity: isActive ? 1 : 0.65 }]}>{tab.icon}</Text>
              {tab.key === 'inbox' && unreadInboxCount > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.colors.info }]}>
                  <Text style={styles.badgeText}>
                    {unreadInboxCount > 99 ? '99+' : unreadInboxCount}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isActive ? theme.colors.primaryLight : theme.colors.textTertiary,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
            {isActive && (
              <View
                style={[
                  styles.activeIndicator,
                  { backgroundColor: theme.colors.primaryLight },
                ]}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 64,
    borderTopWidth: 1,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
    minHeight: 48, // Accessible touch target
  },
  iconWrapper: {
    position: 'relative',
  },
  tabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
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
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 14,
    height: 2.5,
    borderRadius: 1.5,
  },
  prominentTabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -10,
    width: 68,
  },
  prominentCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  prominentIcon: {
    fontSize: 22,
    color: '#ffffff',
  },
});
