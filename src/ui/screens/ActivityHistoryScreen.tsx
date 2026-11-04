import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { CalendarMappingRecord } from '../../calendar/mappingRepository';
import { CalendarEventRecord } from '../../calendar/types';
import { NotificationInboxItem } from '../../models/NotificationEvent';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { useTheme } from '../theme';
import { BottomSheet } from '../components/core/BottomSheet';
import { EmptyState } from '../components/core/EmptyState';
import { LoadingState } from '../components/core/LoadingState';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { SecondaryButton } from '../components/core/SecondaryButton';
import { SectionHeader } from '../components/core/SectionHeader';
import { StatusBadge } from '../components/core/StatusBadge';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type ActivityFilter = 'all' | 'completed' | 'pending' | 'failed';

export interface UnifiedActivityItem {
  id: string;
  sourceType: 'text' | 'voice' | 'notification' | 'calendar';
  sourceApp?: string;
  title: string;
  description?: string;
  timestamp: string;
  status: string;
  intents?: string[];
  agents?: string[];
  rawAnalysis?: any;
  rawPlan?: any;
  rawError?: string | null;
  executionResult?: any;
}

interface ActivityHistoryScreenProps {
  processor: NotificationProcessor;
  calendarAgent: CalendarAgent;
  onNavigateToInput?: (suggestion?: string) => void;
  onOpenInbox?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const ActivityHistoryScreen: React.FC<ActivityHistoryScreenProps> = ({
  processor,
  calendarAgent,
  onNavigateToInput,
  onOpenInbox,
  onClose,
  isModal = false,
}) => {
  const { theme, toggleTheme } = useTheme();

  const [activities, setActivities] = useState<UnifiedActivityItem[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Expanded technical error IDs
  const [expandedErrorIds, setExpandedErrorIds] = useState<Record<string, boolean>>({});

  // Selected item for deep detail BottomSheet
  const [selectedItem, setSelectedItem] = useState<UnifiedActivityItem | null>(null);
  const [showJsonInspector, setShowJsonInspector] = useState<boolean>(false);

  const loadActivities = async () => {
    try {
      // 1. Fetch notification inbox history
      const notifRepo = processor.getRepository();
      const notifs: NotificationInboxItem[] = await notifRepo.listAll();

      // 2. Fetch calendar mapping history
      const calEvents = await calendarAgent.listCreatedEvents();

      const unified: UnifiedActivityItem[] = [];

      // Map notifications
      for (const n of notifs) {
        unified.push({
          id: `notif_${n.id}`,
          sourceType: 'notification',
          sourceApp: n.app_label || n.source_app,
          title: n.title,
          description: n.text,
          timestamp: n.posted_at || n.created_at,
          status: n.status,
          intents: n.analysis?.intents.map((i) => i.intent),
          agents: n.action_plan?.actions.map((a) => a.agent),
          rawAnalysis: n.analysis,
          rawPlan: n.action_plan,
          rawError: n.last_error || (n.status === 'failed' ? 'Execution rejected or failed' : null),
          executionResult: n.execution_result,
        });
      }

      // Map calendar created actions
      for (const item of calEvents) {
        const m = item.mapping;
        const ev = item.event;
        const isFailure = m.status === 'failed' || (!ev && m.status !== 'deleted');
        unified.push({
          id: `cal_${m.action_id}`,
          sourceType: 'calendar',
          sourceApp: 'Android CalendarProvider',
          title: ev?.title || `Calendar Action: ${m.action_id}`,
          description: ev
            ? `Scheduled for ${new Date(ev.startDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}${ev.location ? ` at ${ev.location}` : ''}`
            : `Event ID: ${m.android_event_id || 'none'}`,
          timestamp: m.created_at,
          status: m.status === 'created' ? 'actioned' : m.status,
          intents: ['calendar_event'],
          agents: ['calendar_agent'],
          rawPlan: { action_id: m.action_id, request_id: m.request_id, calendar_id: m.calendar_id },
          rawError: isFailure ? 'Event not found in native Android provider (possibly deleted outside LifeOS)' : null,
          executionResult: { android_event_id: m.android_event_id, status: m.status },
        });
      }

      // Sort descending by timestamp
      unified.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime() || 0;
        const timeB = new Date(b.timestamp).getTime() || 0;
        return timeB - timeA;
      });

      setActivities(unified);
    } catch (err) {
      console.warn('[ActivityHistoryScreen] Failed to load activity items:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadActivities();
  };

  const toggleErrorExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedErrorIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Plain-language failure explanation helper
  const getFailureExplanation = (item: UnifiedActivityItem) => {
    const errorStr = (item.rawError || '').toLowerCase();
    if (errorStr.includes('permission') || errorStr.includes('denied')) {
      return {
        title: 'Android Permission Denied',
        plainText:
          'LifeOS lacked the required Android system permission (Calendar, Notification Access, or Microphone) to complete this action.',
        recoveryTip: 'Open LifeOS Settings to grant system permissions.',
      };
    }
    if (errorStr.includes('no_writable') || errorStr.includes('calendar')) {
      return {
        title: 'No Writable Calendar Account',
        plainText:
          'Could not find a writable local or cloud-synced calendar on this device to schedule the event.',
        recoveryTip: 'Ensure a Google or device calendar is enabled in system settings.',
      };
    }
    if (errorStr.includes('duplicate')) {
      return {
        title: 'Duplicate Event Prevented',
        plainText:
          'This action was already successfully executed. LifeOS idempotency safeguards prevented creating a duplicate.',
        recoveryTip: null,
      };
    }
    if (errorStr.includes('not found') || errorStr.includes('event_not_found')) {
      return {
        title: 'Event Not Found in System Provider',
        plainText:
          'The event record was deleted or modified outside LifeOS directly in the native calendar app.',
        recoveryTip: 'Re-create the event if needed.',
      };
    }
    return {
      title: 'Action Execution Interrupted',
      plainText:
        item.rawError || 'An unexpected condition prevented this action from finalizing.',
      recoveryTip: 'Tap below to inspect diagnostic logs.',
    };
  };

  // Filter and search
  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      // 1. Status filter
      if (filter === 'completed') {
        const isDone = item.status === 'actioned' || item.status === 'created';
        if (!isDone) return false;
      } else if (filter === 'pending') {
        const isPend = item.status === 'new' || item.status === 'analysed' || item.status === 'pending';
        if (!isPend) return false;
      } else if (filter === 'failed') {
        const isFail = item.status === 'failed' || Boolean(item.rawError);
        if (!isFail) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q) || false;
        const matchSource = item.sourceApp?.toLowerCase().includes(q) || false;
        const matchIntents = item.intents?.some((i) => i.toLowerCase().includes(q)) || false;
        const matchAgents = item.agents?.some((a) => a.toLowerCase().includes(q)) || false;
        if (!matchTitle && !matchDesc && !matchSource && !matchIntents && !matchAgents) {
          return false;
        }
      }

      return true;
    });
  }, [activities, filter, searchQuery]);

  const counts = useMemo(() => {
    const c = { all: activities.length, completed: 0, pending: 0, failed: 0 };
    for (const a of activities) {
      if (a.status === 'actioned' || a.status === 'created') {
        c.completed++;
      } else if (a.status === 'new' || a.status === 'analysed' || a.status === 'pending') {
        c.pending++;
      } else if (a.status === 'failed' || Boolean(a.rawError)) {
        c.failed++;
      }
    }
    return c;
  }, [activities]);

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'voice':
        return '🎤';
      case 'calendar':
        return '🗓️';
      case 'notification':
        return '🔔';
      case 'text':
      default:
        return '⌨️';
    }
  };

  const getSourceLabel = (item: UnifiedActivityItem) => {
    if (item.sourceApp) return item.sourceApp;
    switch (item.sourceType) {
      case 'voice':
        return 'Voice Command';
      case 'calendar':
        return 'Android Calendar';
      case 'notification':
        return 'Incoming Alert';
      default:
        return 'Direct Text Input';
    }
  };

  return (
    <ScreenContainer testID="activity-history-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[theme.typography.titleLarge, { color: theme.colors.textPrimary }]}>
            Activity History
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            Complete deterministic audit timeline of inputs, plans & agent actions
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityLabel="Toggle Theme"
          >
            <Text style={styles.headerActionIcon}>{theme.isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          {isModal && onClose && (
            <TouchableOpacity
              style={[styles.headerActionBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <Text style={styles.headerActionIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterScroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
          {(
            [
              { key: 'all', label: 'All History', count: counts.all },
              { key: 'completed', label: 'Completed', count: counts.completed },
              { key: 'pending', label: 'Pending / Review', count: counts.pending },
              { key: 'failed', label: 'Failures & Errors', count: counts.failed },
            ] as const
          ).map((tab) => {
            const isActive = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterTab,
                  {
                    backgroundColor: isActive ? theme.colors.primaryLight : theme.colors.surface,
                    borderColor: isActive ? theme.colors.primaryLight : theme.colors.border,
                  },
                ]}
                onPress={() => setFilter(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterTabLabel,
                    {
                      color: isActive ? theme.colors.primaryDark : theme.colors.textPrimary,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.filterBadge,
                    {
                      backgroundColor: isActive ? theme.colors.primaryDark : theme.colors.surfaceSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBadgeText,
                      { color: isActive ? theme.colors.primaryLight : theme.colors.textSecondary },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search Input Bar */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.colors.textPrimary }]}
          placeholder="Filter by title, intent, agent or app..."
          placeholderTextColor={theme.colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.clearSearchIcon, { color: theme.colors.textTertiary }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content Timeline */}
      {isLoading ? (
        <LoadingState message="Loading activity history..." style={{ marginTop: 40 }} />
      ) : filteredActivities.length === 0 ? (
        <EmptyState
          icon={filter === 'failed' ? '🛡️' : '⏱️'}
          title={
            searchQuery.trim()
              ? 'No Matching Activities'
              : filter === 'failed'
              ? 'No Recorded Failures'
              : filter === 'pending'
              ? 'No Pending Actions'
              : 'Activity Timeline Is Clean'
          }
          description={
            searchQuery.trim()
              ? `No activities match "${searchQuery}". Try clearing your search term.`
              : filter === 'failed'
              ? 'All processed inputs and agent dispatches executed cleanly without system errors.'
              : filter === 'pending'
              ? 'All captured inputs have been resolved or actioned.'
              : 'LifeOS logs all text, voice, and notification actions here in an audit timeline.'
          }
          actionLabel={onNavigateToInput ? 'Create New Action' : undefined}
          onAction={
            onNavigateToInput
              ? () => onNavigateToInput('Schedule project retrospective Friday at 4 PM')
              : undefined
          }
          style={{ marginTop: 30 }}
        />
      ) : (
        <ScrollView
          style={styles.timelineScroll}
          contentContainerStyle={styles.timelineContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primaryLight]}
              tintColor={theme.colors.primaryLight}
            />
          }
        >
          {filteredActivities.map((act, index) => {
            const isFailure = act.status === 'failed' || act.status === 'event_not_found' || Boolean(act.rawError);
            const failureInfo = isFailure ? getFailureExplanation(act) : null;
            const isErrorExpanded = Boolean(expandedErrorIds[act.id]);

            const formattedTime = (() => {
              try {
                const d = new Date(act.timestamp);
                return d.toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              } catch {
                return act.timestamp;
              }
            })();

            return (
              <View key={act.id} style={styles.timelineRow}>
                {/* Timeline vertical connector */}
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      styles.timelineNode,
                      {
                        backgroundColor: isFailure
                          ? theme.colors.error
                          : act.status === 'actioned' || act.status === 'created'
                          ? theme.colors.success
                          : theme.colors.primaryLight,
                      },
                    ]}
                  >
                    <Text style={styles.timelineNodeIcon}>{getSourceIcon(act.sourceType)}</Text>
                  </View>
                  {index < filteredActivities.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: theme.colors.borderSubtle }]} />
                  )}
                </View>

                {/* Timeline card body */}
                <TouchableOpacity
                  style={[
                    styles.activityCard,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: isFailure ? theme.colors.error : theme.colors.border,
                      borderRadius: theme.radii.md,
                      padding: theme.spacing.md,
                    },
                    theme.shadows.sm,
                  ]}
                  onPress={() => setSelectedItem(act)}
                  activeOpacity={0.7}
                >
                  {/* Top Bar: Source + Time + Status */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.sourceTag}>
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '700' }]}>
                        {getSourceLabel(act)}
                      </Text>
                    </View>
                    <View style={styles.cardTopRight}>
                      <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                        {formattedTime}
                      </Text>
                      <StatusBadge status={act.status} size="sm" />
                    </View>
                  </View>

                  {/* Title & Description */}
                  <Text
                    style={[theme.typography.titleSmall, { color: theme.colors.textPrimary, marginTop: theme.spacing.xs }]}
                    numberOfLines={2}
                  >
                    {act.title}
                  </Text>

                  {act.description ? (
                    <Text
                      style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 4 }]}
                      numberOfLines={3}
                    >
                      {act.description}
                    </Text>
                  ) : null}

                  {/* Intent & Agent chips */}
                  {(act.intents?.length || act.agents?.length) ? (
                    <View style={styles.badgesRow}>
                      {act.intents?.map((intent, idx) => (
                        <View
                          key={`int_${idx}`}
                          style={[
                            styles.chip,
                            { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: theme.colors.primaryLight }]}>
                            🎯 {intent}
                          </Text>
                        </View>
                      ))}
                      {act.agents?.map((agent, idx) => (
                        <View
                          key={`ag_${idx}`}
                          style={[
                            styles.chip,
                            { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: theme.colors.accent }]}>
                            🤖 {agent}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Failure section with plain-language explanation & expandable error details */}
                  {isFailure && failureInfo && (
                    <View
                      style={[
                        styles.failureBox,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.error,
                          borderRadius: theme.radii.sm,
                        },
                      ]}
                    >
                      <View style={styles.failureHeader}>
                        <Text style={styles.failureIcon}>⚠️</Text>
                        <Text style={[theme.typography.titleSmall, { color: theme.colors.error, flex: 1 }]}>
                          {failureInfo.title}
                        </Text>
                      </View>

                      <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, marginTop: 4 }]}>
                        {failureInfo.plainText}
                      </Text>

                      {failureInfo.recoveryTip ? (
                        <Text
                          style={[
                            theme.typography.caption,
                            { color: theme.colors.warning, marginTop: 4, fontWeight: '600' },
                          ]}
                        >
                          💡 Tip: {failureInfo.recoveryTip}
                        </Text>
                      ) : null}

                      {/* Expand raw technical error toggle */}
                      {act.rawError && (
                        <TouchableOpacity
                          style={styles.expandToggle}
                          onPress={() => toggleErrorExpand(act.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.expandToggleText, { color: theme.colors.textTertiary }]}>
                            {isErrorExpanded ? 'Hide Raw Technical Error ▲' : 'Show Raw Technical Error ▼'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Monospace raw error view */}
                      {isErrorExpanded && act.rawError && (
                        <View
                          style={[
                            styles.rawErrorContainer,
                            {
                              backgroundColor: theme.colors.surfaceSubtle,
                              borderColor: theme.colors.border,
                            },
                          ]}
                        >
                          <Text style={[styles.rawErrorText, { color: theme.colors.textSecondary }]}>
                            {act.rawError}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Footer prompt */}
                  <View style={styles.cardFooter}>
                    <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                      Tap for pipeline audit details →
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Deep Detail BottomSheet on Item Selection */}
      <BottomSheet
        visible={selectedItem !== null}
        onClose={() => {
          setSelectedItem(null);
          setShowJsonInspector(false);
        }}
        title="Activity Audit Details"
        subtitle={selectedItem ? getSourceLabel(selectedItem) : undefined}
      >
        {selectedItem && (
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Step 1: Input Summary */}
            <View
              style={[
                styles.modalCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md },
              ]}
            >
              <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
                1. Original Input & Origin
              </Text>
              <Text style={[theme.typography.titleMedium, { color: theme.colors.textPrimary, marginTop: 4 }]}>
                {selectedItem.title}
              </Text>
              {selectedItem.description ? (
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 4 }]}>
                  {selectedItem.description}
                </Text>
              ) : null}
              <View style={{ marginTop: 8, flexDirection: 'row', gap: 12 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                  Source: {selectedItem.sourceType.toUpperCase()}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                  Status: {selectedItem.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Step 2: Intent & Entities */}
            {selectedItem.intents && selectedItem.intents.length > 0 && (
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md, marginTop: 10 },
                ]}
              >
                <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
                  2. Identified Intents
                </Text>
                <View style={[styles.badgesRow, { marginTop: 6 }]}>
                  {selectedItem.intents.map((i, idx) => (
                    <View
                      key={idx}
                      style={[styles.chip, { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border }]}
                    >
                      <Text style={[styles.chipText, { color: theme.colors.primaryLight }]}>🎯 {i}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Step 3: Agents & Execution Plan */}
            {selectedItem.agents && selectedItem.agents.length > 0 && (
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md, marginTop: 10 },
                ]}
              >
                <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
                  3. Assigned Agents & Orchestration
                </Text>
                <View style={[styles.badgesRow, { marginTop: 6 }]}>
                  {selectedItem.agents.map((a, idx) => (
                    <View
                      key={idx}
                      style={[styles.chip, { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border }]}
                    >
                      <Text style={[styles.chipText, { color: theme.colors.accent }]}>🤖 {a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Step 4: Execution Outcome */}
            <View
              style={[
                styles.modalCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md, marginTop: 10 },
              ]}
            >
              <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
                4. Outcome & Native Verification
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <StatusBadge status={selectedItem.status} />
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary }]}>
                  {selectedItem.status === 'actioned' || selectedItem.status === 'created'
                    ? 'Verified in system provider'
                    : selectedItem.status === 'failed'
                    ? 'Execution failed'
                    : 'Pending user review'}
                </Text>
              </View>

              {selectedItem.rawError && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.error, fontWeight: '700' }]}>
                    Reported Error:
                  </Text>
                  <Text style={[styles.rawErrorText, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                    {selectedItem.rawError}
                  </Text>
                </View>
              )}
            </View>

            {/* Technical JSON Inspector Toggle */}
            <TouchableOpacity
              style={[
                styles.jsonToggleBtn,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  marginTop: 12,
                },
              ]}
              onPress={() => setShowJsonInspector((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={[theme.typography.bodySmall, { color: theme.colors.primaryLight, fontWeight: '600' }]}>
                {showJsonInspector ? 'Hide Technical Audit JSON ▲' : 'Inspect Raw Technical JSON ▼'}
              </Text>
            </TouchableOpacity>

            {showJsonInspector && (
              <View
                style={[
                  styles.jsonBox,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.sm,
                  },
                ]}
              >
                <Text style={[styles.jsonText, { color: theme.colors.textPrimary }]}>
                  {JSON.stringify(
                    {
                      id: selectedItem.id,
                      sourceType: selectedItem.sourceType,
                      sourceApp: selectedItem.sourceApp,
                      timestamp: selectedItem.timestamp,
                      status: selectedItem.status,
                      intents: selectedItem.intents,
                      agents: selectedItem.agents,
                      rawPlan: selectedItem.rawPlan,
                      rawAnalysis: selectedItem.rawAnalysis,
                      rawError: selectedItem.rawError,
                      executionResult: selectedItem.executionResult,
                    },
                    null,
                    2
                  )}
                </Text>
              </View>
            )}

            <View style={{ marginTop: 20, marginBottom: 30 }}>
              <SecondaryButton label="Close Details" onPress={() => setSelectedItem(null)} />
            </View>
          </ScrollView>
        )}
      </BottomSheet>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionIcon: {
    fontSize: 16,
  },
  filterScroll: {
    marginBottom: 10,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterTabLabel: {
    fontSize: 12,
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearSearchIcon: {
    fontSize: 14,
    fontWeight: '700',
    padding: 4,
  },
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    paddingBottom: 40,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineRail: {
    width: 32,
    alignItems: 'center',
  },
  timelineNode: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineNodeIcon: {
    fontSize: 12,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
  },
  activityCard: {
    flex: 1,
    marginLeft: 10,
    borderWidth: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  failureBox: {
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
  },
  failureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  failureIcon: {
    fontSize: 14,
  },
  expandToggle: {
    marginTop: 6,
    paddingVertical: 2,
  },
  expandToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rawErrorContainer: {
    marginTop: 6,
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  rawErrorText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },
  cardFooter: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  modalScroll: {
    maxHeight: 480,
  },
  modalCard: {
    borderWidth: 1,
    padding: 12,
  },
  jsonToggleBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  jsonBox: {
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
  },
  jsonText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
});
