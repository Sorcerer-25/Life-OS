import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { CalendarMappingRecord } from '../../calendar/mappingRepository';
import { CalendarEventRecord } from '../../calendar/types';
import { IdentificationResult } from '../../intent/identifier';
import { ActionPlan } from '../../models/ActionPlan';
import { AgentResult } from '../../models/AgentResult';
import { NotificationInboxItem } from '../../models/NotificationEvent';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { useTheme } from '../theme';
import { ActivityCard } from '../components/cards/ActivityCard';
import { UnderstandingAndPlanView } from '../components/plan/UnderstandingAndPlanView';
import { NotificationCard } from '../components/cards/NotificationCard';
import { AppHeader } from '../components/core/AppHeader';
import { EmptyState } from '../components/core/EmptyState';
import { ErrorState } from '../components/core/ErrorState';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { SectionHeader } from '../components/core/SectionHeader';
import { StatusBadge } from '../components/core/StatusBadge';

interface HomeScreenProps {
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onOpenVoiceModal: () => void;
  onOpenInbox: () => void;
  onOpenSimulateNotification: () => void;
  onOpenNotificationSettings: () => void;
  onOpenCalendarSettings: () => void;
  onOpenCreatedEvents: () => void;
  onOpenReminders?: () => void;
  unreadNotificationCount: number;
  analysisResult: IdentificationResult | null;
  actionPlan: ActionPlan | null;
  calendarAgent: CalendarAgent;
  notificationProcessor: NotificationProcessor;
  refreshNotificationCount: () => void;
}

