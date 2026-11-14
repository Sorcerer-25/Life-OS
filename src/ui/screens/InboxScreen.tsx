import { ScalePressable, animateLayout, Entrance } from '../components/core/Motion';
import { SuccessFeedback } from '../components/core/SuccessFeedback';
import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { ActionPlan } from '../../models/ActionPlan';
import { NotificationInboxItem, NotificationInboxStatus } from '../../models/NotificationEvent';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { useTheme } from '../theme';
import { NotificationCard } from '../components/cards/NotificationCard';
import { AppHeader } from '../components/core/AppHeader';
import { BottomSheet } from '../components/core/BottomSheet';
import { ConfirmationDialog } from '../components/core/ConfirmationDialog';
import { EmptyState } from '../components/core/EmptyState';
import { Icon } from '../components/core/Icon';
import { LoadingState } from '../components/core/LoadingState';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { SecondaryButton } from '../components/core/SecondaryButton';

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

export const InboxScreen: React.FC<InboxScreenProps> = ({
  processor,
  onOpenSimulate,
  onOpenSettings,
  onClose,
  isModal = false,
}) => {
  const { theme } = useTheme();

  const [items, setItems] = useState<NotificationInboxItem[]>([]);
  const [counts, setCounts] = useState<Record<FilterTab, number>>({
    all: 0,
    new: 0,
    analysed: 0,
    actioned: 0,
    dismissed: 0,
    failed: 0,
  });
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showOverflowMenu, setShowOverflowMenu] = useState<boolean>(false);

  // Confirmation dialog state for Clear All
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Editing state for an action plan (via BottomSheet)
  const [editingItem, setEditingItem] = useState<NotificationInboxItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');

  const toggleOverflowMenu = () => {
    animateLayout();
    setShowOverflowMenu(!showOverflowMenu);
  };

  const loadItemsAndCounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const repo = processor.getRepository();
      const all = await repo.listAll();

      const newCounts: Record<FilterTab, number> = {
        all: all.length,
        new: 0,
        analysed: 0,
        actioned: 0,
        dismissed: 0,
        failed: 0,
      };

      all.forEach((item) => {
        if (newCounts[item.status] !== undefined) {
          newCounts[item.status]++;
        }
      });
      setCounts(newCounts);

      if (statusFilter === 'all') {
        setItems(all);
      } else {
        setItems(all.filter((i) => i.status === statusFilter));
      }
    } catch (err) {
      console.warn('[InboxScreen] Error loading items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [processor, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return loadItemsAndCounts(); });
    return () => { cancelled = true; };
  }, [loadItemsAndCounts]);

  const handleAnalyse = async (itemId: string) => {
    setProcessingIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await processor.analyzeInboxItem(itemId);
      await loadItemsAndCounts();
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
        Alert.alert('Execution Error', 'One or more actions could not be completed. Open Technical details for more information.');
      }
      await loadItemsAndCounts();
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
      await loadItemsAndCounts();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to dismiss notification.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

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
      else Alert.alert('Action incomplete', 'Some actions could not be completed. Review the result for details.');
      await loadItemsAndCounts();
    } catch (err: any) {
      Alert.alert('Execution Error', err?.message || 'Failed to execute edited plan.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  const handleClearAllConfirm = async () => {
    setShowClearConfirm(false);
    setIsLoading(true);
    try {
      await processor.getRepository().clearAll();
      await loadItemsAndCounts();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to clear notifications.');
    } finally {
      setIsLoading(false);
    }
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'analysed', label: 'Analysed' },
    { key: 'actioned', label: 'Actioned' },
    { key: 'dismissed', label: 'Dismissed' },
    { key: 'failed', label: 'Failed' },
  ];

  return (
    <ScreenContainer testID="inbox-screen">
      {successMessage && <SuccessFeedback key={successMessage + items.map(item => item.updated_at).join()} label={successMessage} />}
      {/* Header */}
      <AppHeader
        title="Notification Inbox"
        subtitle="Review alerts and choose what happens next."
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* Overflow Menu Toggle */}
            <ScalePressable style={[
                styles.overflowToggleBtn,
                {
                  backgroundColor: showOverflowMenu ? theme.colors.surfaceElevated : theme.colors.surfaceSubtle,
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
              <ScalePressable style={[
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

      {/* Overflow Menu Dropdown (Secondary actions) */}
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
          <ScalePressable style={styles.overflowItem}
            onPress={() => {
              setShowOverflowMenu(false);
              loadItemsAndCounts();
            }}
            activeOpacity={0.7}
          >
            <Icon name="refresh-cw" size={18} color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>
              Refresh Records
            </Text>
          </ScalePressable>

          {onOpenSimulate && (
            <ScalePressable style={[styles.overflowItem, { borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle }]}
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

          {counts.all > 0 && (
            <ScalePressable style={[styles.overflowItem, { borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle }]}
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

      {/* Primary Focus: Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={{ marginVertical: theme.spacing.xs }}
      >
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          const count = counts[tab.key] || 0;

          return (
            <ScalePressable key={tab.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? theme.colors.surfaceSubtle : theme.colors.surface,
                  borderColor: isActive ? theme.colors.textPrimary : theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
              onPress={() => setStatusFilter(tab.key)}
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

      {/* Primary Focus: Notifications List */}
      {isLoading ? (
        <LoadingState message="Loading notification records..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={
            statusFilter === 'all'
              ? 'No Notifications Stored'
              : `No '${statusFilter.toUpperCase()}' Notifications`
          }
          description={
            statusFilter === 'all'
              ? 'Alerts from apps you allow will appear here. Enable notification access in Settings.'
              : `No notification records found matching the '${statusFilter}' filter.`
          }
          actionLabel={onOpenSettings ? 'Set up notifications' : undefined}
          onAction={onOpenSettings}
        />
      ) : (
        <View style={{ gap: theme.spacing.sm, marginBottom: 80 }}>
          {items.map((item, index) => (
            <Entrance key={item.id} index={index}>
            <NotificationCard
              key={item.id}
              item={item}
              isProcessing={Boolean(processingIds[item.id])}
              onAnalyse={handleAnalyse}
              onApprove={handleApprove}
              onEdit={handleOpenEdit}
              onDismiss={handleDismiss}
            />
            </Entrance>
          ))}
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
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>
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
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>
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
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>
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

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
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

      {/* Clear All Confirmation Dialog */}
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
  editInput: {
    borderWidth: 1,
  },
});
