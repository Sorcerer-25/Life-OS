import { ScalePressable, animateLayout, Entrance } from '../components/core/Motion';
import { SuccessFeedback } from '../components/core/SuccessFeedback';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { ActionPlan } from '../../models/ActionPlan';
import { NotificationInboxItem, NotificationInboxStatus } from '../../models/NotificationEvent';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import {
  classifyNotification,
  TriageCategory,
} from '../../notifications/triageClassifier';
import { actionDate, agentType, humanLabel, notificationResult } from '../presentation';
import { useTheme } from '../theme';
import { AppHeader } from '../components/core/AppHeader';
import { BottomSheet } from '../components/core/BottomSheet';
import { ConfirmationDialog } from '../components/core/ConfirmationDialog';
import { EmptyState } from '../components/core/EmptyState';
import { Icon } from '../components/core/Icon';
import { IconTile } from '../components/core/IconTile';
import { LoadingState } from '../components/core/LoadingState';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { SecondaryButton } from '../components/core/SecondaryButton';
import { StatusBadge } from '../components/core/StatusBadge';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface InboxScreenProps {
  processor: NotificationProcessor;
  onOpenSimulate?: () => void;
  onOpenSettings?: () => void;
  onClose?: () => void; // If rendered inside a modal
  isModal?: boolean;
}

export type FilterTab = 'all' | NotificationInboxStatus;

interface UndoState {
  visible: boolean;
  count: number;
  itemsToRestore: { id: string; prevStatus: NotificationInboxStatus }[];
}

