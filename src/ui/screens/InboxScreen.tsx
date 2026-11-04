import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActionPlan } from '../../models/ActionPlan';
import { NotificationInboxItem, NotificationInboxStatus } from '../../models/NotificationEvent';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { useTheme } from '../theme';
import { NotificationCard } from '../components/cards/NotificationCard';
import { AppHeader } from '../components/core/AppHeader';
import { BottomSheet } from '../components/core/BottomSheet';
import { ConfirmationDialog } from '../components/core/ConfirmationDialog';
import { EmptyState } from '../components/core/EmptyState';
import { LoadingState } from '../components/core/LoadingState';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { SecondaryButton } from '../components/core/SecondaryButton';

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
  const { theme, toggleTheme } = useTheme();

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

  // Confirmation dialog state for Clear All
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Editing state for an action plan (via BottomSheet)
  const [editingItem, setEditingItem] = useState<NotificationInboxItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');

  const loadItemsAndCounts = async () => {
    setIsLoading(true);
    try {
      const repo = processor.getRepository();
      const all = await repo.listAll();

      // Compute counts per category
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

      // Filtered items
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
  };

  useEffect(() => {
    loadItemsAndCounts();
  }, [statusFilter]);

  const handleAnalyse = async (itemId: string) => {
    setProcessingIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      // Analysis never approves: it only performs deterministic understanding and planning
      await processor.analyzeInboxItem(itemId);
      await loadItemsAndCounts();
    } catch (err: any) {
      Alert.alert('Analysis Notice', err?.message || 'Could not analyze notification.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleApprove = async (itemId: string) => {
    setProcessingIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      const result = await processor.approveActionPlan(itemId);
      if (result.success) {
        Alert.alert('Action Plan Executed', 'Approved actions have been executed successfully.');
      } else {
        Alert.alert('Execution Incomplete', 'One or more approved actions failed to execute.');
      }
      await loadItemsAndCounts();
    } catch (err: any) {
      Alert.alert('Approval Issue', err?.message || 'Could not approve action plan.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleDismiss = async (itemId: string) => {
    setProcessingIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      // Dismissed items never execute
      await processor.dismissNotification(itemId);
      await loadItemsAndCounts();
    } catch (err: any) {
      Alert.alert('Dismiss Failed', err?.message || 'Could not dismiss notification.');
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

    // Edits are re-validated before execution
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
      await processor.approveActionPlan(targetId, modifiedPlan);
      Alert.alert('Approved with Edits', 'The edited action plan was executed successfully.');
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

  const filterTabs: Array<{ key: FilterTab; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'analysed', label: 'Analysed' },
    { key: 'actioned', label: 'Actioned' },
    { key: 'dismissed', label: 'Dismissed' },
    { key: 'failed', label: 'Failed' },
  ];

  return (
    <ScreenContainer testID="inbox-screen">
      {/* Header */}
      <AppHeader
        title="Notification Inbox"
        subtitle="Local SQLite inbox • User approval required before execution"
        showStatusIndicator
        statusLabel="Deterministic Engine"
        onToggleTheme={toggleTheme}
        onOpenSettings={onOpenSettings}
        rightAction={
          isModal && onClose ? (
            <TouchableOpacity
              style={[
                styles.modalCloseBtn,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Action Controls & Simulator Banner */}
      <View style={styles.topControlRow}>
        <View style={styles.leftButtons}>
          <TouchableOpacity
            style={[
              styles.actionPill,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={loadItemsAndCounts}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionPillText, { color: theme.colors.primaryLight }]}>
              🔄 Refresh
            </Text>
          </TouchableOpacity>

          {onOpenSimulate && (
            <TouchableOpacity
              style={[
                styles.actionPill,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={onOpenSimulate}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionPillText, { color: theme.colors.accent }]}>
                🔔 Simulate Alert
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {counts.all > 0 && (
          <TouchableOpacity
            style={styles.clearAllBtn}
            onPress={() => setShowClearConfirm(true)}
            activeOpacity={0.7}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.errorForeground, fontWeight: '700' }]}>
              🗑️ Clear All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={{ marginVertical: theme.spacing.sm }}
      >
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          const count = counts[tab.key] || 0;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive
                    ? theme.colors.primary
                    : theme.colors.surface,
                  borderColor: isActive ? theme.colors.primaryLight : theme.colors.border,
                  borderRadius: theme.radii.pill,
                },
              ]}
              onPress={() => setStatusFilter(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: isActive ? theme.colors.primaryForeground : theme.colors.textSecondary,
                    fontWeight: isActive ? '700' : '600',
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
                          ? theme.colors.primaryForeground
                          : theme.colors.textTertiary,
                      },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Notifications List */}
      {isLoading ? (
        <LoadingState message="Loading notification records from SQLite..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📭"
          title={
            statusFilter === 'all'
              ? 'No Notifications Stored'
              : `No '${statusFilter.toUpperCase()}' Notifications`
          }
          description={
            statusFilter === 'all'
              ? 'Incoming notifications from allowed applications will be stored in on-device SQLite and displayed here.'
              : `No notification records found matching the '${statusFilter}' filter.`
          }
          actionLabel={onOpenSimulate ? 'Simulate Sample Notification' : undefined}
          onAction={onOpenSimulate}
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {items.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              isProcessing={Boolean(processingIds[item.id])}
              onAnalyse={handleAnalyse}
              onApprove={handleApprove}
              onEdit={handleOpenEdit}
              onDismiss={handleDismiss}
            />
          ))}
        </View>
      )}

      {/* Confirmation Dialog for Clear All */}
      <ConfirmationDialog
        visible={showClearConfirm}
        title="Clear All Notifications"
        message="Are you sure you want to permanently delete all notification records from local SQLite? This cannot be undone."
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        isDestructive
        onConfirm={handleClearAllConfirm}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Edit Action Plan BottomSheet */}
      {editingItem && (
        <BottomSheet
          visible={true}
          title="Edit Proposed Action"
          subtitle="Modify fields before approving execution"
          onClose={() => setEditingItem(null)}
          footer={
            <View style={styles.editFooterRow}>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label="Cancel"
                  onPress={() => setEditingItem(null)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Save & Approve"
                  icon="✓"
                  onPress={handleSaveEdit}
                  isLoading={Boolean(processingIds[editingItem.id])}
                />
              </View>
            </View>
          }
        >
          <View style={{ gap: theme.spacing.md }}>
            <View>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 4 }]}>
                Title / Description:
              </Text>
              <TextInput
                style={[
                  styles.editInput,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    color: theme.colors.textPrimary,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.sm,
                    padding: theme.spacing.md,
                  },
                  theme.typography.bodyLarge,
                ]}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="e.g. Electricity bill payment"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <View>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 4 }]}>
                Due Date (YYYY-MM-DD):
              </Text>
              <TextInput
                style={[
                  styles.editInput,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    color: theme.colors.textPrimary,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.sm,
                    padding: theme.spacing.md,
                  },
                  theme.typography.bodyLarge,
                ]}
                value={editDate}
                onChangeText={setEditDate}
                placeholder="e.g. 2026-11-04"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <View>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 4 }]}>
                Start Time (HH:MM):
              </Text>
              <TextInput
                style={[
                  styles.editInput,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    color: theme.colors.textPrimary,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.sm,
                    padding: theme.spacing.md,
                  },
                  theme.typography.bodyLarge,
                ]}
                value={editTime}
                onChangeText={setEditTime}
                placeholder="e.g. 15:00"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>
          </View>
        </BottomSheet>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  leftButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  clearAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  filterScroll: {
    gap: 6,
    paddingRight: 10,
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
    fontSize: 12,
  },
  countBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  editFooterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editInput: {
    borderWidth: 1,
  },
});

