import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  NotificationEvent,
} from '../../models/NotificationEvent';
import {
  addAppToAllowList,
  isAppAllowed,
} from '../../notifications/notificationSettings';
import {
  getSimulatedNotificationSamples,
  SimulatedSampleNotification,
} from '../../notifications/simulatedSamples';
import { NotificationProcessor, ProcessNotificationResult } from '../../notifications/notificationProcessor';

interface SimulatedNotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenInbox: () => void;
  processor: NotificationProcessor;
  onNotificationProcessed?: () => void;
}

export const SimulatedNotificationModal: React.FC<SimulatedNotificationModalProps> = ({
  visible,
  onClose,
  onOpenInbox,
  processor,
  onNotificationProcessed,
}) => {
  const [samples] = useState<SimulatedSampleNotification[]>(getSimulatedNotificationSamples());
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Custom notification fields
  const [customPkg, setCustomPkg] = useState<string>('com.axis.mobile');
  const [customLabel, setCustomLabel] = useState<string>('Axis Mobile');
  const [customTitle, setCustomTitle] = useState<string>('Axis Bank Alert');
  const [customBody, setCustomBody] = useState<string>('INR 1,500.00 debited from A/C 987654321012 at Supermarket');

  const handleSimulate = async (event: NotificationEvent) => {
    setStatusMessage(null);
    try {
      const result: ProcessNotificationResult = await processor.processNotification(event);
      onNotificationProcessed?.();

      if (result.accepted) {
        setStatusMessage({
          text: `✓ Accepted: "${event.title}" saved to SQLite inbox as 'new'. User approval required before execution.`,
          type: 'success',
        });
      } else {
        if (result.reason === 'app_not_allowed') {
          setStatusMessage({
            text: `⚠️ Dropped immediately: App "${event.source_app}" is NOT in user allow-list. Never stored in SQLite.`,
            type: 'warning',
          });
        } else if (result.reason === 'duplicate_notification') {
          setStatusMessage({
            text: `ℹ️ De-duplicated: Identical notification was already received within the 15-minute time window.`,
            type: 'warning',
          });
        } else {
          setStatusMessage({
            text: `⚠️ Dropped by pre-filter: ${result.reason}`,
            type: 'warning',
          });
        }
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Error processing notification: ${err?.message || 'Unknown error'}`,
        type: 'error',
      });
    }
  };

  const handleAllowAndSimulate = (sample: SimulatedSampleNotification) => {
    addAppToAllowList(sample.event.source_app);
    handleSimulate(sample.event);
  };

  const handleSimulateCustom = () => {
    if (!customPkg.trim() || !customBody.trim()) {
      setStatusMessage({
        text: 'Please provide package name and notification text.',
        type: 'error',
      });
      return;
    }

    const event: NotificationEvent = {
      notification_id: `custom_${Date.now()}`,
      source_app: customPkg.trim(),
      app_label: customLabel.trim() || customPkg.trim(),
      title: customTitle.trim() || 'Notification',
      text: customBody.trim(),
      posted_at: new Date().toISOString(),
    };

    handleSimulate(event);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Simulate Notification</Text>
              <Text style={styles.subtitle}>Test incoming alerts via the shared notification pipeline</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'presets' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('presets');
                setStatusMessage(null);
              }}
            >
              <Text style={[styles.tabText, activeTab === 'presets' && styles.tabTextActive]}>
                Presets ({samples.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'custom' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('custom');
                setStatusMessage(null);
              }}
            >
              <Text style={[styles.tabText, activeTab === 'custom' && styles.tabTextActive]}>
                Custom Alert
              </Text>
            </TouchableOpacity>
          </View>

          {/* Status Feedback Notice */}
          {statusMessage && (
            <View
              style={[
                styles.feedbackBox,
                statusMessage.type === 'success' && styles.feedbackSuccess,
                statusMessage.type === 'warning' && styles.feedbackWarning,
                statusMessage.type === 'error' && styles.feedbackError,
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  statusMessage.type === 'success' && styles.feedbackTextSuccess,
                  statusMessage.type === 'warning' && styles.feedbackTextWarning,
                  statusMessage.type === 'error' && styles.feedbackTextError,
                ]}
              >
                {statusMessage.text}
              </Text>
              {statusMessage.type === 'success' && (
                <TouchableOpacity
                  style={styles.openInboxFeedbackBtn}
                  onPress={() => {
                    onClose();
                    onOpenInbox();
                  }}
                >
                  <Text style={styles.openInboxFeedbackBtnText}>Open in Inbox →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled">
            {activeTab === 'presets' ? (
              <View style={styles.presetsList}>
                {samples.map((sample) => {
                  const allowed = isAppAllowed(sample.event.source_app);
                  return (
                    <View key={sample.id} style={styles.sampleCard}>
                      <View style={styles.sampleHeader}>
                        <View style={styles.sampleTitleGroup}>
                          <Text style={styles.sampleName}>{sample.name}</Text>
                          <Text style={styles.samplePkg}>
                            {sample.event.app_label} ({sample.event.source_app})
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.allowBadge,
                            allowed ? styles.allowBadgeAllowed : styles.allowBadgeBlocked,
                          ]}
                        >
                          <Text
                            style={[
                              styles.allowBadgeText,
                              allowed ? styles.allowBadgeTextAllowed : styles.allowBadgeTextBlocked,
                            ]}
                          >
                            {allowed ? 'ALLOWED' : 'BLOCKED'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.sampleContentBox}>
                        <Text style={styles.sampleNotifTitle}>🔔 {sample.event.title}</Text>
                        <Text style={styles.sampleNotifBody}>{sample.event.text}</Text>
                      </View>

                      <Text style={styles.sampleDesc}>💡 {sample.description}</Text>

                      <View style={styles.cardActionsRow}>
                        {!allowed && (
                          <TouchableOpacity
                            style={styles.allowButton}
                            onPress={() => handleAllowAndSimulate(sample)}
                          >
                            <Text style={styles.allowButtonText}>+ Allow App & Send</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.sendButton, !allowed && styles.sendButtonBlocked]}
                          onPress={() => handleSimulate(sample.event)}
                        >
                          <Text style={styles.sendButtonText}>
                            {allowed ? '⚡ Simulate Notification' : 'Simulate (Will Drop)'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.customContainer}>
                <Text style={styles.fieldLabel}>Source App Package Name:</Text>
                <TextInput
                  style={styles.inputField}
                  value={customPkg}
                  onChangeText={setCustomPkg}
                  placeholder="e.g. com.google.android.calendar"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />

                <Text style={styles.fieldLabel}>App Display Label:</Text>
                <TextInput
                  style={styles.inputField}
                  value={customLabel}
                  onChangeText={setCustomLabel}
                  placeholder="e.g. Calendar"
                  placeholderTextColor="#64748b"
                />

                <Text style={styles.fieldLabel}>Notification Title:</Text>
                <TextInput
                  style={styles.inputField}
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  placeholder="e.g. Meeting Invitation"
                  placeholderTextColor="#64748b"
                />

                <Text style={styles.fieldLabel}>Notification Body Text:</Text>
                <TextInput
                  style={[styles.inputField, styles.textArea]}
                  value={customBody}
                  onChangeText={setCustomBody}
                  multiline
                  numberOfLines={3}
                  placeholder="e.g. Sync with team tomorrow at 3 PM"
                  placeholderTextColor="#64748b"
                />

                <TouchableOpacity style={styles.simulateCustomBtn} onPress={handleSimulateCustom}>
                  <Text style={styles.simulateCustomBtnText}>⚡ Simulate Custom Notification</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Footer View Inbox Button */}
          <TouchableOpacity
            style={styles.footerInboxBtn}
            onPress={() => {
              onClose();
              onOpenInbox();
            }}
          >
            <Text style={styles.footerInboxBtnText}>📥 Go to Notification Inbox</Text>
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
    maxHeight: '92%',
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#1e293b',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  feedbackBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderLeftColor: '#10b981',
  },
  feedbackWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderLeftColor: '#f59e0b',
  },
  feedbackError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderLeftColor: '#ef4444',
  },
  feedbackText: {
    fontSize: 11,
    lineHeight: 16,
  },
  feedbackTextSuccess: {
    color: '#34d399',
  },
  feedbackTextWarning: {
    color: '#fcd34d',
  },
  feedbackTextError: {
    color: '#fca5a5',
  },
  openInboxFeedbackBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  openInboxFeedbackBtnText: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollArea: {
    marginBottom: 10,
  },
  presetsList: {
    gap: 10,
  },
  sampleCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sampleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  sampleTitleGroup: {
    flex: 1,
    marginRight: 8,
  },
  sampleName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  samplePkg: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  allowBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  allowBadgeAllowed: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  allowBadgeBlocked: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  allowBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  allowBadgeTextAllowed: {
    color: '#34d399',
  },
  allowBadgeTextBlocked: {
    color: '#f87171',
  },
  sampleContentBox: {
    backgroundColor: '#020617',
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sampleNotifTitle: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  sampleNotifBody: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 15,
  },
  sampleDesc: {
    color: '#94a3b8',
    fontSize: 10,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
  },
  allowButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  allowButtonText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  sendButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  sendButtonBlocked: {
    backgroundColor: '#334155',
  },
  sendButtonText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  customContainer: {
    gap: 8,
  },
  fieldLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  inputField: {
    backgroundColor: '#020617',
    borderRadius: 6,
    padding: 10,
    color: '#f8fafc',
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  simulateCustomBtn: {
    backgroundColor: '#38bdf8',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  simulateCustomBtnText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  footerInboxBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  footerInboxBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
});

