import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { CalendarAdapter } from '../../calendar/calendarAdapter';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { CalendarMappingRecord } from '../../calendar/mappingRepository';
import { CalendarEventRecord, CalendarPermissionResponse } from '../../calendar/types';
import { ExpoCalendarAdapter } from '../../calendar/expoCalendarAdapter';
import { IdentificationResult } from '../../intent/identifier';
import { ActionPlan } from '../../models/ActionPlan';
import { NotificationInboxItem } from '../../models/NotificationEvent';
import {
  getNativeListenerStatus,
  openNotificationListenerSettings,
} from '../../notifications/nativeNotificationListener';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { actionDate, agentType, humanLabel } from '../presentation';
import { useTheme } from '../theme';
import { AppHeader } from '../components/core/AppHeader';
import { BottomSheet } from '../components/core/BottomSheet';
import { Icon } from '../components/core/Icon';
import { IconTile } from '../components/core/IconTile';
import { ScalePressable, animateLayout } from '../components/core/Motion';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { SecondaryButton } from '../components/core/SecondaryButton';
import { SectionHeader } from '../components/core/SectionHeader';
import { StatusBadge } from '../components/core/StatusBadge';
import { SuccessFeedback } from '../components/core/SuccessFeedback';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const defaultAdapter = new ExpoCalendarAdapter();

export const QUICK_SHORTCUTS = [
  {
    agent: 'calendar' as const,
    label: 'Schedule team sync',
    prompt: 'Schedule team sync tomorrow at 3 PM',
  },
  {
    agent: 'reminder' as const,
    label: 'Remind assignment due',
    prompt: 'Remind me to submit my assignment on Friday at 5 PM',
  },
  {
    agent: 'task' as const,
    label: 'Electricity bill payment',
    prompt: 'I need to pay my electricity bill of ₹1200 tomorrow',
  },
  {
    agent: 'expense' as const,
    label: 'Log lunch expense',
    prompt: 'I paid ₹250 for lunch with colleagues',
  },
  {
    agent: 'system' as const,
    name: 'mic' as const,
    label: 'Voice Request',
    prompt: '__VOICE__',
  },
];

export interface UnifiedReminderDisplayItem {
  id: string;
  title: string;
  dueDate: string;
  time?: string;
  source: string;
  status: string;
  rawItem?: NotificationInboxItem;
}