export const InboxScreen: React.FC<InboxScreenProps> = ({
  processor,
  onOpenSimulate,
  onOpenSettings,
  onClose,
  isModal = false,
}) => {
  const { theme } = useTheme();

  // Primary data state
  const [allItems, setAllItems] = useState<NotificationInboxItem[]>([]);
  const [triageTab, setTriageTab] = useState<TriageCategory>('useful');
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Overflow menu state
  const [showOverflowMenu, setShowOverflowMenu] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Other section bulk & multi-select states
  const [showDismissAllConfirm, setShowDismissAllConfirm] = useState<boolean>(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [selectedOtherIds, setSelectedOtherIds] = useState<Record<string, boolean>>({});

  // Expand states for Useful cards
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [expandedTechIds, setExpandedTechIds] = useState<Record<string, boolean>>({});

  // Undo snackbar state for bulk dismiss (persists for 5 seconds)
  const [undoSnackbar, setUndoSnackbar] = useState<UndoState | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Action plan edit bottom sheet
  const [editingItem, setEditingItem] = useState<NotificationInboxItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');

  const toggleOverflowMenu = () => {
    animateLayout();
    setShowOverflowMenu(!showOverflowMenu);
  };

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const repo = processor.getRepository();
      const all = await repo.listAll();
      setAllItems(all);
    } catch (err) {
      console.warn('[InboxScreen] Error loading items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [processor]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) return loadItems();
    });
    return () => {
      cancelled = true;
    };
  }, [loadItems]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  // Compute triage classification for every item
  const classifiedItems = React.useMemo(() => {
    return allItems.map((item) => ({
      item,
      triage: classifyNotification(item),
    }));
  }, [allItems]);

  const usefulList = React.useMemo(
    () => classifiedItems.filter((entry) => entry.triage.category === 'useful'),
    [classifiedItems]
  );

  const otherList = React.useMemo(
    () => classifiedItems.filter((entry) => entry.triage.category === 'other'),
    [classifiedItems]
  );

  const usefulCount = usefulList.length;
  const otherCount = otherList.length;

  // Active segment list
  const activeSegmentList = triageTab === 'useful' ? usefulList : otherList;

  // Compute status counts for the active segment
  const statusCounts = React.useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: activeSegmentList.length,
      new: 0,
      analysed: 0,
      actioned: 0,
      dismissed: 0,
      failed: 0,
    };
    activeSegmentList.forEach(({ item }) => {
      if (counts[item.status] !== undefined) {
        counts[item.status]++;
      }
    });
    return counts;
  }, [activeSegmentList]);

  // Displayed items based on statusFilter
  const displayedEntries = React.useMemo(() => {
    if (statusFilter === 'all') return activeSegmentList;
    return activeSegmentList.filter(({ item }) => item.status === statusFilter);
  }, [activeSegmentList, statusFilter]);

  // Undismissed items in "Other" segment
  const undismissedOtherEntries = React.useMemo(
    () => otherList.filter(({ item }) => item.status !== 'dismissed'),
    [otherList]
  );
  const undismissedOtherCount = undismissedOtherEntries.length;

  const selectedCount = Object.keys(selectedOtherIds).filter(
    (id) => selectedOtherIds[id]
  ).length;

  // --- Handlers ---

  const handleAnalyse = async (itemId: string) => {
    setProcessingIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await processor.analyzeInboxItem(itemId);
      await loadItems();
    } catch (err: any) {
      Alert.alert('Analysis Failed', err?.message || 'Failed to analyze notification.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleApprove = async (itemId: string) => {
    setProcessingIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      const res = await processor.approveActionPlan(itemId);
      if (res.success) {
        setSuccessMessage('Your plan has been reviewed and approved.');
      } else {
        Alert.alert(
          'Execution Error',
          'One or more actions could not be completed. Open Technical details for more information.'
        );
      }
      await loadItems();
    } catch (err: any) {
      Alert.alert('Execution Error', err?.message || 'Failed to approve plan.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleDismiss = async (itemId: string) => {
    setProcessingIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await processor.dismissNotification(itemId);
      await loadItems();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to dismiss notification.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  // One-tap move between Useful and Other
  const handleToggleTriageCategory = async (
    item: NotificationInboxItem,
    currentCategory: TriageCategory
  ) => {
    const nextCategory: TriageCategory = currentCategory === 'useful' ? 'other' : 'useful';
    const updatedResult = {
      ...(item.execution_result || {}),
      triage_override: nextCategory,
    };
    const updatedItem: NotificationInboxItem = {
      ...item,
      execution_result: updatedResult,
    };

    setProcessingIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      await processor.getRepository().update(updatedItem);
      animateLayout();
      setSuccessMessage(
        nextCategory === 'useful'
          ? 'Moved to Useful notifications.'
          : 'Moved to Other notifications.'
      );
      await loadItems();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to move item.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // Bulk Dismiss all Other
  const handleDismissAllOtherConfirm = async () => {
    setShowDismissAllConfirm(false);
    const repo = processor.getRepository();
    const itemsToRestore = undismissedOtherEntries.map(({ item }) => ({
      id: item.id,
      prevStatus: item.status,
    }));

    if (itemsToRestore.length === 0) return;

    setIsLoading(true);
    try {
      for (const entry of itemsToRestore) {
        await repo.updateStatus(entry.id, 'dismissed');
      }
      animateLayout();
      await loadItems();

      // Show Undo Snackbar for 5 seconds
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoSnackbar({
        visible: true,
        count: itemsToRestore.length,
        itemsToRestore,
      });

      undoTimerRef.current = setTimeout(() => {
        animateLayout();
        setUndoSnackbar(null);
      }, 5000);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to dismiss notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  // Bulk Dismiss Selected
  const handleDismissSelectedOther = async () => {
    const selectedIds = Object.keys(selectedOtherIds).filter((id) => selectedOtherIds[id]);
    if (selectedIds.length === 0) return;

    const repo = processor.getRepository();
    const itemsToRestore: { id: string; prevStatus: NotificationInboxStatus }[] = [];

    setIsLoading(true);
    try {
      for (const id of selectedIds) {
        const entry = otherList.find((e) => e.item.id === id);
        if (entry && entry.item.status !== 'dismissed') {
          itemsToRestore.push({ id, prevStatus: entry.item.status });
          await repo.updateStatus(id, 'dismissed');
        }
      }

      setSelectedOtherIds({});
      setIsMultiSelectMode(false);
      animateLayout();
      await loadItems();

      if (itemsToRestore.length > 0) {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoSnackbar({
          visible: true,
          count: itemsToRestore.length,
          itemsToRestore,
        });

        undoTimerRef.current = setTimeout(() => {
          animateLayout();
          setUndoSnackbar(null);
        }, 5000);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to dismiss selected notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  // Undo bulk dismiss
  const handleUndoDismiss = async () => {
    if (!undoSnackbar) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const { itemsToRestore, count } = undoSnackbar;
    setUndoSnackbar(null);
    setIsLoading(true);

    try {
      const repo = processor.getRepository();
      for (const entry of itemsToRestore) {
        await repo.updateStatus(entry.id, entry.prevStatus);
      }
      animateLayout();
      await loadItems();
      setSuccessMessage(`Restored ${count} notification${count === 1 ? '' : 's'}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to restore notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  // Multi-select helpers
  const toggleSelectOtherItem = (id: string) => {
    animateLayout();
    setSelectedOtherIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleSelectAllOther = () => {
    animateLayout();
    if (selectedCount === undismissedOtherCount) {
      setSelectedOtherIds({});
    } else {
      const next: Record<string, boolean> = {};
      undismissedOtherEntries.forEach(({ item }) => {
        next[item.id] = true;
      });
      setSelectedOtherIds(next);
    }
  };

  // Clear all in DB confirm
  const handleClearAllConfirm = async () => {
    setShowClearConfirm(false);
    setIsLoading(true);
    try {
      await processor.getRepository().clearAll();
      await loadItems();
      setSuccessMessage('All notification records have been cleared.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to clear notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  // Plan Edit bottom sheet handlers
  const handleOpenEdit = (item: NotificationInboxItem) => {
    const plan = item.action_plan;
    if (!plan || plan.actions.length === 0) return;
    const firstAction = plan.actions[0];
    const data = firstAction.data as Record<string, any>;

    setEditingItem(item);
    setEditTitle(String(data.title || data.description || ''));
    setEditDate(String(data.date || data.due_date || ''));
    setEditTime(String(data.start_time || data.time || ''));
  };

  const handleSaveEdit = async () => {
    if (!editingItem || !editingItem.action_plan) return;

    const modifiedActions = editingItem.action_plan.actions.map((act) => ({
      ...act,
      data: {
        ...act.data,
        title: editTitle.trim(),
        description: editTitle.trim(),
        date: editDate.trim() || (act.data as any).date,
        due_date: editDate.trim() || (act.data as any).due_date,
        start_time: editTime.trim() || (act.data as any).start_time,
        time: editTime.trim() || (act.data as any).time,
      },
    }));

    const modifiedPlan: ActionPlan = {
      ...editingItem.action_plan,
      actions: modifiedActions,
    };

    const targetId = editingItem.id;
    setEditingItem(null);
    setProcessingIds((prev) => ({ ...prev, [targetId]: true }));

    try {
      const result = await processor.approveActionPlan(targetId, modifiedPlan);
      if (result.success) setSuccessMessage('Your edited plan has been approved.');
      else
        Alert.alert(
          'Action incomplete',
          'Some actions could not be completed. Review the result for details.'
        );
      await loadItems();
    } catch (err: any) {
      Alert.alert('Execution Error', err?.message || 'Failed to execute edited plan.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  const toggleExpandCard = (id: string) => {
    animateLayout();
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpandTech = (id: string) => {
    animateLayout();
    setExpandedTechIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'analysed', label: 'Analysed' },
    { key: 'actioned', label: 'Actioned' },
    { key: 'dismissed', label: 'Dismissed' },
  ];

  const formatItemTime = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const resolvePrimaryAgent = (item: NotificationInboxItem) => {
    const act = item.action_plan?.actions?.[0];
    if (act?.agent) {
      const a = act.agent.toLowerCase();
      if (a.includes('calendar')) return 'calendar' as const;
      if (a.includes('reminder')) return 'reminder' as const;
      if (a.includes('task')) return 'task' as const;
    }
    const intent = item.analysis?.intents?.[0]?.intent?.toLowerCase();
    if (intent?.includes('calendar') || intent?.includes('event') || intent?.includes('schedule'))
      return 'calendar' as const;
    if (intent?.includes('reminder')) return 'reminder' as const;
    if (intent?.includes('task')) return 'task' as const;
    return 'inbox' as const;
  };

  return (
    <ScreenContainer testID="inbox-screen">
      {successMessage && (
        <SuccessFeedback
          key={successMessage + allItems.map((item) => item.updated_at).join()}
          label={successMessage}
        />
      )}

      {/* Header with Title, small Offline chip, and 3-dot overflow menu */}
      <AppHeader
        title="Notification Inbox"
        subtitle="Review alerts and choose what happens next."
        showStatusIndicator={true}
        statusLabel="Offline"
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ScalePressable
              style={[
                styles.overflowToggleBtn,
                {
                  backgroundColor: showOverflowMenu
                    ? theme.colors.surfaceElevated
                    : theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={toggleOverflowMenu}
              activeOpacity={0.7}
              accessibilityLabel="Inbox actions overflow menu"
            >
              <Icon name="more-horizontal" size={18} color={theme.colors.textPrimary} />
            </ScalePressable>

            {isModal && onClose ? (
              <ScalePressable
                style={[
                  styles.overflowToggleBtn,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={onClose}
                activeOpacity={0.7}
                accessibilityLabel="Close inbox modal"
              >
                <Icon name="x" size={18} color={theme.colors.textPrimary} />
              </ScalePressable>
            ) : null}
          </View>
        }
      />

      {/* Overflow Menu Dropdown */}
      {showOverflowMenu && (
        <View
          style={[
            styles.overflowCard,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <ScalePressable
            style={styles.overflowItem}
            onPress={() => {
              setShowOverflowMenu(false);
              loadItems();
            }}
            activeOpacity={0.7}
          >
            <Icon name="refresh-cw" size={18} color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>
              Refresh Records
            </Text>
          </ScalePressable>

          {onOpenSimulate && (
            <ScalePressable
              style={[
                styles.overflowItem,
                { borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle },
              ]}
              onPress={() => {
                setShowOverflowMenu(false);
                onOpenSimulate();
              }}
              activeOpacity={0.7}
            >
              <Icon name="bell" size={18} color={theme.colors.agentReminder} style={{ marginRight: 8 }} />
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>
                Simulate Sample Notification
              </Text>
            </ScalePressable>
          )}

          {allItems.length > 0 && (
            <ScalePressable
              style={[
                styles.overflowItem,
                { borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle },
              ]}
              onPress={() => {
                setShowOverflowMenu(false);
                setShowClearConfirm(true);
              }}
              activeOpacity={0.7}
            >
              <Icon name="trash-2" size={18} color={theme.colors.error} style={{ marginRight: 8 }} />
              <Text style={[theme.typography.bodyMedium, { color: theme.colors.error, fontWeight: '600' }]}>
                Clear All Notifications
              </Text>
            </ScalePressable>
          )}
        </View>
      )}

      {/* ========================================================
          1. Triage Segmented Control: Useful (N) | Other (M)
      ======================================================== */}
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
            triageTab === 'useful' && {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.pill,
            },
          ]}
          onPress={() => {
            animateLayout();
            setTriageTab('useful');
            setStatusFilter('all');
            setIsMultiSelectMode(false);
            setSelectedOtherIds({});
          }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon
              name="inbox"
              size={14}
              color={triageTab === 'useful' ? theme.colors.accent : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color: triageTab === 'useful' ? theme.colors.textPrimary : theme.colors.textSecondary,
                  fontWeight: triageTab === 'useful' ? '700' : '500',
                },
              ]}
            >
              Useful ({usefulCount})
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            triageTab === 'other' && {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.pill,
            },
          ]}
          onPress={() => {
            animateLayout();
            setTriageTab('other');
            setStatusFilter('all');
          }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon
              name="bell"
              size={14}
              color={triageTab === 'other' ? theme.colors.accent : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color: triageTab === 'other' ? theme.colors.textPrimary : theme.colors.textSecondary,
                  fontWeight: triageTab === 'other' ? '700' : '500',
                },
              ]}
            >
              Other ({otherCount})
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ========================================================
          2. Status Filter Sub-Chips (inside active segment)
      ======================================================== */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={{ marginVertical: theme.spacing.xs }}
      >
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          const count = statusCounts[tab.key] || 0;

          return (
            <ScalePressable
              key={tab.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? theme.colors.surfaceSubtle : theme.colors.surface,
                  borderColor: isActive ? theme.colors.textPrimary : theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
              onPress={() => {
                animateLayout();
                setStatusFilter(tab.key);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: isActive ? theme.colors.agentInbox : theme.colors.textSecondary,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: isActive
                        ? 'rgba(0, 0, 0, 0.18)'
                        : theme.colors.surfaceSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.countBadgeText,
                      {
                        color: isActive
                          ? theme.colors.agentInbox
                          : theme.colors.textTertiary,
                      },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </ScalePressable>
          );
        })}
      </ScrollView>

      {/* ========================================================
          3. "Other" Segment Action Bar (Dismiss All & Multi-select)
      ======================================================== */}
      {triageTab === 'other' && otherCount > 0 && (
        <View
          style={[
            styles.otherActionBar,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.sm,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={[
                styles.actionPillBtn,
                {
                  backgroundColor: isMultiSelectMode
                    ? theme.colors.surfaceElevated
                    : theme.colors.surface,
                  borderColor: isMultiSelectMode ? theme.colors.accent : theme.colors.border,
                },
              ]}
              onPress={() => {
                animateLayout();
                setIsMultiSelectMode(!isMultiSelectMode);
                setSelectedOtherIds({});
              }}
              activeOpacity={0.7}
            >
              <Icon
                name={isMultiSelectMode ? 'check' : 'filter'}
                size={13}
                color={isMultiSelectMode ? theme.colors.accent : theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.actionPillText,
                  { color: isMultiSelectMode ? theme.colors.accent : theme.colors.textSecondary },
                ]}
              >
                {isMultiSelectMode ? 'Done' : 'Select'}
              </Text>
            </TouchableOpacity>

            {isMultiSelectMode && undismissedOtherCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.actionPillBtn,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={handleToggleSelectAllOther}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionPillText, { color: theme.colors.textSecondary }]}>
                  {selectedCount === undismissedOtherCount ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isMultiSelectMode && selectedCount > 0 ? (
              <TouchableOpacity
                style={[
                  styles.dismissActionBtn,
                  {
                    backgroundColor: theme.colors.errorSurface,
                    borderColor: theme.colors.errorBorder,
                  },
                ]}
                onPress={handleDismissSelectedOther}
                activeOpacity={0.7}
              >
                <Icon name="trash-2" size={13} color={theme.colors.error} />
                <Text style={[styles.dismissActionText, { color: theme.colors.error }]}>
                  Dismiss Selected ({selectedCount})
                </Text>
              </TouchableOpacity>
            ) : !isMultiSelectMode && undismissedOtherCount > 0 ? (
              <TouchableOpacity
                style={[
                  styles.dismissActionBtn,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => setShowDismissAllConfirm(true)}
                activeOpacity={0.7}
              >
                <Icon name="trash-2" size={13} color={theme.colors.textSecondary} />
                <Text style={[styles.dismissActionText, { color: theme.colors.textSecondary }]}>
                  Dismiss all ({undismissedOtherCount})
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* ========================================================
          4. Notifications List / Empty State
      ======================================================== */}
      {isLoading ? (
        <LoadingState message="Loading notification records..." />
      ) : displayedEntries.length === 0 ? (
        <EmptyState
          icon={triageTab === 'useful' ? 'inbox' : 'bell'}
          title={
            triageTab === 'useful'
              ? statusFilter === 'all'
                ? 'No notifications need your attention.'
                : `No '${statusFilter}' Useful notifications`
              : statusFilter === 'all'
              ? 'No promotional or background notifications.'
              : `No '${statusFilter}' Other notifications`
          }
          description={
            triageTab === 'useful'
              ? 'Actionable notifications like transaction alerts, bills, and calendar invites will appear here.'
              : 'Promotions, marketing alerts, and noise will appear here for quick review or dismissal.'
          }
          actionLabel={triageTab === 'useful' && onOpenSettings ? 'Notification Settings' : undefined}
          onAction={onOpenSettings}
        />
      ) : (
        <View style={{ gap: theme.spacing.sm, marginBottom: 80 }}>
          {displayedEntries.map(({ item, triage }, index) => {
            const isProcessing = Boolean(processingIds[item.id]);
            const isExpanded = Boolean(expandedCardIds[item.id]);
            const showTechnical = Boolean(expandedTechIds[item.id]);
            const isSelected = Boolean(selectedOtherIds[item.id]);
            const timeStr = formatItemTime(item.posted_at);
            const agent = resolvePrimaryAgent(item);

            // ============================================
            // 4A. "Useful" Card: Rich, Actionable
            // ============================================
            if (triageTab === 'useful') {
              return (
                <Entrance key={item.id} index={index}>
                  <View
                    style={[
                      styles.usefulCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        borderRadius: theme.radii.md,
                        padding: theme.spacing.md,
                      },
                    ]}
                  >
                    {/* Header Row: Agent Tile + App Badge + Reason Tag + Time + Status */}
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                        <IconTile agent={agent} size={32} iconSize={16} />
                        <View
                          style={[
                            styles.appBadge,
                            {
                              backgroundColor: theme.colors.surfaceSubtle,
                              borderColor: theme.colors.border,
                            },
                          ]}
                        >
                          <Text style={[styles.appBadgeText, { color: theme.colors.textPrimary }]}>
                            {item.app_label || item.source_app}
                          </Text>
                        </View>

                        {/* Reason Tag */}
                        <View
                          style={[
                            styles.reasonBadge,
                            {
                              backgroundColor: triage.isUserOverride
                                ? theme.colors.surfaceSubtle
                                : theme.colors.surfaceElevated,
                              borderColor: triage.isUserOverride
                                ? theme.colors.accent
                                : theme.colors.borderSubtle,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.reasonText,
                              {
                                color: triage.isUserOverride
                                  ? theme.colors.accent
                                  : theme.colors.textSecondary,
                              },
                            ]}
                          >
                            {triage.reason}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {timeStr ? (
                          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                            {timeStr}
                          </Text>
                        ) : null}
                        <StatusBadge status={item.status} size="sm" />
                      </View>
                    </View>

                    {/* Summary & Amount Highlight */}
                    <View style={styles.summaryRow}>
                      <Text
                        style={[
                          theme.typography.titleSmall,
                          { color: theme.colors.textPrimary, flex: 1 },
                        ]}
                      >
                        {triage.plainSummary || item.title}
                      </Text>

                      {triage.extractedAmount ? (
                        <View
                          style={[
                            styles.amountBadge,
                            {
                              backgroundColor: theme.colors.successSurface,
                              borderColor: theme.colors.successBorder,
                            },
                          ]}
                        >
                          <Text style={[styles.amountText, { color: theme.colors.success }]}>
                            {triage.extractedAmount}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Original Title (if different from summary) */}
                    {item.title && item.title !== triage.plainSummary && (
                      <Text
                        style={[
                          theme.typography.caption,
                          { color: theme.colors.textSecondary, marginTop: 4, fontWeight: '600' },
                        ]}
                      >
                        {item.title}
                      </Text>
                    )}

                    {/* Body text with max 2 lines collapsed & expand toggle */}
                    <Text
                      style={[
                        theme.typography.bodyMedium,
                        { color: theme.colors.textSecondary, marginTop: 4, lineHeight: 22 },
                      ]}
                      numberOfLines={isExpanded ? undefined : 2}
                    >
                      {item.text}
                    </Text>

                    {item.text && item.text.length > 70 && (
                      <TouchableOpacity
                        onPress={() => toggleExpandCard(item.id)}
                        style={{ marginTop: 4, alignSelf: 'flex-start' }}
                        activeOpacity={0.7}
                      >
                        <Text style={[theme.typography.caption, { color: theme.colors.accent, fontWeight: '600' }]}>
                          {isExpanded ? 'Show less' : 'Show more'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Detected Plan Box (if analysed) */}
                    {item.analysis && (
                      <View
                        style={[
                          styles.analysisBox,
                          {
                            backgroundColor: theme.colors.surfaceSubtle,
                            borderColor: theme.colors.border,
                            borderRadius: theme.radii.sm,
                            marginTop: theme.spacing.sm,
                          },
                        ]}
                      >
                        <View style={styles.analysisHeader}>
                          <Text
                            style={[
                              theme.typography.caption,
                              { color: theme.colors.textSecondary, fontWeight: '700' },
                            ]}
                          >
                            DETECTED PLAN
                          </Text>
                          {item.action_plan?.decision.workflow_status && (
                            <StatusBadge
                              status={item.action_plan.decision.workflow_status}
                              size="sm"
                            />
                          )}
                        </View>

                        {item.analysis.intents.map((intent: any, idx: number) => (
                          <View
                            key={idx}
                            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                          >
                            <Icon
                              name="check"
                              size={16}
                              color={theme.colors.success}
                              style={{ marginRight: 6 }}
                            />
                            <Text
                              style={[
                                theme.typography.bodySmall,
                                { color: theme.colors.textPrimary, flex: 1 },
                              ]}
                            >
                              {humanLabel(intent.intent)}
                            </Text>
                          </View>
                        ))}

                        {item.action_plan?.actions.map((act: any, idx: number) => (
                          <View key={idx} style={styles.actionPlanRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <IconTile agent={agentType(act.agent)} size={28} style={{ marginRight: 6 }} />
                              <Text
                                style={[
                                  theme.typography.caption,
                                  { color: theme.colors.textPrimary, fontWeight: '600' },
                                ]}
                              >
                                {humanLabel(act.operation)}{' '}
                                {actionDate(act.data as Record<string, unknown>)}
                              </Text>
                            </View>
                            {act.requires_confirmation ? (
                              <Text
                                style={[
                                  theme.typography.caption,
                                  { color: theme.colors.warning },
                                ]}
                              >
                                Confirmation req
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Clean Result Line (if actioned) with collapsible Technical Details */}
                    {item.status === 'actioned' && (
                      <View
                        style={[
                          styles.resultBox,
                          {
                            backgroundColor: theme.colors.surfaceSubtle,
                            borderColor: theme.colors.successBorder,
                            borderRadius: theme.radii.sm,
                            marginTop: theme.spacing.sm,
                          },
                        ]}
                      >
                        <SuccessFeedback
                          label={notificationResult(item.action_plan, item.execution_result)}
                        />

                        {/* Technical Details Expander */}
                        <ScalePressable
                          style={styles.techToggleRow}
                          onPress={() => toggleExpandTech(item.id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              theme.typography.caption,
                              { color: theme.colors.textSecondary, fontWeight: '600' },
                            ]}
                          >
                            Technical details
                          </Text>
                          <Icon
                            name={showTechnical ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={theme.colors.textSecondary}
                            style={{ marginLeft: 4 }}
                          />
                        </ScalePressable>

                        {showTechnical && item.execution_result && (
                          <View
                            style={[
                              styles.jsonContainer,
                              {
                                backgroundColor: theme.colors.background,
                                borderColor: theme.colors.border,
                                borderRadius: theme.radii.xs,
                                marginTop: 6,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                theme.typography.code,
                                { color: theme.colors.textSecondary },
                              ]}
                            >
                              {JSON.stringify(item.execution_result, null, 2)}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Action Buttons Row */}
                    <View
                      style={[
                        styles.actionsRow,
                        { marginTop: theme.spacing.md, flexWrap: 'wrap' },
                      ]}
                    >
                      {/* One-tap Move to Other */}
                      <TouchableOpacity
                        style={[
                          styles.moveTriageBtn,
                          {
                            backgroundColor: theme.colors.surfaceSubtle,
                            borderColor: theme.colors.border,
                            borderRadius: theme.radii.sm,
                          },
                        ]}
                        onPress={() => handleToggleTriageCategory(item, 'useful')}
                        activeOpacity={0.7}
                        accessibilityLabel="Move to Other notifications"
                      >
                        <Icon name="arrow-right" size={13} color={theme.colors.textSecondary} />
                        <Text
                          style={[
                            styles.moveTriageText,
                            { color: theme.colors.textSecondary },
                          ]}
                        >
                          Move to Other
                        </Text>
                      </TouchableOpacity>

                      <View style={{ flex: 1 }} />

                      {item.status === 'new' && (
                        <PrimaryButton
                          label="Analyse Request"
                          icon="zap"
                          onPress={() => handleAnalyse(item.id)}
                          isLoading={isProcessing}
                          size="sm"
                        />
                      )}

                      {item.status === 'analysed' && (
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <SecondaryButton
                            label="Edit"
                            icon="settings"
                            onPress={() => handleOpenEdit(item)}
                            disabled={isProcessing}
                            size="sm"
                          />
                          <PrimaryButton
                            label="Approve plan"
                            icon="check"
                            onPress={() => handleApprove(item.id)}
                            isLoading={isProcessing}
                            size="sm"
                          />
                        </View>
                      )}

                      {item.status !== 'dismissed' && item.status !== 'actioned' && (
                        <SecondaryButton
                          label="Dismiss"
                          onPress={() => handleDismiss(item.id)}
                          disabled={isProcessing}
                          size="sm"
                        />
                      )}
                    </View>
                  </View>
                </Entrance>
              );
            }

            // ============================================
            // 4B. "Other" Card: Compact, Quiet, Non-intrusive
            // ============================================
            return (
              <Entrance key={item.id} index={index}>
                <ScalePressable
                  style={[
                    styles.otherCard,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.surfaceElevated
                        : theme.colors.card,
                      borderColor: isSelected
                        ? theme.colors.accent
                        : theme.colors.border,
                      borderRadius: theme.radii.sm,
                      opacity: item.status === 'dismissed' ? 0.6 : 1,
                    },
                  ]}
                  onPress={
                    isMultiSelectMode && item.status !== 'dismissed'
                      ? () => toggleSelectOtherItem(item.id)
                      : undefined
                  }
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {/* Multi-select checkbox */}
                    {isMultiSelectMode && item.status !== 'dismissed' ? (
                      <TouchableOpacity
                        onPress={() => toggleSelectOtherItem(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon
                          name={isSelected ? 'check-square' : 'square'}
                          size={18}
                          color={isSelected ? theme.colors.accent : theme.colors.textSecondary}
                        />
                      </TouchableOpacity>
                    ) : null}

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <View
                          style={[
                            styles.miniAppBadge,
                            {
                              backgroundColor: theme.colors.surfaceSubtle,
                              borderColor: theme.colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.miniAppBadgeText,
                              { color: theme.colors.textPrimary },
                            ]}
                          >
                            {item.app_label || item.source_app}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.miniReasonBadge,
                            {
                              backgroundColor: triage.isUserOverride
                                ? theme.colors.surfaceSubtle
                                : theme.colors.surfaceElevated,
                              borderColor: triage.isUserOverride
                                ? theme.colors.accent
                                : theme.colors.borderSubtle,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.miniReasonText,
                              {
                                color: triage.isUserOverride
                                  ? theme.colors.accent
                                  : theme.colors.textTertiary,
                              },
                            ]}
                          >
                            {triage.reason}
                          </Text>
                        </View>

                        {timeStr ? (
                          <Text
                            style={[
                              theme.typography.caption,
                              { color: theme.colors.textTertiary, marginLeft: 'auto' },
                            ]}
                          >
                            {timeStr}
                          </Text>
                        ) : null}
                      </View>

                      {/* Quiet one-line / two-line text */}
                      <Text
                        style={[
                          theme.typography.bodySmall,
                          { color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 },
                        ]}
                        numberOfLines={2}
                      >
                        {item.title ? `${item.title}: ` : ''}
                        {item.text}
                      </Text>
                    </View>

                    {/* Quiet actions: Move to Useful + Dismiss */}
                    {!isMultiSelectMode && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={[
                            styles.miniActionBtn,
                            {
                              backgroundColor: theme.colors.surfaceSubtle,
                              borderColor: theme.colors.border,
                            },
                          ]}
                          onPress={() => handleToggleTriageCategory(item, 'other')}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityLabel="Move notification to Useful"
                        >
                          <Icon name="arrow-right" size={13} color={theme.colors.accent} />
                          <Text style={[styles.miniActionText, { color: theme.colors.accent }]}>
                            To Useful
                          </Text>
                        </TouchableOpacity>

                        {item.status !== 'dismissed' ? (
                          <TouchableOpacity
                            style={[
                              styles.miniDismissBtn,
                              {
                                backgroundColor: theme.colors.surfaceSubtle,
                                borderColor: theme.colors.border,
                              },
                            ]}
                            onPress={() => handleDismiss(item.id)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            accessibilityLabel="Dismiss notification"
                          >
                            <Icon name="x" size={14} color={theme.colors.textSecondary} />
                          </TouchableOpacity>
                        ) : (
                          <View
                            style={[
                              styles.miniReasonBadge,
                              {
                                backgroundColor: theme.colors.surfaceSubtle,
                                borderColor: theme.colors.borderSubtle,
                              },
                            ]}
                          >
                            <Text style={[styles.miniReasonText, { color: theme.colors.textMuted }]}>
                              Dismissed
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </ScalePressable>
              </Entrance>
            );
          })}
        </View>
      )}

      {/* ========================================================
          5. Floating Undo Snackbar (active for 5 seconds)
      ======================================================== */}
      {undoSnackbar && undoSnackbar.visible && (
        <View
          style={[
            styles.undoSnackbar,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Icon name="info" size={16} color={theme.colors.accent} />
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary }]}>
              Dismissed {undoSnackbar.count} notification{undoSnackbar.count === 1 ? '' : 's'}.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.undoButton,
              {
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radii.sm,
              },
            ]}
            onPress={handleUndoDismiss}
            activeOpacity={0.8}
          >
            <Text style={[styles.undoButtonText, { color: theme.colors.accentForeground }]}>
              Undo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
              animateLayout();
              setUndoSnackbar(null);
            }}
            style={{ padding: 4 }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon name="x" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Action Plan Edit Bottom Sheet */}
      <BottomSheet
        visible={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Edit Proposed Action"
      >
        {editingItem && (
          <View style={{ paddingBottom: theme.spacing.md }}>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary, marginBottom: 4 },
              ]}
            >
              Title / Summary
            </Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.sm,
                  padding: theme.spacing.sm,
                },
                theme.typography.bodyMedium,
              ]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Event title..."
              placeholderTextColor={theme.colors.textMuted}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary, marginBottom: 4 },
                  ]}
                >
                  Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  style={[
                    styles.editInput,
                    {
                      backgroundColor: theme.colors.surfaceSubtle,
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radii.sm,
                      padding: theme.spacing.sm,
                    },
                    theme.typography.bodyMedium,
                  ]}
                  value={editDate}
                  onChangeText={setEditDate}
                  placeholder="2026-11-15"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: theme.colors.textSecondary, marginBottom: 4 },
                  ]}
                >
                  Time (HH:MM)
                </Text>
                <TextInput
                  style={[
                    styles.editInput,
                    {
                      backgroundColor: theme.colors.surfaceSubtle,
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radii.sm,
                      padding: theme.spacing.sm,
                    },
                    theme.typography.bodyMedium,
                  ]}
                  value={editTime}
                  onChangeText={setEditTime}
                  placeholder="15:00"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 16,
              }}
            >
              <SecondaryButton label="Cancel" onPress={() => setEditingItem(null)} size="sm" />
              <PrimaryButton
                label="Save & Approve"
                icon="check"
                onPress={handleSaveEdit}
                size="sm"
              />
            </View>
          </View>
        )}
      </BottomSheet>

      {/* Dismiss All Other Confirmation Dialog */}
      <ConfirmationDialog
        visible={showDismissAllConfirm}
        title={`Dismiss ${undismissedOtherCount} notifications?`}
        message={`Are you sure you want to dismiss all ${undismissedOtherCount} background notifications? You can undo this immediately.`}
        confirmLabel="Dismiss All"
        isDestructive
        onConfirm={handleDismissAllOtherConfirm}
        onCancel={() => setShowDismissAllConfirm(false)}
      />

      {/* Clear All Notifications Confirmation Dialog */}
      <ConfirmationDialog
        visible={showClearConfirm}
        title="Clear All Notifications?"
        message="This will delete all stored notification records from your on-device SQLite database. This action cannot be undone."
        confirmLabel="Clear All"
        isDestructive
        onConfirm={handleClearAllConfirm}
        onCancel={() => setShowClearConfirm(false)}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  overflowToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  overflowCard: {
    borderWidth: 1,
    paddingVertical: 4,
    marginBottom: 8,
  },
  overflowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 3,
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentText: {
    fontSize: 13,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 6,
  },
  filterText: {
    fontSize: 13,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  otherActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dismissActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  dismissActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  usefulCard: {
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  appBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  reasonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  amountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  analysisBox: {
    padding: 10,
    borderWidth: 1,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionPlanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultBox: {
    padding: 10,
    borderWidth: 1,
  },
  techToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  jsonContainer: {
    padding: 8,
    borderWidth: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moveTriageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  moveTriageText: {
    fontSize: 12,
    fontWeight: '600',
  },
  otherCard: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  miniAppBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  miniAppBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  miniReasonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  miniReasonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  miniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  miniActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  miniDismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  undoSnackbar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  undoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
  },
  undoButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editInput: {
    borderWidth: 1,
  },
});
