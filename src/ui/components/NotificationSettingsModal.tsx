import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getNativeListenerStatus,
  NativeListenerStatus,
  openNotificationListenerSettings,
  requestRebindListener,
  syncSettingsToNative,
} from '../../notifications/nativeNotificationListener';
import {
  addAppToAllowList,
  getNotificationSettings,
  isAppAllowed,
  KNOWN_APPS,
  NotificationSettings,
  removeAppFromAllowList,
  updateNotificationSettings,
} from '../../notifications/notificationSettings';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onClearAllNotifications?: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  visible,
  onClose,
  onClearAllNotifications,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [customPackageInput, setCustomPackageInput] = useState<string>('');
  const [nativeStatus, setNativeStatus] = useState<NativeListenerStatus>({
    isPermissionGranted: false,
    isConnected: false,
    captureEnabled: false,
    queueSize: 0,
  });
  const [showRestrictedHelp, setShowRestrictedHelp] = useState<boolean>(false);

  const refreshStatusAndSettings = async () => {
    const s = getNotificationSettings();
    setSettings(s);
    try {
      const status = await getNativeListenerStatus();
      setNativeStatus(status);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (visible) {
      refreshStatusAndSettings();
    }
  }, [visible]);

  const handleToggleCapture = async (val: boolean) => {
    if (val && !nativeStatus.isPermissionGranted) {
      Alert.alert(
        'Notification Access Required',
        'Android requires explicit Notification Access permission before LifeOS can read incoming notifications. Would you like to open system settings now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: async () => {
              const updated = updateNotificationSettings({ captureEnabled: true });
              setSettings(updated);
              await syncSettingsToNative(true, updated.allowedApps);
              await openNotificationListenerSettings();
              await refreshStatusAndSettings();
            },
          },
        ]
      );
      return;
    }

    const updated = updateNotificationSettings({ captureEnabled: val });
    setSettings(updated);
    await syncSettingsToNative(val, updated.allowedApps);
    await refreshStatusAndSettings();
  };

  const handleToggleApp = async (packageName: string) => {
    if (isAppAllowed(packageName)) {
      removeAppFromAllowList(packageName);
    } else {
      addAppToAllowList(packageName);
    }
    const updated = getNotificationSettings();
    setSettings(updated);
    await syncSettingsToNative(updated.captureEnabled, updated.allowedApps);
  };

  const handleAddCustomPackage = async () => {
    const trimmed = customPackageInput.trim();
    if (!trimmed) return;
    addAppToAllowList(trimmed);
    setCustomPackageInput('');
    const updated = getNotificationSettings();
    setSettings(updated);
    await syncSettingsToNative(updated.captureEnabled, updated.allowedApps);
  };

  const handleSelectRetention = (days: number) => {
    updateNotificationSettings({ retentionDays: days });
    setSettings(getNotificationSettings());
  };

  const handleToggleOfflineOnly = (val: boolean) => {
    updateNotificationSettings({ offlineParserOnly: val });
    setSettings(getNotificationSettings());
  };

  const handleRebind = async () => {
    await requestRebindListener();
    await refreshStatusAndSettings();
    Alert.alert('Rebind Requested', 'Signal sent to Android system to rebind NotificationListenerService.');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Notification Settings</Text>
              <Text style={styles.subtitle}>Privacy-first on-device capture & filtering</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled">
            {/* Privacy & Consent Banner */}
            <View style={styles.privacyCard}>
              <Text style={styles.privacyCardTitle}>🛡️ Privacy & Security Guarantee</Text>
              <Text style={styles.privacyCardText}>
                • All notifications are processed and stored <Text style={styles.boldText}>100% locally on your device</Text>.{'\n'}
                • No cloud backend or remote storage.{'\n'}
                • Only explicitly allow-listed apps are captured.{'\n'}
                • Sensitive bank card and account numbers are automatically masked.{'\n'}
                • Notification actions <Text style={styles.boldText}>never execute automatically</Text> without your approval.
              </Text>
            </View>

            {/* Notification Capture Master Switch */}
            <View style={styles.settingSection}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.sectionTitle}>Real Notification Capture</Text>
                  <Text style={styles.settingHelp}>
                    Capture real incoming notifications from allowed Android apps (default: OFF).
                  </Text>
                </View>
                <Switch
                  value={settings.captureEnabled}
                  onValueChange={handleToggleCapture}
                  trackColor={{ false: '#334155', true: '#0284c7' }}
                  thumbColor={settings.captureEnabled ? '#38bdf8' : '#94a3b8'}
                />
              </View>

              {/* Live Listener Status Card */}
              <View style={styles.permissionStatusBox}>
                <Text style={styles.permissionLabel}>Android Notification Access Status:</Text>
                <View style={styles.statusGrid}>
                  <View style={styles.statusMetric}>
                    <Text style={styles.statusMetricLabel}>Permission:</Text>
                    <Text
                      style={[
                        styles.statusMetricValue,
                        { color: nativeStatus.isPermissionGranted ? '#34d399' : '#fbbf24' },
                      ]}
                    >
                      {nativeStatus.isPermissionGranted ? '✓ GRANTED' : 'NOT GRANTED'}
                    </Text>
                  </View>
                  <View style={styles.statusMetric}>
                    <Text style={styles.statusMetricLabel}>Listener Service:</Text>
                    <Text
                      style={[
                        styles.statusMetricValue,
                        { color: nativeStatus.isConnected ? '#34d399' : '#94a3b8' },
                      ]}
                    >
                      {nativeStatus.isConnected ? '✓ CONNECTED' : 'DISCONNECTED'}
                    </Text>
                  </View>
                </View>

                {/* Actions row: Open settings & Reconnect */}
                <View style={styles.statusActionRow}>
                  <TouchableOpacity
                    style={styles.openSettingsButton}
                    onPress={openNotificationListenerSettings}
                  >
                    <Text style={styles.openSettingsButtonText}>
                      ⚙️ Open Notification Settings
                    </Text>
                  </TouchableOpacity>
                  {!nativeStatus.isConnected && nativeStatus.isPermissionGranted && (
                    <TouchableOpacity style={styles.rebindButton} onPress={handleRebind}>
                      <Text style={styles.rebindButtonText}>🔄 Rebind</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Android 13+ Restricted Settings Explanation */}
                <TouchableOpacity
                  style={styles.restrictedToggleBtn}
                  onPress={() => setShowRestrictedHelp(!showRestrictedHelp)}
                >
                  <Text style={styles.restrictedToggleText}>
                    {showRestrictedHelp ? '▲ Hide' : '▼'} Android 13+ "Restricted Settings" Help
                  </Text>
                </TouchableOpacity>

                {showRestrictedHelp && (
                  <View style={styles.restrictedHelpCard}>
                    <Text style={styles.restrictedHelpTitle}>
                      If Notification Access toggle is greyed out:
                    </Text>
                    <Text style={styles.restrictedHelpStep}>
                      1. Open phone <Text style={styles.boldText}>Settings → Apps → LifeOS</Text>.{'\n'}
                      2. Tap the three dots (<Text style={styles.boldText}>⋮</Text>) in the top-right corner.{'\n'}
                      3. Tap <Text style={styles.boldText}>"Allow restricted settings"</Text>.{'\n'}
                      4. Authenticate using your PIN / fingerprint.{'\n'}
                      5. Return here, open Notification Settings, and enable LifeOS.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Offline Parser Only Toggle */}
            <View style={styles.settingSection}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.sectionTitle}>Offline Parser Only</Text>
                  <Text style={styles.settingHelp}>
                    Force notification analysis to run exclusively through the offline rule-based parser. Never transmits content to external LLMs.
                  </Text>
                </View>
                <Switch
                  value={settings.offlineParserOnly}
                  onValueChange={handleToggleOfflineOnly}
                  trackColor={{ false: '#334155', true: '#0284c7' }}
                  thumbColor={settings.offlineParserOnly ? '#38bdf8' : '#94a3b8'}
                />
              </View>
            </View>

            {/* Application Allow-List */}
            <View style={styles.settingSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Application Allow-List</Text>
                <Text style={styles.badgeCount}>
                  {settings.allowedApps.length} allowed (default: 0)
                </Text>
              </View>
              <Text style={styles.settingHelp}>
                Notifications from apps NOT in this list are dropped immediately by Android before reaching storage. LifeOS self-notifications are permanently blocked to prevent loops.
              </Text>

              <View style={styles.appsList}>
                {KNOWN_APPS.map((app) => {
                  const allowed = isAppAllowed(app.packageName);
                  return (
                    <TouchableOpacity
                      key={app.packageName}
                      style={[styles.appItem, allowed && styles.appItemActive]}
                      onPress={() => handleToggleApp(app.packageName)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.appItemTextCol}>
                        <Text style={[styles.appItemLabel, allowed && styles.appItemLabelActive]}>
                          {app.label}
                        </Text>
                        <Text style={styles.appItemPkg}>{app.packageName}</Text>
                      </View>
                      <View style={[styles.checkbox, allowed && styles.checkboxActive]}>
                        {allowed && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Add Custom Package Name */}
              <View style={styles.customPkgBox}>
                <TextInput
                  style={styles.customPkgInput}
                  placeholder="Add custom package name (e.g. com.example.app)"
                  placeholderTextColor="#64748b"
                  value={customPackageInput}
                  onChangeText={setCustomPackageInput}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.addPkgButton}
                  onPress={handleAddCustomPackage}
                  disabled={!customPackageInput.trim()}
                >
                  <Text style={styles.addPkgButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Data Retention Period */}
            <View style={styles.settingSection}>
              <Text style={styles.sectionTitle}>Inbox Retention Period</Text>
              <Text style={styles.settingHelp}>
                Notifications older than this retention threshold are automatically deleted from local SQLite.
              </Text>
              <View style={styles.retentionRow}>
                {[3, 7, 14, 30].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.retentionChip,
                      settings.retentionDays === days && styles.retentionChipActive,
                    ]}
                    onPress={() => handleSelectRetention(days)}
                  >
                    <Text
                      style={[
                        styles.retentionChipText,
                        settings.retentionDays === days && styles.retentionChipTextActive,
                      ]}
                    >
                      {days} Days
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Clear All Stored Notifications */}
            {onClearAllNotifications && (
              <View style={styles.settingSection}>
                <Text style={styles.sectionTitle}>Clear Local Notification Data</Text>
                <Text style={styles.settingHelp}>
                  Permanently wipe all captured and simulated notifications from SQLite.
                </Text>
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={() => {
                    Alert.alert(
                      'Clear Notification Inbox',
                      'Are you sure you want to delete all stored notifications? This action cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete All',
                          style: 'destructive',
                          onPress: () => onClearAllNotifications(),
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.clearAllButtonText}>🗑️ Clear All Stored Notifications</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Footer Done Button */}
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
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
    marginBottom: 12,
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
  scrollArea: {
    marginBottom: 10,
  },
  privacyCard: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: 14,
  },
  privacyCardTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  privacyCardText: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '700',
    color: '#f8fafc',
  },
  settingSection: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 10,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeCount: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  settingHelp: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
    marginBottom: 8,
  },
  permissionStatusBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  permissionLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  statusMetric: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statusMetricLabel: {
    color: '#64748b',
    fontSize: 10,
  },
  statusMetricValue: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  statusActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  openSettingsButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  openSettingsButtonText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  rebindButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  rebindButtonText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  restrictedToggleBtn: {
    paddingVertical: 4,
  },
  restrictedToggleText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '600',
  },
  restrictedHelpCard: {
    backgroundColor: '#020617',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  restrictedHelpTitle: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  restrictedHelpStep: {
    color: '#cbd5e1',
    fontSize: 10,
    lineHeight: 15,
  },
  appsList: {
    gap: 6,
    marginTop: 6,
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#020617',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  appItemActive: {
    borderColor: '#0284c7',
    backgroundColor: '#0c1b2e',
  },
  appItemTextCol: {
    flex: 1,
  },
  appItemLabel: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  appItemLabelActive: {
    color: '#38bdf8',
  },
  appItemPkg: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  checkboxActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  checkMark: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  customPkgBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  customPkgInput: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#f8fafc',
    fontSize: 11,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addPkgButton: {
    backgroundColor: '#1e293b',
    borderRadius: 6,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  addPkgButtonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  retentionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  retentionChip: {
    flex: 1,
    backgroundColor: '#020617',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  retentionChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  retentionChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  retentionChipTextActive: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  clearAllButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
    marginTop: 4,
  },
  clearAllButtonText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
  },
  doneButton: {
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  doneButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
});