interface HomeScreenProps {
  onOpenInbox: () => void;
  onOpenCreatedEvents: () => void;
  onOpenReminders?: () => void;
  unreadNotificationCount?: number;
  calendarAgent: CalendarAgent;
  notificationProcessor: NotificationProcessor;
  refreshNotificationCount?: () => void;
  adapter?: CalendarAdapter;
  // Legacy optional props kept for backwards compatibility
  recentRequests?: any[];
  onSelectRecent?: (request: any) => void;
  inputText?: string;
  setInputText?: (text: string) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  setErrorMessage?: (msg: string | null) => void;
  onAnalyze?: () => void;
  onClear?: () => void;
  onOpenVoiceModal?: () => void;
  onOpenSimulateNotification?: () => void;
  onOpenNotificationSettings?: () => void;
  onOpenCalendarSettings?: () => void;
  analysisResult?: IdentificationResult | null;
  actionPlan?: ActionPlan | null;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenInbox,
  onOpenCreatedEvents,
  onOpenReminders,
  unreadNotificationCount = 0,
  calendarAgent,
  notificationProcessor,
  refreshNotificationCount,
  adapter = defaultAdapter,
}) => {
  const { theme } = useTheme();

  // Tab for "Coming up" section: 'events' | 'reminders'
  const [comingUpTab, setComingUpTab] = useState<'events' | 'reminders'>('events');

  // Real data state
  const [approvalItems, setApprovalItems] = useState<NotificationInboxItem[]>([]);
  const [newNotificationsCount, setNewNotificationsCount] = useState<number>(0);
  const [upcomingEvents, setUpcomingEvents] = useState<
    { mapping: CalendarMappingRecord; event: CalendarEventRecord | null }[]
  >([]);
  const [upcomingReminders, setUpcomingReminders] = useState<UnifiedReminderDisplayItem[]>([]);

  // Permissions and loading state
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [calPermission, setCalPermission] = useState<CalendarPermissionResponse | null>(null);
  const [notifPermissionGranted, setNotifPermissionGranted] = useState<boolean>(true);

  // Review BottomSheet state
  const [reviewItem, setReviewItem] = useState<NotificationInboxItem | null>(null);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const loadRealDashboardData = useCallback(async () => {
    try {
      // 1. Check permissions
      try {
        const notifStatus = await getNativeListenerStatus();
        setNotifPermissionGranted(notifStatus.isPermissionGranted);
      } catch {
        setNotifPermissionGranted(true);
      }

      try {
        const perm = await adapter.getPermissionsAsync();
        setCalPermission(perm);
      } catch {
        // Mock / test environment
      }

      // 2. Fetch approvals & notification items from SQLite repo
      const repo = notificationProcessor.getRepository();
      const allItems = await repo.listAll();

      // Real approvals only: items whose plan has been analysed and is waiting for approval
      const analysed = allItems.filter((i) => i.status === 'analysed');
      setApprovalItems(analysed.slice(0, 3));

      // Count new unanalysed notifications
      const newItems = allItems.filter((i) => i.status === 'new');
      setNewNotificationsCount(newItems.length);

      // 3. Fetch real created calendar events
      const events = await calendarAgent.listCreatedEvents();
      const activeEvents = events.filter((e) => e.mapping.status !== 'deleted');
      activeEvents.sort((a, b) => {
        const timeA = a.event ? new Date(a.event.startDate).getTime() : new Date(a.mapping.created_at).getTime();
        const timeB = b.event ? new Date(b.event.startDate).getTime() : new Date(b.mapping.created_at).getTime();
        return timeA - timeB;
      });
      setUpcomingEvents(activeEvents.slice(0, 4));

      // 4. Fetch reminders from notification items and calendar mappings
      const unifiedReminders: UnifiedReminderDisplayItem[] = [];
      const now = new Date();

      // Reminders from SQLite inbox
      allItems.forEach((item) => {
        const isReminderIntent =
          item.analysis?.intents.some(
            (i) => i.intent === 'set_reminder' || i.intent === 'bill_payment_reminder'
          ) ||
          item.action_plan?.actions.some((a) => a.agent === 'reminder_agent');

        if (isReminderIntent && item.status !== 'dismissed') {
          const firstAction = item.action_plan?.actions.find((a) => a.agent === 'reminder_agent');
          const data = (firstAction?.data || {}) as Record<string, unknown>;
          const dateStr = String(data.due_date || data.date || item.posted_at);
          const timeStr = data.time ? String(data.time) : undefined;

          let formattedDateOnly = dateStr;
          try {
            const parsed = new Date(dateStr);
            if (!Number.isNaN(parsed.getTime())) {
              formattedDateOnly = parsed.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
            }
          } catch {
            // Keep raw string
          }

          unifiedReminders.push({
            id: `notif_rem_${item.id}`,
            title: String(data.title || data.description || item.title),
            dueDate: formattedDateOnly,
            time: timeStr,
            source: item.app_label || item.source_app || 'Reminder',
            status: item.status,
            rawItem: item,
          });
        }
      });

      setUpcomingReminders(unifiedReminders.slice(0, 4));
    } catch (err) {
      console.warn('[HomeScreen] Failed to load dashboard data:', err);
    } finally {
      setIsDataLoading(false);
    }
  }, [adapter, calendarAgent, notificationProcessor]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) return loadRealDashboardData();
    });
    return () => {
      cancelled = true;
    };
  }, [loadRealDashboardData, unreadNotificationCount]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRealDashboardData();
    refreshNotificationCount?.();
    setIsRefreshing(false);
  };

  const handleRequestCalPermission = async () => {
    try {
      const res = await adapter.requestPermissionsAsync();
      setCalPermission(res);
      if (res.granted) {
        await loadRealDashboardData();
      }
    } catch (err: any) {
      Alert.alert('Permission Error', err?.message || 'Failed to request calendar permission.');
    }
  };

  // Helper: Format one-line plain-language summary for approval
  const formatApprovalSummary = (item: NotificationInboxItem): string => {
    const action = item.action_plan?.actions?.[0];
    if (action) {
      const data = (action.data || {}) as Record<string, unknown>;
      const op = action.operation;
      let prefix = 'Action';
      if (op === 'create_event' || action.agent === 'calendar_agent') {
        prefix = 'Add to calendar';
      } else if (op === 'create_reminder' || op === 'set_reminder' || action.agent === 'reminder_agent') {
        prefix = 'Set reminder';
      } else if (op === 'create_task' || action.agent === 'task_agent') {
        prefix = 'Create task';
      } else if (action.agent === 'finance_agent') {
        prefix = 'Log expense';
      }

      const title = String(data.title || data.description || item.title || '').trim();
      const when = actionDate(data);
      const details = [title, when].filter(Boolean).join(', ');
      return details ? `${prefix}: ${details}` : `${prefix}: ${item.title}`;
    }
    return item.title || 'Review pending item';
  };

  const formatRelativeOrTime = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatEventDateTime = (event: CalendarEventRecord | null, mappingDate: string): string => {
    if (event?.startDate) {
      const start = new Date(event.startDate);
      const dateStr = start.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const timeStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `${dateStr} · ${timeStr}`;
    }
    try {
      const d = new Date(mappingDate);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return mappingDate;
    }
  };

  const handleApprovePlan = async () => {
    if (!reviewItem) return;
    setIsApproving(true);
    try {
      const res = await notificationProcessor.approveActionPlan(reviewItem.id);
      if (res.success) {
        setSuccessMessage('Approved and executed successfully.');
      } else {
        Alert.alert('Notice', 'Action was processed with warnings.');
      }
      setReviewItem(null);
      await loadRealDashboardData();
      refreshNotificationCount?.();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to approve item.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleDismissPlan = async () => {
    if (!reviewItem) return;
    try {
      await notificationProcessor.dismissNotification(reviewItem.id);
      setReviewItem(null);
      await loadRealDashboardData();
      refreshNotificationCount?.();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to dismiss item.');
    }
  };

  return (
    <ScreenContainer testID="home-screen">
      {successMessage && <SuccessFeedback label={successMessage} />}

      {/* 1. Header: Greeting, date, and the small Offline chip. Nothing else. */}
      <AppHeader
        greeting={getGreeting()}
        dateText={formattedDate}
        showStatusIndicator={true}
        statusLabel="Offline"
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
      >
        {/* ========================================================
            2. "Needs your approval"
        ======================================================== */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="Needs your approval"
            badge={approvalItems.length > 0 ? approvalItems.length : undefined}
            actionLabel="View all"
            onAction={onOpenInbox}
          />

          {isDataLoading ? (
            <View style={[styles.card, styles.centerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 8 }]}>
                Checking approvals...
              </Text>
            </View>
          ) : !notifPermissionGranted ? (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.permissionRow}>
                <Icon name="alert-triangle" size={16} color={theme.colors.warning} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                    Notification Access Paused
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                    Grant access in Android settings to capture alerts for review.
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <SecondaryButton
                  label="Open System Access"
                  icon="external-link"
                  size="sm"
                  onPress={openNotificationListenerSettings}
                />
              </View>
            </View>
          ) : approvalItems.length === 0 ? (
            <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.emptyRow}>
                <IconTile agent="system" name="check-circle" color={theme.colors.success} size={28} iconSize={15} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                    All caught up
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    No items waiting for your review.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              {approvalItems.map((item) => {
                const targetAgent = agentType(
                  item.action_plan?.actions?.[0]?.agent ||
                  item.analysis?.intents?.[0]?.intent ||
                  ''
                );

                return (
                  <ScalePressable
                    key={item.id}
                    style={[
                      styles.approvalRow,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radii.md,
                      },
                    ]}
                    onPress={() => setReviewItem(item)}
                    activeOpacity={0.7}
                  >
                    <IconTile agent={targetAgent} size={32} iconSize={16} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary, fontWeight: '600' }]}
                        numberOfLines={1}
                      >
                        {formatApprovalSummary(item)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                          {item.app_label || item.source_app}
                        </Text>
                        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>•</Text>
                        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                          {formatRelativeOrTime(item.posted_at)}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.reviewButton,
                        {
                          backgroundColor: theme.colors.surfaceSubtle,
                          borderColor: theme.colors.border,
                          borderRadius: theme.radii.sm,
                        },
                      ]}
                      onPress={() => setReviewItem(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.reviewButtonText, { color: theme.colors.accent }]}>
                        Review
                      </Text>
                    </TouchableOpacity>
                  </ScalePressable>
                );
              })}
            </View>
          )}

          {/* Quiet line: "N new notifications in Inbox" (hide if 0) */}
          {newNotificationsCount > 0 && (
            <TouchableOpacity
              style={[
                styles.quietInboxRow,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.sm,
                },
              ]}
              onPress={onOpenInbox}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="inbox" size={13} color={theme.colors.agentInbox} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {newNotificationsCount} new notification{newNotificationsCount === 1 ? '' : 's'} in Inbox
                </Text>
              </View>
              <Icon name="chevron-right" size={13} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ========================================================
            3. "Coming up": Events | Reminders Segmented Control
        ======================================================== */}
        <View style={[styles.sectionContainer, { marginTop: 14 }]}>
          <SectionHeader
            title="Coming up"
            actionLabel="Manage"
            onAction={comingUpTab === 'events' ? onOpenCreatedEvents : onOpenReminders}
          />

          {/* Segmented Control Pill Toggle */}
          <View
            style={[
              styles.segmentedContainer,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.pill,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                comingUpTab === 'events' && {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.pill,
                },
              ]}
              onPress={() => {
                animateLayout();
                setComingUpTab('events');
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon
                  name="calendar"
                  size={13}
                  color={comingUpTab === 'events' ? theme.colors.accent : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: comingUpTab === 'events' ? theme.colors.textPrimary : theme.colors.textSecondary,
                      fontWeight: comingUpTab === 'events' ? '700' : '500',
                    },
                  ]}
                >
                  Events ({upcomingEvents.length})
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                comingUpTab === 'reminders' && {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.pill,
                },
              ]}
              onPress={() => {
                animateLayout();
                setComingUpTab('reminders');
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon
                  name="bell"
                  size={13}
                  color={comingUpTab === 'reminders' ? theme.colors.accent : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: comingUpTab === 'reminders' ? theme.colors.textPrimary : theme.colors.textSecondary,
                      fontWeight: comingUpTab === 'reminders' ? '700' : '500',
                    },
                  ]}
                >
                  Reminders ({upcomingReminders.length})
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Segment Content */}
          {comingUpTab === 'events' ? (
            isDataLoading ? (
              <View style={[styles.card, styles.centerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 8 }]}>
                  Loading events...
                </Text>
              </View>
            ) : calPermission && !calPermission.granted ? (
              <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.permissionRow}>
                  <Icon name="calendar" size={16} color={theme.colors.warning} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                      Calendar Access Required
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                      Grant permission to view and schedule events on this device.
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 10 }}>
                  <SecondaryButton
                    label="Grant Permission"
                    icon="calendar"
                    size="sm"
                    onPress={handleRequestCalPermission}
                  />
                </View>
              </View>
            ) : upcomingEvents.length === 0 ? (
              <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.emptyRow}>
                  <IconTile agent="calendar" size={28} iconSize={15} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                      No upcoming events
                    </Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                      Scheduled events will appear here.
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ gap: 6, marginTop: 8 }}>
                {upcomingEvents.map(({ mapping, event }) => {
                  const isVerifiedInProvider = mapping.status === 'created' && event !== null;

                  return (
                    <ScalePressable
                      key={mapping.action_id}
                      style={[
                        styles.itemRow,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border,
                          borderRadius: theme.radii.md,
                        },
                      ]}
                      onPress={onOpenCreatedEvents}
                      activeOpacity={0.7}
                    >
                      <IconTile agent="calendar" size={32} iconSize={16} style={{ marginRight: 10 }} />
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text
                          style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary, fontWeight: '600' }]}
                          numberOfLines={1}
                        >
                          {event?.title || mapping.action_id}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Icon name="clock" size={11} color={theme.colors.agentCalendar} />
                          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                            {formatEventDateTime(event, mapping.created_at)}
                          </Text>
                        </View>
                      </View>

                      {/* Show 'In provider' status ONLY for events that were verified */}
                      {isVerifiedInProvider && <StatusBadge status="in_provider" size="sm" />}
                    </ScalePressable>
                  );
                })}
              </View>
            )
          ) : isDataLoading ? (
            <View style={[styles.card, styles.centerCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 8 }]}>
                Loading reminders...
              </Text>
            </View>
          ) : upcomingReminders.length === 0 ? (
            <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.emptyRow}>
                <IconTile agent="reminder" size={28} iconSize={15} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                    No upcoming reminders
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    Reminders from your alerts will appear here.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 6, marginTop: 8 }}>
              {upcomingReminders.map((rem) => (
                <ScalePressable
                  key={rem.id}
                  style={[
                    styles.itemRow,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radii.md,
                    },
                  ]}
                  onPress={onOpenReminders ? onOpenReminders : onOpenInbox}
                  activeOpacity={0.7}
                >
                  <IconTile agent="reminder" size={32} iconSize={16} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary, fontWeight: '600' }]}
                      numberOfLines={1}
                    >
                      {rem.title}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                        {rem.dueDate}
                        {rem.time ? ` · ${rem.time}` : ''}
                      </Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>•</Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                        {rem.source}
                      </Text>
                    </View>
                  </View>

                  <StatusBadge status="ready" label="Reminder" size="sm" />
                </ScalePressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Review & Approval Flow BottomSheet */}
      <BottomSheet
        visible={Boolean(reviewItem)}
        onClose={() => setReviewItem(null)}
        title="Review & Approve"
        subtitle={
          reviewItem
            ? `${reviewItem.app_label || reviewItem.source_app} · ${formatRelativeOrTime(reviewItem.posted_at)}`
            : undefined
        }
      >
        {reviewItem && (
          <View style={{ gap: 12 }}>
            <View
              style={[
                styles.reviewCard,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              <Text style={[theme.typography.label, { color: theme.colors.textTertiary }]}>
                PROPOSED ACTION
              </Text>
              <Text style={[theme.typography.titleMedium, { color: theme.colors.textPrimary, marginTop: 4 }]}>
                {formatApprovalSummary(reviewItem)}
              </Text>

              <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 10 }} />

              <Text style={[theme.typography.label, { color: theme.colors.textTertiary }]}>
                ORIGINAL NOTIFICATION
              </Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 4 }]}>
                &quot;{reviewItem.text}&quot;
              </Text>
            </View>

            <View style={{ gap: 8, marginTop: 4 }}>
              <PrimaryButton
                label="Approve Plan"
                icon="check"
                onPress={handleApprovePlan}
                isLoading={isApproving}
              />
              <SecondaryButton
                label="Dismiss Notification"
                icon="x"
                onPress={handleDismissPlan}
                disabled={isApproving}
              />
            </View>
          </View>
        )}
      </BottomSheet>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionContainer: {
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyCard: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
  },
  reviewButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  reviewButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  quietInboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  segmentedContainer: {
    flexDirection: 'row',
    padding: 3,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentText: {
    fontSize: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
  },
  reviewCard: {
    padding: 14,
    borderWidth: 1,
  },
});
