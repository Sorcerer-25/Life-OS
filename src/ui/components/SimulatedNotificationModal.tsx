import { ScalePressable } from './core/Motion';
import { Theme, useTheme } from '../theme';
import { IconTile } from './core/IconTile';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
    View,
} from 'react-native';
import { Icon } from './core/Icon';
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
  const { theme } = useTheme();
  const styles = createStyles(theme);
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
          text: `“${event.title}” is ready to review in Inbox.`,
          type: 'success',
        });
      } else {
        if (result.reason === 'app_not_allowed') {
          setStatusMessage({
            text: ` Dropped immediately: App "${event.source_app}" is NOT in user allow-list. Never stored in SQLite.`,
            type: 'warning',
          });
        } else if (result.reason === 'duplicate_notification') {
          setStatusMessage({
            text: ` De-duplicated: Identical notification was already received within the 15-minute time window.`,
            type: 'warning',
          });
        } else {
          setStatusMessage({
            text: ` Dropped by pre-filter: ${result.reason}`,
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Simulate Notification</Text>
              <Text style={styles.subtitle}>Try a sample alert before connecting your apps.</Text>
            </View>
            <ScalePressable style={styles.closeButton} onPress={onClose}>
              <Icon name="x" color={theme.colors.textPrimary} />
            </ScalePressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <ScalePressable style={[styles.tabButton, activeTab === 'presets' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('presets');
                setStatusMessage(null);
              }}
            >
              <Text style={[styles.tabText, activeTab === 'presets' && styles.tabTextActive]}>
                Presets ({samples.length})
              </Text>
            </ScalePressable>
            <ScalePressable style={[styles.tabButton, activeTab === 'custom' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('custom');
                setStatusMessage(null);
              }}
            >
              <Text style={[styles.tabText, activeTab === 'custom' && styles.tabTextActive]}>
                Custom Alert
              </Text>
            </ScalePressable>
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
                <ScalePressable style={styles.openInboxFeedbackBtn}
                  onPress={() => {
                    onClose();
                    onOpenInbox();
                  }}
                >
                  <Text style={styles.openInboxFeedbackBtnText}>Open in Inbox →</Text>
                </ScalePressable>
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <IconTile agent="inbox" />
                          <Text style={styles.sampleNotifTitle}>{sample.event.title}</Text>
                        </View>
                        <Text style={styles.sampleNotifBody}>{sample.event.text}</Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 }}>
                        <Icon name="info" size={18} color={theme.colors.textSecondary} />
                        <Text style={styles.sampleDesc}>{sample.description}</Text>
                      </View>

                      <View style={styles.cardActionsRow}>
                        {!allowed && (
                          <ScalePressable style={styles.allowButton}
                            onPress={() => handleAllowAndSimulate(sample)}
                          >
                            <Text style={styles.allowButtonText}>+ Allow App & Send</Text>
                          </ScalePressable>
                        )}
                        <ScalePressable style={[styles.sendButton, !allowed && styles.sendButtonBlocked]}
                          onPress={() => handleSimulate(sample.event)}
                        >
                          <Text style={styles.sendButtonText}>
                            {allowed ? ' Simulate Notification' : 'Simulate (Will Drop)'}
                          </Text>
                        </ScalePressable>
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
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                />

                <Text style={styles.fieldLabel}>App Display Label:</Text>
                <TextInput
                  style={styles.inputField}
                  value={customLabel}
                  onChangeText={setCustomLabel}
                  placeholder="e.g. Calendar"
                  placeholderTextColor={theme.colors.textSecondary}
                />

                <Text style={styles.fieldLabel}>Notification Title:</Text>
                <TextInput
                  style={styles.inputField}
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  placeholder="e.g. Meeting Invitation"
                  placeholderTextColor={theme.colors.textSecondary}
                />

                <Text style={styles.fieldLabel}>Notification Body Text:</Text>
                <TextInput
                  style={[styles.inputField, styles.textArea]}
                  value={customBody}
                  onChangeText={setCustomBody}
                  multiline
                  numberOfLines={3}
                  placeholder="e.g. Sync with team tomorrow at 3 PM"
                  placeholderTextColor={theme.colors.textSecondary}
                />

                <ScalePressable style={styles.simulateCustomBtn} onPress={handleSimulateCustom}>
                  <Text style={styles.simulateCustomBtnText}> Simulate Custom Notification</Text>
                </ScalePressable>
              </View>
            )}
          </ScrollView>

          {/* Footer View Inbox Button */}
          <ScalePressable style={styles.footerInboxBtn}
            onPress={() => {
              onClose();
              onOpenInbox();
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="inbox" size={18} color={theme.colors.textPrimary} />
              <Text style={styles.footerInboxBtnText}>Go to Notification Inbox</Text>
            </View>
          </ScalePressable>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '92%',
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.border,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: theme.colors.info,
    fontWeight: '700',
  },
  feedbackBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  feedbackSuccess: {
    backgroundColor: theme.colors.surface,
    borderLeftColor: theme.colors.success,
  },
  feedbackWarning: {
    backgroundColor: theme.colors.surface,
    borderLeftColor: theme.colors.warning,
  },
  feedbackError: {
    backgroundColor: theme.colors.surface,
    borderLeftColor: theme.colors.error,
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 22,
  },
  feedbackTextSuccess: {
    color: theme.colors.success,
  },
  feedbackTextWarning: {
    color: theme.colors.warning,
  },
  feedbackTextError: {
    color: theme.colors.error,
  },
  openInboxFeedbackBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  openInboxFeedbackBtnText: {
    color: theme.colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollArea: {
    marginBottom: 10,
  },
  presetsList: {
    gap: 10,
  },
  sampleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  samplePkg: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 1,
  },
  allowBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  allowBadgeAllowed: {
    backgroundColor: 'transparent',
  },
  allowBadgeBlocked: {
    backgroundColor: 'transparent',
  },
  allowBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  allowBadgeTextAllowed: {
    color: theme.colors.success,
  },
  allowBadgeTextBlocked: {
    color: theme.colors.error,
  },
  sampleContentBox: {
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sampleNotifTitle: {
    color: theme.colors.info,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  sampleNotifBody: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 22,
  },
  sampleDesc: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  cardActionsRow: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
  },
  allowButton: {
    backgroundColor: theme.colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.surfaceElevated,
  },
  allowButtonText: {
    color: theme.colors.info,
    fontSize: 13,
    fontWeight: '700',
  },
  sendButton: {
    backgroundColor: theme.colors.surfaceElevated,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  sendButtonBlocked: {
    backgroundColor: theme.colors.border,
  },
  sendButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  customContainer: {
    gap: 8,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  inputField: {
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    padding: 10,
    color: theme.colors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  simulateCustomBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  simulateCustomBtnText: {
    color: theme.colors.primaryForeground,
    fontSize: 13,
    fontWeight: '800',
  },
  footerInboxBtn: {
    backgroundColor: theme.colors.border,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  footerInboxBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});

