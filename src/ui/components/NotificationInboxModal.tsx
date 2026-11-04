import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActionItem, ActionPlan } from '../../models/ActionPlan';
import { NotificationInboxItem, NotificationInboxStatus } from '../../models/NotificationEvent';
import { NotificationProcessor } from '../../notifications/notificationProcessor';

interface NotificationInboxModalProps {
  visible: boolean;
  onClose: () => void;
  processor: NotificationProcessor;
}

export const NotificationInboxModal: React.FC<NotificationInboxModalProps> = ({
  visible,
  onClose,
  processor,
}) => {
  const [items, setItems] = useState<NotificationInboxItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<NotificationInboxStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});

  // Editing state for an action plan
  const [editingItem, setEditingItem] = useState<NotificationInboxItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('');

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const repo = processor.getRepository();
      const all = await repo.listAll(statusFilter === 'all' ? undefined : statusFilter);
      setItems(all);
    } catch (err) {
      console.warn('[NotificationInbox] Error loading items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadItems();
    }
  }, [visible, statusFilter]);

  const handleAnalyse = async (itemId: string) => {
    setProcessingIds((prev) => ({ ...prev, [itemId]: true }));
    try {
      await processor.analyzeInboxItem(itemId);
      await loadItems();
    } catch (err: any) {
      Alert.alert('Analysis Failed', err?.message || 'Could not analyze notification.');
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
      await loadItems();
    } catch (err: any) {
      Alert.alert('Approval Failed', err?.message || 'Could not approve action plan.');
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

    const modifiedActions = editingItem.action_plan.actions.map((act) => ({
      ...act,
      data: {
        ...act.data,
        title: editTitle,
        description: editTitle,
        date: editDate || (act.data as any).date,
        due_date: editDate || (act.data as any).due_date,
        start_time: editTime || (act.data as any).start_time,
        time: editTime || (act.data as any).time,
      },
    }));

    const modifiedPlan: ActionPlan = {
      ...editingItem.action_plan,
      actions: modifiedActions,
    };

    setEditingItem(null);
    setProcessingIds((prev) => ({ ...prev, [editingItem.id]: true }));

    try {
      await processor.approveActionPlan(editingItem.id, modifiedPlan);
      Alert.alert('Approved with Edits', 'The edited action plan was executed successfully.');
      await loadItems();
    } catch (err: any) {
      Alert.alert('Execution Error', err?.message || 'Failed to execute edited plan.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [editingItem.id]: false }));
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notification records from local SQLite?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await processor.getRepository().clearAll();
            await loadItems();
          },
        },
      ]
    );
  };

  const renderStatusBadge = (status: NotificationInboxStatus) => {
    switch (status) {
      case 'new':
        return (
          <View style={[styles.statusBadge, styles.statusNew]}>
            <Text style={styles.statusBadgeText}>NEW</Text>
          </View>
        );
      case 'analysed':
        return (
          <View style={[styles.statusBadge, styles.statusAnalysed]}>
            <Text style={styles.statusBadgeText}>ANALYSED</Text>
          </View>
        );
      case 'actioned':
        return (
          <View style={[styles.statusBadge, styles.statusActioned]}>
            <Text style={styles.statusBadgeText}>ACTIONED</Text>
          </View>
        );
      case 'dismissed':
        return (
          <View style={[styles.statusBadge, styles.statusDismissed]}>
            <Text style={styles.statusBadgeText}>DISMISSED</Text>
          </View>
        );
      case 'failed':
      default:
        return (
          <View style={[styles.statusBadge, styles.statusFailed]}>
            <Text style={styles.statusBadgeText}>FAILED</Text>
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Notification Inbox</Text>
              <Text style={styles.subtitle}>
                Local SQLite inbox • User approval required before execution
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {(['all', 'new', 'analysed', 'actioned', 'dismissed'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.filterChip, statusFilter === tab && styles.filterChipActive]}
                onPress={() => setStatusFilter(tab)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === tab && styles.filterChipTextActive,
                  ]}
                >
                  {tab.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Action Bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadItems}>
              <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
              <Text style={styles.clearBtnText}>🗑️ Clear All</Text>
            </TouchableOpacity>
          </View>

          {/* Items List */}
          <ScrollView style={styles.scrollArea}>
            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#38bdf8" />
                <Text style={styles.loadingText}>Loading inbox records...</Text>
              </View>
            ) : items.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No Notifications Found</Text>
                <Text style={styles.emptyDesc}>
                  {statusFilter === 'all'
                    ? 'No notifications captured yet. Use the "Simulate Notification" menu to test alerts.'
                    : `No notifications with status '${statusFilter}'.`}
                </Text>
              </View>
            ) : (
              <View style={styles.itemsList}>
                {items.map((item) => {
                  const isProcessing = Boolean(processingIds[item.id]);
                  return (
                    <View key={item.id} style={styles.itemCard}>
                      {/* Top App & Status Row */}
                      <View style={styles.itemHeader}>
                        <View style={styles.appBadge}>
                          <Text style={styles.appBadgeText}>{item.app_label}</Text>
                        </View>
                        <View style={styles.statusGroup}>
                          {renderStatusBadge(item.status)}
                          <Text style={styles.timeText}>
                            {new Date(item.posted_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>

                      {/* Title & Body */}
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemBody}>{item.text}</Text>

                      {/* Package identifier context */}
                      <Text style={styles.packageMeta}>App: {item.source_app}</Text>

                      {/* Analysed Details (if analysed) */}
                      {item.analysis && (
                        <View style={styles.analysisDetailsBox}>
                          <View style={styles.analysisHeaderRow}>
                            <Text style={styles.analysisHeaderLabel}>Intent Analysis</Text>
                            <Text style={styles.workflowBadge}>
                              Status: {item.action_plan?.decision.workflow_status}
                            </Text>
                          </View>

                          {item.analysis.intents.map((intent, idx) => (
                            <View key={idx} style={styles.intentRow}>
                              <Text style={styles.intentName}>🎯 {intent.intent}</Text>
                              <Text style={styles.confidenceText}>
                                Conf: {(intent.confidence * 100).toFixed(0)}%
                              </Text>
                            </View>
                          ))}

                          {item.action_plan?.actions.map((act, idx) => (
                            <View key={idx} style={styles.actionPlanRow}>
                              <Text style={styles.actionAgentText}>
                                🤖 Agent: {act.agent} ({act.operation})
                              </Text>
                              {act.requires_confirmation && (
                                <Text style={styles.confirmBadge}>⚠️ Requires Confirmation</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Execution Result (if actioned) */}
                      {item.status === 'actioned' && item.execution_result && (
                        <View style={styles.resultBox}>
                          <Text style={styles.resultBoxTitle}>✓ Execution Succeeded</Text>
                          <Text style={styles.resultBoxText}>
                            {JSON.stringify(item.execution_result, null, 2)}
                          </Text>
                        </View>
                      )}

                      {/* Actions Row */}
                      <View style={styles.cardButtonsRow}>
                        {item.status === 'new' && (
                          <TouchableOpacity
                            style={styles.analyseButton}
                            onPress={() => handleAnalyse(item.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <ActivityIndicator color="#0f172a" size="small" />
                            ) : (
                              <Text style={styles.analyseButtonText}>⚡ Analyse</Text>
                            )}
                          </TouchableOpacity>
                        )}

                        {item.status === 'analysed' && (
                          <>
                            <TouchableOpacity
                              style={styles.editButton}
                              onPress={() => handleOpenEdit(item)}
                              disabled={isProcessing}
                            >
                              <Text style={styles.editButtonText}>✏️ Edit</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.approveButton}
                              onPress={() => handleApprove(item.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <ActivityIndicator color="#0f172a" size="small" />
                              ) : (
                                <Text style={styles.approveButtonText}>✓ Approve & Execute</Text>
                              )}
                            </TouchableOpacity>
                          </>
                        )}

                        {item.status !== 'dismissed' && item.status !== 'actioned' && (
                          <TouchableOpacity
                            style={styles.dismissButton}
                            onPress={() => handleDismiss(item.id)}
                            disabled={isProcessing}
                          >
                            <Text style={styles.dismissButtonText}>✕ Dismiss</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Edit Plan Modal Sheet */}
          {editingItem && (
            <Modal visible={true} transparent animationType="fade">
              <View style={styles.editOverlay}>
                <View style={styles.editCard}>
                  <Text style={styles.editTitle}>Edit Proposed Action</Text>
                  <Text style={styles.editSubtitle}>
                    Modify action fields before approving execution
                  </Text>

                  <Text style={styles.inputLabel}>Title / Description:</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Event or Reminder title"
                    placeholderTextColor="#64748b"
                  />

                  <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD):</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editDate}
                    onChangeText={setEditDate}
                    placeholder="e.g. 2026-11-04"
                    placeholderTextColor="#64748b"
                  />

                  <Text style={styles.inputLabel}>Start Time (HH:MM):</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editTime}
                    onChangeText={setEditTime}
                    placeholder="e.g. 15:00"
                    placeholderTextColor="#64748b"
                  />

                  <View style={styles.editActionRow}>
                    <TouchableOpacity
                      style={styles.cancelEditBtn}
                      onPress={() => setEditingItem(null)}
                    >
                      <Text style={styles.cancelEditBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveEditBtn} onPress={handleSaveEdit}>
                      <Text style={styles.saveEditBtnText}>✓ Save & Approve</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* Footer Close */}
          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#090d16',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '94%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  filterScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  filterChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#f8fafc',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  refreshBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  refreshBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  clearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  clearBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '600',
  },
  scrollArea: {
    marginBottom: 10,
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyDesc: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  itemsList: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  appBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  appBadgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusNew: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  statusAnalysed: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
  },
  statusActioned: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusDismissed: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  statusFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusBadgeText: {
    color: '#f8fafc',
    fontSize: 9,
    fontWeight: '800',
  },
  timeText: {
    color: '#64748b',
    fontSize: 10,
  },
  itemTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemBody: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
  },
  packageMeta: {
    color: '#475569',
    fontSize: 9,
    marginTop: 4,
  },
  analysisDetailsBox: {
    backgroundColor: '#020617',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  analysisHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  analysisHeaderLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  workflowBadge: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '700',
  },
  intentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  intentName: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
  },
  confidenceText: {
    color: '#64748b',
    fontSize: 10,
  },
  actionPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  actionAgentText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '600',
  },
  confirmBadge: {
    color: '#fcd34d',
    fontSize: 9,
    fontWeight: '700',
  },
  resultBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  resultBoxTitle: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  resultBoxText: {
    color: '#cbd5e1',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  cardButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 10,
  },
  analyseButton: {
    backgroundColor: '#38bdf8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  analyseButtonText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '700',
  },
  editButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  editButtonText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  approveButton: {
    backgroundColor: '#10b981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  approveButtonText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '700',
  },
  dismissButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  dismissButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  editCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  editTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  editSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 12,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 2,
  },
  editInput: {
    backgroundColor: '#020617',
    borderRadius: 6,
    padding: 8,
    color: '#f8fafc',
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  editActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  cancelEditBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelEditBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  saveEditBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  saveEditBtnText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  doneBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
});

