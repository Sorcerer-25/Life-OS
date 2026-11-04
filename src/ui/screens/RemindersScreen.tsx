import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { CalendarMappingRecord } from '../../calendar/mappingRepository';
import { CalendarEventRecord } from '../../calendar/types';
import { NotificationInboxItem } from '../../models/NotificationEvent';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { useTheme } from '../theme';
import { AppHeader } from '../components/core/AppHeader';
import { ConfirmationDialog } from '../components/core/ConfirmationDialog';
import { EmptyState } from '../components/core/EmptyState';
import { LoadingState } from '../components/core/LoadingState';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { SectionHeader } from '../components/core/SectionHeader';
import { StatusBadge } from '../components/core/StatusBadge';

interface RemindersScreenProps {
  calendarAgent: CalendarAgent;
  processor: NotificationProcessor;
  onNavigateToInput?: () => void;
  onOpenInbox?: () => void;
}

export interface UnifiedReminderItem {
  id: string;
  type: 'calendar' | 'notification';
  actionId?: string;
  title: string;
  dueDate: string; // YYYY-MM-DD or formatted
  time?: string;
  source: string;
  status: string;
  isPast: boolean;
  rawEvent?: CalendarEventRecord | null;
  rawInboxItem?: NotificationInboxItem;
}

