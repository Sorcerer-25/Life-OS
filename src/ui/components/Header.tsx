import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HeaderProps {
  onOpenCalendarSettings?: () => void;
  onOpenCreatedEvents?: () => void;
  onOpenNotificationInbox?: () => void;
  onOpenSimulateNotification?: () => void;
  onOpenNotificationSettings?: () => void;
  unreadNotificationCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenCalendarSettings,
  onOpenCreatedEvents,
  onOpenNotificationInbox,
  onOpenSimulateNotification,
  onOpenNotificationSettings,
  unreadNotificationCount = 0,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>LifeOS</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Voice & Notifications</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        Event-driven personal workflow orchestration. Deterministic local intent understanding, supervisor action planning, and native on-device capture.
      </Text>
      <View style={styles.statusRow}>
        <View style={styles.dot} />
        <Text style={styles.statusText}>
          Processing Mode: <Text style={styles.boldText}>LOCAL DETERMINISTIC</Text>
        </Text>
      </View>

      {/* Navigation Buttons for Notification & Calendar Features */}
      <View style={styles.navRow}>
        {onOpenNotificationInbox && (
          <TouchableOpacity style={[styles.navButton, styles.navButtonHighlight]} onPress={onOpenNotificationInbox}>
            <View style={styles.buttonBadgeContainer}>
              <Text style={styles.navButtonTextHighlight}>📥 Inbox</Text>
              {unreadNotificationCount > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{unreadNotificationCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        {onOpenSimulateNotification && (
          <TouchableOpacity style={styles.navButton} onPress={onOpenSimulateNotification}>
            <Text style={styles.navButtonText}>🔔 Simulate</Text>
          </TouchableOpacity>
        )}
        {onOpenNotificationSettings && (
          <TouchableOpacity style={styles.navButton} onPress={onOpenNotificationSettings}>
            <Text style={styles.navButtonText}>⚙️ Alerts</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.navRowSecondary}>
        {onOpenCalendarSettings && (
          <TouchableOpacity style={styles.navButtonSecondary} onPress={onOpenCalendarSettings}>
            <Text style={styles.navButtonSecondaryText}>⚙️ Calendar Settings</Text>
          </TouchableOpacity>
        )}
        {onOpenCreatedEvents && (
          <TouchableOpacity style={styles.navButtonSecondary} onPress={onOpenCreatedEvents}>
            <Text style={styles.navButtonSecondaryText}>🗓️ Created Events</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  boldText: {
    fontWeight: '700',
    color: '#34d399',
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  navRowSecondary: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  navButtonHighlight: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    borderColor: '#0284c7',
  },
  buttonBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navButtonTextHighlight: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  countBadgeText: {
    color: '#f8fafc',
    fontSize: 9,
    fontWeight: '800',
  },
  navButtonText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  navButtonSecondary: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  navButtonSecondaryText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
});