export const QUICK_SHORTCUTS = [
  {
    icon: '🗓️',
    label: 'Schedule team sync',
    prompt: 'Schedule team sync tomorrow at 3 PM',
  },
  {
    icon: '🔔',
    label: 'Remind assignment due',
    prompt: 'Remind me to submit my assignment on Friday at 5 PM',
  },
  {
    icon: '⚡',
    label: 'Electricity bill payment',
    prompt: 'I need to pay my electricity bill of ₹1200 tomorrow',
  },
  {
    icon: '🍛',
    label: 'Log lunch expense',
    prompt: 'I paid ₹250 for lunch with colleagues',
  },
  {
    icon: '🎙️',
    label: 'Voice Request',
    prompt: '__VOICE__',
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  inputText,
  setInputText,
  isLoading,
  errorMessage,
  setErrorMessage,
  onAnalyze,
  onClear,
  onOpenVoiceModal,
  onOpenInbox,
  onOpenSimulateNotification,
  onOpenNotificationSettings,
  onOpenCalendarSettings,
  onOpenCreatedEvents,
  onOpenReminders,
  unreadNotificationCount,
  analysisResult,
  actionPlan,
  calendarAgent,
  notificationProcessor,
  refreshNotificationCount,
}) => {
  const { theme, toggleTheme } = useTheme();

  // Real upcoming events from Calendar SQLite mapping + provider
  const [upcomingEvents, setUpcomingEvents] = useState<
    Array<{ mapping: CalendarMappingRecord; event: CalendarEventRecord | null }>
  >([]);
  // Real pending notifications from SQLite inbox
  const [pendingNotifications, setPendingNotifications] = useState<NotificationInboxItem[]>([]);
  // Recent activity items from SQLite inbox
  const [recentActivities, setRecentActivities] = useState<NotificationInboxItem[]>([]);

  // Dynamic greeting based on current hour
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

  const loadRealDashboardData = async () => {
    try {
      // 1. Fetch real created calendar events
      const events = await calendarAgent.listCreatedEvents();
      // Keep events that are valid or created
      const active = events.filter((e) => e.mapping.status === 'created');
      setUpcomingEvents(active.slice(0, 3));

      // 2. Fetch pending notifications (new & analysed)
      const repo = notificationProcessor.getRepository();
      const allNew = await repo.listAll('new');
      const allAnalysed = await repo.listAll('analysed');
      setPendingNotifications([...allNew, ...allAnalysed].slice(0, 3));

      // 3. Fetch recent activity (all statuses)
      const allItems = await repo.listAll();
      setRecentActivities(allItems.slice(0, 3));
    } catch (err) {
      console.warn('[HomeScreen] Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadRealDashboardData();
  }, [unreadNotificationCount, analysisResult]);

  const handleSelectShortcut = (shortcut: (typeof QUICK_SHORTCUTS)[0]) => {
    if (shortcut.prompt === '__VOICE__') {
      onOpenVoiceModal();
      return;
    }
    setInputText(shortcut.prompt);
    setErrorMessage(null);
  };

  return (
    <ScreenContainer testID="home-screen">
      {/* 1. Executive App Header */}
      <AppHeader
        greeting={getGreeting()}
        dateText={formattedDate}
        subtitle="Event-driven personal orchestration engine"
        unreadCount={unreadNotificationCount}
        onOpenInbox={onOpenInbox}
        onToggleTheme={toggleTheme}
        onOpenSettings={onOpenNotificationSettings}
      />

      {/* Quick Navigation Pills for Existing Settings & Simulator */}
      <View style={styles.quickNavRow}>
        <TouchableOpacity
          style={[
            styles.quickNavPill,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={onOpenSimulateNotification}
          activeOpacity={0.7}
        >
          <Text style={[styles.quickNavText, { color: theme.colors.textPrimary }]}>
            🔔 Simulate Alert
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickNavPill,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={onOpenCreatedEvents}
          activeOpacity={0.7}
        >
          <Text style={[styles.quickNavText, { color: theme.colors.textPrimary }]}>
            🗓️ Calendar ({upcomingEvents.length})
          </Text>
        </TouchableOpacity>

        {onOpenReminders && (
          <TouchableOpacity
            style={[
              styles.quickNavPill,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={onOpenReminders}
            activeOpacity={0.7}
          >
            <Text style={[styles.quickNavText, { color: theme.colors.textPrimary }]}>
              ⏰ Reminders
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.quickNavPill,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={onOpenCalendarSettings}
          activeOpacity={0.7}
        >
          <Text style={[styles.quickNavText, { color: theme.colors.textSecondary }]}>
            ⚙️ Calendar Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Prominent Hero Input Card: "What's on your mind?" */}
      <View
        style={[
          styles.heroInputCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
            padding: theme.spacing.lg,
          },
          theme.shadows.md,
        ]}
      >
        <View style={styles.heroHeaderRow}>
          <Text style={[theme.typography.titleMedium, { color: theme.colors.textPrimary }]}>
            What's on your mind?
          </Text>
          <View
            style={[
              styles.modePill,
              {
                backgroundColor: theme.colors.primaryMuted,
                borderColor: theme.colors.primaryDark,
              },
            ]}
          >
            <Text style={[styles.modePillText, { color: theme.colors.primaryLight }]}>
              Local Parser
            </Text>
          </View>
        </View>

        <TextInput
          style={[
            styles.heroTextInput,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
            },
            theme.typography.bodyLarge,
          ]}
          multiline
          numberOfLines={3}
          placeholder="Type or speak a request (e.g. 'Remind me to submit project Friday' or 'Paid ₹250 for lunch')..."
          placeholderTextColor={theme.colors.textMuted}
          value={inputText}
          onChangeText={(txt) => {
            setInputText(txt);
            if (errorMessage) setErrorMessage(null);
          }}
          editable={!isLoading}
          testID="home-input-field"
        />

        {errorMessage ? (
          <ErrorState message={errorMessage} onRetry={onAnalyze} />
        ) : null}

        {/* Input Card Action Bar */}
        <View style={[styles.inputActionsRow, { marginTop: theme.spacing.md }]}>
          {inputText.trim() ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={onClear}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textTertiary }]}>
                Clear
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          <View style={styles.rightActionButtons}>
            <TouchableOpacity
              style={[
                styles.voicePill,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
              onPress={onOpenVoiceModal}
              disabled={isLoading}
              activeOpacity={0.7}
              testID="home-voice-btn"
            >
              <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
                🎙️ Mic
              </Text>
            </TouchableOpacity>

            <PrimaryButton
              label="Analyze & Plan"
              icon="⚡"
              onPress={onAnalyze}
              isLoading={isLoading}
              disabled={!inputText.trim()}
              size="md"
              testID="home-analyze-btn"
            />
          </View>
        </View>
      </View>

      {/* 3. Helpful Quick Action Shortcuts */}
      <View style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: 8 }]}>
          Quick Suggestions (Tap to try)
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shortcutsScroll}
        >
          {QUICK_SHORTCUTS.map((shortcut, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.shortcutChip,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.pill,
                },
              ]}
              onPress={() => handleSelectShortcut(shortcut)}
              activeOpacity={0.7}
            >
              <Text style={styles.shortcutIcon}>{shortcut.icon}</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                {shortcut.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 4. Results Section (If an input has been analyzed) */}
      {analysisResult && (
        <UnderstandingAndPlanView
          analysisResult={analysisResult}
          actionPlan={actionPlan}
          calendarAgent={calendarAgent}
        />
      )}

      {/* 5. Pending Notification Approvals Section */}
      <View style={{ marginTop: theme.spacing.lg }}>
        <SectionHeader
          title="Pending Approvals"
          badge={pendingNotifications.length > 0 ? pendingNotifications.length : undefined}
          actionLabel={pendingNotifications.length > 0 ? 'Review All →' : undefined}
          onAction={onOpenInbox}
        />

        {pendingNotifications.length === 0 ? (
          <View
            style={[
              styles.caughtUpCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderSubtle,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
              },
            ]}
          >
            <View style={styles.caughtUpRow}>
              <Text style={styles.caughtUpIcon}>✓</Text>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                  All Caught Up
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  No notifications are pending review. Actions never execute without your approval.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          pendingNotifications.map((notif) => (
            <NotificationCard
              key={notif.id}
              item={notif}
              compact
              onAnalyse={async (id) => {
                await notificationProcessor.analyzeInboxItem(id);
                loadRealDashboardData();
                refreshNotificationCount();
              }}
              onApprove={async (id) => {
                await notificationProcessor.approveActionPlan(id);
                loadRealDashboardData();
                refreshNotificationCount();
              }}
              onDismiss={async (id) => {
                await notificationProcessor.dismissNotification(id);
                loadRealDashboardData();
                refreshNotificationCount();
              }}
            />
          ))
        )}
      </View>

      {/* 6. Real Upcoming Reminders & Events Section */}
      <View style={{ marginTop: theme.spacing.lg }}>
        <SectionHeader
          title="Upcoming Calendar Events"
          actionLabel={upcomingEvents.length > 0 ? 'Manage Events →' : undefined}
          onAction={onOpenCreatedEvents}
        />

        {upcomingEvents.length === 0 ? (
          <EmptyState
            icon="🗓️"
            title="No Events Scheduled"
            description="Events created through LifeOS will be scheduled into your Android Calendar and listed here."
            actionLabel="Schedule 'Team Sync' Example"
            onAction={() => {
              setInputText('Schedule team sync tomorrow at 3 PM');
              setErrorMessage(null);
            }}
          />
        ) : (
          upcomingEvents.map(({ mapping, event }) => (
            <View
              key={mapping.action_id}
              style={[
                styles.eventPreviewCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.sm,
                },
                theme.shadows.sm,
              ]}
            >
              <View style={styles.eventPreviewHeader}>
                <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary, flex: 1 }]}>
                  {event?.title || mapping.action_id}
                </Text>
                <StatusBadge status="in_provider" size="sm" />
              </View>

              {event && (
                <View style={{ marginTop: 4 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.primaryLight }]}>
                    ⏰ {new Date(event.startDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </Text>
                  {event.location ? (
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                      📍 {event.location}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* 7. Recent Activity Preview */}
      {recentActivities.length > 0 && (
        <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.xl }}>
          <SectionHeader title="Recent Activity" />
          {recentActivities.map((act) => (
            <ActivityCard
              key={act.id}
              item={{
                id: act.id,
                sourceType: 'notification',
                sourceApp: act.app_label || act.source_app,
                title: act.title,
                description: act.text,
                intents: act.analysis?.intents.map((i) => i.intent),
                agents: act.action_plan?.actions.map((a) => a.agent),
                status: act.status,
                timestamp: act.posted_at,
              }}
              onPress={onOpenInbox}
            />
          ))}
        </View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  quickNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quickNavPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickNavText: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroInputCard: {
    borderWidth: 1,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  modePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  heroTextInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  inputActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rightActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voicePill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutsScroll: {
    gap: 8,
    paddingRight: 10,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    gap: 6,
  },
  shortcutIcon: {
    fontSize: 13,
  },
  workflowCard: {
    borderWidth: 1,
  },
  workflowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clarifyBanner: {
    padding: 8,
    borderWidth: 1,
  },
  techBox: {
    borderWidth: 1,
  },
  caughtUpCard: {
    borderWidth: 1,
    marginVertical: 4,
  },
  caughtUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  caughtUpIcon: {
    color: '#10b981',
    fontSize: 22,
    fontWeight: '800',
  },
  eventPreviewCard: {
    borderWidth: 1,
  },
  eventPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

