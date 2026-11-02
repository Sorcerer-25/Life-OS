import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ReminderRecord } from '../../database/reminderRepository';

interface ScheduledRemindersListProps {
  reminders: ReminderRecord[];
  onCancelReminder: (reminderId: string) => Promise<void>;
  isLoading?: boolean;
}

export const ScheduledRemindersList: React.FC<ScheduledRemindersListProps> = ({
  reminders,
  onCancelReminder,
  isLoading = false,
}) => {
  if (reminders.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔔 Active Scheduled Reminders</Text>
          <Text style={styles.countBadge}>0</Text>
        </View>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No upcoming scheduled reminders in database.</Text>
        </View>
      </View>
    );
  }

  const formatScheduledDate = (isoStr: string): string => {
    try {
      const d = new Date(isoStr);
      return isNaN(d.getTime()) ? isoStr : d.toLocaleString();
    } catch {
      return isoStr;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔔 Active Scheduled Reminders</Text>
        <Text style={styles.countBadge}>{reminders.length}</Text>
      </View>

      {reminders.map((item) => (
        <View key={item.id} style={styles.reminderCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.reminderTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View
              style={[
                styles.statusBadge,
                item.status === 'scheduled'
                  ? styles.statusScheduled
                  : item.status === 'cancelled'
                  ? styles.statusCancelled
                  : styles.statusOther,
              ]}
            >
              <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Scheduled for:</Text>
            <Text style={styles.detailValue}>{formatScheduledDate(item.scheduled_at)}</Text>
          </View>

          {item.notification_id && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Notification ID:</Text>
              <Text style={[styles.detailValue, styles.codeText]} numberOfLines={1}>
                {item.notification_id}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Action ID:</Text>
            <Text style={[styles.detailValue, styles.codeText]} numberOfLines={1}>
              {item.action_id}
            </Text>
          </View>

          {item.status === 'scheduled' && (
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.cancelButton, isLoading && styles.buttonDisabled]}
                onPress={() => onCancelReminder(item.id)}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel Notification</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#38bdf8',
  },
  countBadge: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emptyCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  reminderCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusScheduled: {
    backgroundColor: '#065f46',
  },
  statusCancelled: {
    backgroundColor: '#451a03',
  },
  statusOther: {
    backgroundColor: '#374151',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  detailLabel: {
    width: 110,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 12,
  },
  codeText: {
    fontFamily: 'monospace',
    color: '#93c5fd',
  },
  cardActions: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  cancelButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
  },
});