export const RemindersScreen: React.FC<RemindersScreenProps> = ({
  calendarAgent,
  processor,
  onNavigateToInput,
  onOpenInbox,
}) => {
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [reminders, setReminders] = useState<UnifiedReminderItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [itemToDelete, setItemToDelete] = useState<UnifiedReminderItem | null>(null);
  const [isCanceling, setIsCanceling] = useState<boolean>(false);

  const loadAllReminders = async () => {
    setIsLoading(true);
    try {
      const unified: UnifiedReminderItem[] = [];
      const now = new Date();

      // 1. Load reminders from SQLite calendar mappings
      const calList = await calendarAgent.listCreatedEvents();
      calList.forEach(({ mapping, event }) => {
        if (mapping.status === 'deleted') return;

        const eventDate = event ? new Date(event.startDate) : new Date(mapping.created_at);
        const isPast = eventDate.getTime() < now.getTime();

        unified.push({
          id: `cal_${mapping.action_id}`,
          type: 'calendar',
          actionId: mapping.action_id,
          title: event?.title || mapping.action_id,
          dueDate: eventDate.toISOString().split('T')[0],
          time: eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'Calendar Provider',
          status: event ? 'in_provider' : mapping.status,
          isPast,
          rawEvent: event,
        });
      });

      // 2. Load reminder-intent items from SQLite Notification Inbox
      const repo = processor.getRepository();
      const allNotifications = await repo.listAll();
      allNotifications.forEach((item) => {
        // Look for reminder intents
        const isReminderIntent =
          item.analysis?.intents.some(
            (i) => i.intent === 'set_reminder' || i.intent === 'bill_payment_reminder'
          ) ||
          item.action_plan?.actions.some((a) => a.agent === 'reminder_agent');

        if (isReminderIntent) {
          const itemDate = new Date(item.posted_at);
          const isPast =
            itemDate.getTime() < now.getTime() - 24 * 60 * 60 * 1000 &&
            (item.status === 'actioned' || item.status === 'dismissed');

          unified.push({
            id: `notif_${item.id}`,
            type: 'notification',
            title: item.title,
            dueDate: itemDate.toISOString().split('T')[0],
            time: itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            source: item.app_label || item.source_app,
            status: item.status,
            isPast,
            rawInboxItem: item,
          });
        }
      });

      // Sort by date ascending for upcoming, descending for past
      unified.sort((a, b) => {
        const timeA = new Date(a.dueDate).getTime();
        const timeB = new Date(b.dueDate).getTime();
        return timeA - timeB;
      });

      setReminders(unified);
    } catch (err) {
      console.warn('[RemindersScreen] Error loading reminders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllReminders();
  }, []);

  const handleCancelReminder = async () => {
    if (!itemToDelete) return;
    setIsCanceling(true);

    try {
      if (itemToDelete.type === 'calendar' && itemToDelete.actionId) {
        // Delete using existing calendarAgent logic
        const res = await calendarAgent.deleteEvent(itemToDelete.actionId);
        if (res.status === 'success') {
          Alert.alert('Reminder Canceled', 'The reminder event was removed from your device calendar.');
        } else {
          Alert.alert('Cancel Failed', res.message);
        }
      } else if (itemToDelete.type === 'notification' && itemToDelete.rawInboxItem) {
        // Dismiss using existing processor logic
        await processor.dismissNotification(itemToDelete.rawInboxItem.id);
        Alert.alert('Reminder Dismissed', 'The reminder notification has been marked as dismissed.');
      }
      setItemToDelete(null);
      await loadAllReminders();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not cancel reminder.');
    } finally {
      setIsCanceling(false);
    }
  };

  const filteredItems = reminders.filter((r) =>
    activeTab === 'upcoming' ? !r.isPast : r.isPast
  );

  // Group reminders by formatted Day (e.g. "Today", "Tomorrow", "Friday, Nov 6")
  const groupedReminders = filteredItems.reduce(
    (acc: Record<string, UnifiedReminderItem[]>, item) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      let dayLabel = item.dueDate;
      if (item.dueDate === todayStr) {
        dayLabel = 'Today';
      } else if (item.dueDate === tomorrowStr) {
        dayLabel = 'Tomorrow';
      } else {
        try {
          const d = new Date(item.dueDate);
          dayLabel = d.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          });
        } catch {
          dayLabel = item.dueDate;
        }
      }

      if (!acc[dayLabel]) {
        acc[dayLabel] = [];
      }
      acc[dayLabel].push(item);
      return acc;
    },
    {}
  );

  const groupKeys = Object.keys(groupedReminders);

  return (
    <ScreenContainer testID="reminders-screen">
      {/* Header */}
      <AppHeader
        title="Reminders"
        subtitle="Chronological reminders & tasks organized by day"
        showStatusIndicator
        statusLabel="Deterministic Engine"
        onToggleTheme={toggleTheme}
        onOpenInbox={onOpenInbox}
      />

      {/* Segmented Tab Controls: Upcoming vs. Past */}
      <View
        style={[
          styles.tabContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.pill,
            padding: 4,
            marginBottom: theme.spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeTab === 'upcoming' && {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radii.pill,
            },
          ]}
          onPress={() => setActiveTab('upcoming')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              theme.typography.titleSmall,
              {
                color: activeTab === 'upcoming'
                  ? theme.colors.primaryForeground
                  : theme.colors.textSecondary,
                fontWeight: '700',
              },
            ]}
          >
            Upcoming ({reminders.filter((r) => !r.isPast).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeTab === 'past' && {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radii.pill,
            },
          ]}
          onPress={() => setActiveTab('past')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              theme.typography.titleSmall,
              {
                color: activeTab === 'past'
                  ? theme.colors.primaryForeground
                  : theme.colors.textSecondary,
                fontWeight: '700',
              },
            ]}
          >
            Past / Completed ({reminders.filter((r) => r.isPast).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Refresh Button */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.refreshPill,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={loadAllReminders}
          activeOpacity={0.7}
        >
          <Text style={[styles.refreshText, { color: theme.colors.primaryLight }]}>
            🔄 Refresh
          </Text>
        </TouchableOpacity>

        {onNavigateToInput && (
          <TouchableOpacity
            style={[
              styles.refreshPill,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={onNavigateToInput}
            activeOpacity={0.7}
          >
            <Text style={[styles.refreshText, { color: theme.colors.accent }]}>
              + New Reminder
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Reminders List Grouped by Day */}
      {isLoading ? (
        <LoadingState message="Loading reminders from local database..." />
      ) : groupKeys.length === 0 ? (
        <EmptyState
          icon="🔔"
          title={activeTab === 'upcoming' ? 'No Upcoming Reminders' : 'No Past Reminders'}
          description={
            activeTab === 'upcoming'
              ? 'LifeOS captures reminders from your requests and notification alerts. Try typing "Remind me to submit assignment tomorrow".'
              : 'Past and completed reminders will be archived here.'
          }
          actionLabel={onNavigateToInput ? 'Create a Reminder' : undefined}
          onAction={onNavigateToInput}
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {groupKeys.map((dayLabel) => (
            <View key={dayLabel} style={styles.dayGroup}>
              {/* Day Header */}
              <View style={styles.dayHeaderRow}>
                <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
                  📅 {dayLabel}
                </Text>
                <View
                  style={[
                    styles.dayCountBadge,
                    {
                      backgroundColor: theme.colors.surfaceSubtle,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {groupedReminders[dayLabel].length} item{groupedReminders[dayLabel].length === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>

              {/* Items in this Day */}
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
                {groupedReminders[dayLabel].map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.reminderCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radii.md,
                        padding: theme.spacing.md,
                      },
                      theme.shadows.sm,
                    ]}
                  >
                    <View style={styles.reminderTop}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                          {item.title}
                        </Text>
                        <Text
                          style={[
                            theme.typography.caption,
                            { color: theme.colors.textSecondary, marginTop: 2 },
                          ]}
                        >
                          Source: {item.source} • {item.time ? `⏰ ${item.time}` : 'All Day'}
                        </Text>
                      </View>

                      <StatusBadge status={item.status} size="sm" />
                    </View>

                    {/* Actions: Cancel */}
                    {item.status !== 'dismissed' && item.status !== 'deleted' && (
                      <View style={[styles.reminderActionRow, { marginTop: theme.spacing.sm }]}>
                        <TouchableOpacity
                          style={[
                            styles.cancelBtn,
                            {
                              backgroundColor: theme.colors.errorSurface,
                              borderColor: theme.colors.errorBorder,
                            },
                          ]}
                          onPress={() => setItemToDelete(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.cancelBtnText, { color: theme.colors.errorForeground }]}>
                            ✕ Cancel
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Confirmation Dialog for Cancel */}
      {itemToDelete && (
        <ConfirmationDialog
          visible={true}
          title="Cancel Reminder"
          message={`Are you sure you want to cancel "${itemToDelete.title}"? This will remove the item using existing LifeOS cancellation rules.`}
          confirmLabel="Cancel Reminder"
          cancelLabel="Keep"
          isDestructive
          isLoading={isCanceling}
          onConfirm={handleCancelReminder}
          onCancel={() => setItemToDelete(null)}
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  refreshPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayGroup: {
    marginBottom: 6,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  dayCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  reminderCard: {
    borderWidth: 1,
  },
  reminderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reminderActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
