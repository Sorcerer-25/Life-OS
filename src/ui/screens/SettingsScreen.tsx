import React, { useEffect, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { CalendarAdapter } from '../../calendar/calendarAdapter';
import {
  formatCalendarSourceDescription,
  getCalendarPreferences,
  listWritableCalendars,
  setSelectedCalendarId,
} from '../../calendar/calendarSettings';
import { ExpoCalendarAdapter } from '../../calendar/expoCalendarAdapter';
import {
  CalendarInfo,
  CalendarPermissionResponse,
  CalendarPreferences,
} from '../../calendar/types';
import {
  getNativeListenerStatus,
  NativeListenerStatus,
  openNotificationListenerSettings,
  requestRebindListener,
  syncSettingsToNative,
} from '../../notifications/nativeNotificationListener';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import {
  addAppToAllowList,
  getNotificationSettings,
  isAppAllowed,
  KNOWN_APPS,
  NotificationSettings,
  removeAppFromAllowList,
  updateNotificationSettings,
} from '../../notifications/notificationSettings';
import { ThemeMode, useTheme } from '../theme';
import { VoiceLanguage, VoiceService } from '../../voice/voiceService';
import { BottomSheet } from '../components/core/BottomSheet';
import { ConfirmationDialog } from '../components/core/ConfirmationDialog';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { SecondaryButton } from '../components/core/SecondaryButton';
import { SectionHeader } from '../components/core/SectionHeader';
import { StatusBadge } from '../components/core/StatusBadge';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const defaultAdapter = new ExpoCalendarAdapter();
const voiceService = new VoiceService();

interface SettingsScreenProps {
  processor?: NotificationProcessor;
  adapter?: CalendarAdapter;
  onClearAllData?: () => Promise<void>;
  onClose?: () => void;
  isModal?: boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  processor,
  adapter = defaultAdapter,
  onClearAllData,
  onClose,
  isModal = false,
}) => {
  const { theme, mode, setMode, toggleTheme } = useTheme();

  // 1. Notification Settings & Listener State
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [nativeStatus, setNativeStatus] = useState<NativeListenerStatus>({
    isPermissionGranted: false,
    isConnected: false,
    captureEnabled: false,
    queueSize: 0,
  });
  const [customPackageInput, setCustomPackageInput] = useState<string>('');
  const [showRestrictedHelp, setShowRestrictedHelp] = useState<boolean>(false);

  // 2. Calendar Settings & Destination
  const [calPermission, setCalPermission] = useState<CalendarPermissionResponse | null>(null);
  const [writableCalendars, setWritableCalendars] = useState<CalendarInfo[]>([]);
  const [calPreferences, setCalPreferences] = useState<CalendarPreferences | null>(null);
  const [showCalendarPicker, setShowCalendarPicker] = useState<boolean>(false);

  // 3. Voice Settings
  const [selectedVoiceLanguage, setSelectedVoiceLanguage] = useState<VoiceLanguage>('en-IN');
  const [isVoiceModuleAvailable, setIsVoiceModuleAvailable] = useState<boolean>(voiceService.isAvailable());
  const [voicePermission, setVoicePermission] = useState<string>('checking');

  // Confirmation dialog state for data wipe
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isClearingData, setIsClearingData] = useState<boolean>(false);

  const loadAllSettings = async () => {
    // Notification state
    const currentNotif = getNotificationSettings();
    setNotifSettings(currentNotif);
    try {
      const status = await getNativeListenerStatus();
      setNativeStatus(status);
    } catch {
      // ignore
    }

    // Calendar state
    try {
      const perm = await adapter.getPermissionsAsync();
      setCalPermission(perm);
      const prefs = await getCalendarPreferences();
      setCalPreferences(prefs);
      if (perm.granted) {
        const cals = await listWritableCalendars(adapter);
        setWritableCalendars(cals);
      }
    } catch {
      // ignore
    }

    // Voice state
    try {
      setIsVoiceModuleAvailable(voiceService.isAvailable());
      const vPerm = await voiceService.getPermissionsAsync();
      setVoicePermission(vPerm.granted ? 'granted' : vPerm.canAskAgain ? 'denied' : 'permanently_denied');
    } catch {
      setVoicePermission('unknown');
    }
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  // --- Notification Handlers ---
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
              setNotifSettings(updated);
              await syncSettingsToNative(true, updated.allowedApps);
              await openNotificationListenerSettings();
              await loadAllSettings();
            },
          },
        ]
      );
      return;
    }

    const updated = updateNotificationSettings({ captureEnabled: val });
    setNotifSettings(updated);
    await syncSettingsToNative(val, updated.allowedApps);
    await loadAllSettings();
  };

  const handleToggleApp = async (packageName: string) => {
    if (isAppAllowed(packageName)) {
      removeAppFromAllowList(packageName);
    } else {
      addAppToAllowList(packageName);
    }
    const updated = getNotificationSettings();
    setNotifSettings(updated);
    await syncSettingsToNative(updated.captureEnabled, updated.allowedApps);
  };

  const handleAddCustomPackage = async () => {
    const trimmed = customPackageInput.trim();
    if (!trimmed) return;
    addAppToAllowList(trimmed);
    setCustomPackageInput('');
    const updated = getNotificationSettings();
    setNotifSettings(updated);
    await syncSettingsToNative(updated.captureEnabled, updated.allowedApps);
  };

  const handleRemoveCustomPackage = async (packageName: string) => {
    removeAppFromAllowList(packageName);
    const updated = getNotificationSettings();
    setNotifSettings(updated);
    await syncSettingsToNative(updated.captureEnabled, updated.allowedApps);
  };

  const handleSelectRetention = (days: number) => {
    updateNotificationSettings({ retentionDays: days });
    setNotifSettings(getNotificationSettings());
  };

  const handleToggleOfflineOnly = (val: boolean) => {
    updateNotificationSettings({ offlineParserOnly: val });
    setNotifSettings(getNotificationSettings());
  };

  const handleRebindListener = async () => {
    await requestRebindListener();
    await loadAllSettings();
    Alert.alert('Rebind Signal Sent', 'Requested Android OS to reconnect the LifeOS NotificationListenerService.');
  };

  // --- Calendar Handlers ---
  const handleRequestCalendarPermission = async () => {
    try {
      const res = await adapter.requestPermissionsAsync();
      setCalPermission(res);
      if (res.granted) {
        const cals = await listWritableCalendars(adapter);
        setWritableCalendars(cals);
      }
    } catch (err: any) {
      Alert.alert('Permission Error', err?.message || 'Failed to request calendar permission.');
    }
  };

  const handleSelectDestinationCalendar = async (calId: string) => {
    await setSelectedCalendarId(calId);
    if (calPreferences) {
      setCalPreferences({ ...calPreferences, selectedCalendarId: calId });
    }
    setShowCalendarPicker(false);
  };

  // --- Voice Handlers ---
  const handleRequestVoicePermission = async () => {
    try {
      const res = await voiceService.requestPermissionsAsync();
      setVoicePermission(res.granted ? 'granted' : 'denied');
      if (!res.granted && !res.canAskAgain) {
        Alert.alert(
          'Microphone Permission Denied',
          'Please enable microphone access in your Android device settings to use voice input.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => voiceService.openSettingsAsync() },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'Unable to request microphone permission.');
    }
  };

  // --- Clear Data Handler ---
  const handleConfirmClearData = async () => {
    setIsClearingData(true);
    try {
      if (onClearAllData) {
        await onClearAllData();
      } else if (processor) {
        await processor.getRepository().clearAll();
      }
      Alert.alert('Data Reset', 'All notification history and cached items have been cleared.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to clear data.');
    } finally {
      setIsClearingData(false);
      setShowClearConfirm(false);
    }
  };

  const currentCalendarName = (() => {
    if (!calPreferences?.selectedCalendarId) {
      const primary = writableCalendars.find((c) => c.isPrimary);
      return primary ? `${primary.title} (Primary Default)` : 'Auto (Device Primary)';
    }
    const found = writableCalendars.find((c) => c.id === calPreferences.selectedCalendarId);
    return found ? `${found.title} (${found.accountName})` : `Calendar #${calPreferences.selectedCalendarId}`;
  })();

  return (
    <ScreenContainer testID="settings-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[theme.typography.titleLarge, { color: theme.colors.textPrimary }]}>
            Settings
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            System configuration, privacy boundaries & integrations
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

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ========================================================
            1. APPEARANCE
        ======================================================== */}
        <View style={styles.section}>
          <SectionHeader title="Appearance" />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
              theme.shadows.sm,
            ]}
          >
            <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
              Theme Mode
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
              Choose your preferred visual theme. Persisted locally in SQLite.
            </Text>

            <View style={styles.themeSelectorRow}>
              {(
                [
                  { mode: 'system' as ThemeMode, label: 'System Default', icon: '📱' },
                  { mode: 'light' as ThemeMode, label: 'Light', icon: '☀️' },
                  { mode: 'dark' as ThemeMode, label: 'Dark', icon: '🌙' },
                ] as const
              ).map((item) => {
                const isSelected = mode === item.mode;
                return (
                  <TouchableOpacity
                    key={item.mode}
                    style={[
                      styles.themeOptionBtn,
                      {
                        backgroundColor: isSelected ? theme.colors.primaryLight : theme.colors.surface,
                        borderColor: isSelected ? theme.colors.primaryLight : theme.colors.border,
                        borderRadius: theme.radii.sm,
                      },
                    ]}
                    onPress={() => setMode(item.mode)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.themeOptionIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.themeOptionLabel,
                        {
                          color: isSelected ? theme.colors.primaryDark : theme.colors.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ========================================================
            2. VOICE & SPEECH INPUT
        ======================================================== */}
        <View style={styles.section}>
          <SectionHeader title="Voice Recognition" />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
              theme.shadows.sm,
            ]}
          >
            <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
              Voice Recognition Language
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
              Configured speech model locale for transcription accuracy.
            </Text>

            <View style={styles.voiceLangRow}>
              {(
                [
                  { code: 'en-IN' as VoiceLanguage, label: 'English (India - en-IN)', flag: '🇮🇳' },
                  { code: 'en-US' as VoiceLanguage, label: 'English (US - en-US)', flag: '🇺🇸' },
                ] as const
              ).map((lang) => {
                const isSelected = selectedVoiceLanguage === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.voiceLangBtn,
                      {
                        backgroundColor: isSelected ? theme.colors.primaryLight : theme.colors.surface,
                        borderColor: isSelected ? theme.colors.primaryLight : theme.colors.border,
                        borderRadius: theme.radii.sm,
                      },
                    ]}
                    onPress={() => setSelectedVoiceLanguage(lang.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 16 }}>{lang.flag}</Text>
                    <Text
                      style={[
                        styles.voiceLangLabel,
                        {
                          color: isSelected ? theme.colors.primaryDark : theme.colors.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Voice Module Diagnostic Status */}
            <View
              style={[
                styles.diagnosticBox,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle, borderRadius: theme.radii.sm },
              ]}
            >
              <View style={styles.diagnosticRow}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Speech Recognition Engine:
                </Text>
                <StatusBadge
                  status={isVoiceModuleAvailable ? 'active' : 'info'}
                  label={isVoiceModuleAvailable ? 'Native Linked' : 'Expo Go (Simulation)'}
                  size="sm"
                />
              </View>

              <View style={[styles.diagnosticRow, { marginTop: 6 }]}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Microphone Permission:
                </Text>
                <StatusBadge
                  status={voicePermission === 'granted' ? 'active' : 'warning'}
                  label={voicePermission === 'granted' ? 'Granted' : 'Not Granted'}
                  size="sm"
                />
              </View>

              {voicePermission !== 'granted' && (
                <TouchableOpacity style={{ marginTop: 8 }} onPress={handleRequestVoicePermission}>
                  <Text style={[theme.typography.caption, { color: theme.colors.primaryLight, fontWeight: '700' }]}>
                    Request Microphone Permission →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ========================================================
            3. NOTIFICATION INTELLIGENCE & CAPTURE
        ======================================================== */}
        <View style={styles.section}>
          <SectionHeader title="Notification Intelligence" />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
              theme.shadows.sm,
            ]}
          >
            {/* Master Capture Switch */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                  Real Notification Capture
                </Text>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                  Capture incoming alerts from allow-listed apps into the offline inbox (Default: OFF).
                </Text>
              </View>
              <Switch
                value={notifSettings.captureEnabled}
                onValueChange={handleToggleCapture}
                trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
                thumbColor={notifSettings.captureEnabled ? theme.colors.primaryDark : theme.colors.textTertiary}
              />
            </View>

            {/* Listener Service Status Box */}
            <View
              style={[
                styles.diagnosticBox,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle, borderRadius: theme.radii.sm },
              ]}
            >
              <View style={styles.diagnosticRow}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Android Access Permission:
                </Text>
                <StatusBadge
                  status={nativeStatus.isPermissionGranted ? 'active' : 'warning'}
                  label={nativeStatus.isPermissionGranted ? 'Granted' : 'Not Granted'}
                  size="sm"
                />
              </View>

              <View style={[styles.diagnosticRow, { marginTop: 6 }]}>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  NotificationListenerService:
                </Text>
                <StatusBadge
                  status={nativeStatus.isConnected ? 'active' : 'secondary'}
                  label={nativeStatus.isConnected ? 'Connected' : 'Disconnected'}
                  size="sm"
                />
              </View>

              <View style={[styles.actionButtonsRow, { marginTop: 10 }]}>
                <TouchableOpacity
                  style={[styles.smallActionBtn, { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border }]}
                  onPress={openNotificationListenerSettings}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.smallActionBtnText, { color: theme.colors.textPrimary }]}>
                    Open System Access
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallActionBtn, { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border }]}
                  onPress={handleRebindListener}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.smallActionBtnText, { color: theme.colors.primaryLight }]}>
                    Rebind Service
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Android 13+ Restricted Settings Help Banner */}
            <TouchableOpacity
              style={[
                styles.restrictedToggle,
                { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border, borderRadius: theme.radii.sm },
              ]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowRestrictedHelp(!showRestrictedHelp);
              }}
              activeOpacity={0.7}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.warning, fontWeight: '700' }]}>
                ⚠️ Android 13+ Restricted Settings Guidance {showRestrictedHelp ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {showRestrictedHelp && (
              <View
                style={[
                  styles.restrictedContent,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle },
                ]}
              >
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, lineHeight: 18 }]}>
                  On Android 13+, sideloaded APKs have Notification Access greyed out by default.{'\n'}
                  1. Open Android Settings → Apps → LifeOS.{'\n'}
                  2. Tap the 3 dots in the top right corner.{'\n'}
                  3. Tap <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>Allow restricted settings</Text>.{'\n'}
                  4. Return here and tap "Open System Access".
                </Text>
              </View>
            )}

            {/* Offline-Only Parser Switch */}
            <View style={[styles.switchRow, { marginTop: 14 }]}>
              <View style={styles.switchTextContainer}>
                <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                  Offline Parser Only
                </Text>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                  Guarantees notification text is never transmitted outside your phone.
                </Text>
              </View>
              <Switch
                value={notifSettings.offlineParserOnly}
                onValueChange={handleToggleOfflineOnly}
                trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
                thumbColor={notifSettings.offlineParserOnly ? theme.colors.primaryDark : theme.colors.textTertiary}
              />
            </View>

            {/* Retention Policy */}
            <View style={{ marginTop: 14 }}>
              <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                Data Retention Period
              </Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                Automatically clean up notifications older than:
              </Text>
              <View style={styles.retentionRow}>
                {[3, 7, 14, 30].map((days) => {
                  const isSelected = notifSettings.retentionDays === days;
                  return (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.retentionChip,
                        {
                          backgroundColor: isSelected ? theme.colors.primaryLight : theme.colors.surface,
                          borderColor: isSelected ? theme.colors.primaryLight : theme.colors.border,
                          borderRadius: theme.radii.pill,
                        },
                      ]}
                      onPress={() => handleSelectRetention(days)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.retentionChipText,
                          {
                            color: isSelected ? theme.colors.primaryDark : theme.colors.textPrimary,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {days} Days
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Allowed Apps Management */}
            <View style={{ marginTop: 16 }}>
              <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                Allowed Apps ({notifSettings.allowedApps.length} active)
              </Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                Only notifications from enabled apps will be captured.
              </Text>

              <View style={styles.knownAppsList}>
                {KNOWN_APPS.map((app) => {
                  const allowed = isAppAllowed(app.packageName);
                  return (
                    <TouchableOpacity
                      key={app.packageName}
                      style={[
                        styles.knownAppItem,
                        {
                          backgroundColor: allowed ? theme.colors.surfaceSubtle : theme.colors.surface,
                          borderColor: theme.colors.borderSubtle,
                          borderRadius: theme.radii.sm,
                        },
                      ]}
                      onPress={() => handleToggleApp(app.packageName)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                          {app.label}
                        </Text>
                        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                          {app.packageName}
                        </Text>
                      </View>
                      <Switch
                        value={allowed}
                        onValueChange={() => handleToggleApp(app.packageName)}
                        trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
                        thumbColor={allowed ? theme.colors.primaryDark : theme.colors.textTertiary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Add Custom App Package Input */}
              <View style={styles.customAppRow}>
                <TextInput
                  style={[
                    styles.customAppInput,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      color: theme.colors.textPrimary,
                      borderRadius: theme.radii.sm,
                    },
                  ]}
                  placeholder="e.g. com.example.customapp"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={customPackageInput}
                  onChangeText={setCustomPackageInput}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[
                    styles.addAppBtn,
                    { backgroundColor: theme.colors.primaryLight, borderRadius: theme.radii.sm },
                  ]}
                  onPress={handleAddCustomPackage}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.addAppBtnText, { color: theme.colors.primaryDark }]}>
                    Add
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Custom Allow List Badges */}
              {notifSettings.allowedApps.length > 0 && (
                <View style={styles.allowedBadgesWrap}>
                  {notifSettings.allowedApps.map((pkg) => (
                    <View
                      key={pkg}
                      style={[
                        styles.allowedChip,
                        { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border },
                      ]}
                    >
                      <Text style={[styles.allowedChipText, { color: theme.colors.textPrimary }]}>
                        {pkg}
                      </Text>
                      <TouchableOpacity onPress={() => handleRemoveCustomPackage(pkg)}>
                        <Text style={[styles.removeAppX, { color: theme.colors.error }]}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ========================================================
            4. CALENDAR & SCHEDULING
        ======================================================== */}
        <View style={styles.section}>
          <SectionHeader title="Calendar & Scheduling" />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
              theme.shadows.sm,
            ]}
          >
            <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
              Target Destination Calendar
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
              Current: <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>{currentCalendarName}</Text>
            </Text>

            <View style={{ marginTop: 10 }}>
              <SecondaryButton
                label={calPermission?.granted ? 'Change Destination Calendar' : 'Grant Calendar Permission'}
                onPress={() => {
                  if (calPermission?.granted) {
                    setShowCalendarPicker(true);
                  } else {
                    handleRequestCalendarPermission();
                  }
                }}
              />
            </View>

            {/* Sync Behavior Transparency */}
            <View
              style={[
                styles.diagnosticBox,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle, borderRadius: theme.radii.sm, marginTop: 12 },
              ]}
            >
              <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
                📅 Native Provider Write & Cloud Sync
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 }]}>
                • Events created through LifeOS are written directly into Android's native <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>CalendarProvider</Text>.{'\n'}
                • Cloud sync to Google Calendar or Outlook is handled natively by your Android system account sync.{'\n'}
                • LifeOS attaches a 15-minute advance reminder alarm to each scheduled event.
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================
            5. PRIVACY & SECURITY GUARANTEES
        ======================================================== */}
        <View style={styles.section}>
          <SectionHeader title="Privacy & Safety Boundaries" />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
              theme.shadows.sm,
            ]}
          >
            <Text style={[theme.typography.titleSmall, { color: theme.colors.success }]}>
              🛡️ 100% On-Device Processing
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 4, lineHeight: 20 }]}>
              LifeOS does not connect to external LLMs or third-party servers. Intent classification, slot extraction, supervisor orchestration, and notification sanitization run completely on-device.
            </Text>

            <View style={{ height: 1, backgroundColor: theme.colors.borderSubtle, marginVertical: 10 }} />

            <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
              💳 Financial Safety & Human Approval Gate
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 4, lineHeight: 20 }]}>
              Actions parsed from financial notifications (UPI, cards, bank transfers) are masked and strictly require explicit human approval. LifeOS will never auto-execute or initiate money movement.
            </Text>
          </View>
        </View>

        {/* ========================================================
            6. DATA MANAGEMENT & RESET
        ======================================================== */}
        <View style={styles.section}>
          <SectionHeader title="Data Management" />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
              theme.shadows.sm,
            ]}
          >
            <Text style={[theme.typography.titleSmall, { color: theme.colors.error }]}>
              Reset Local Notification Cache
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
              Purges all stored notification items from the local SQLite database. Does not delete calendar events already scheduled in Android Calendar.
            </Text>

            <View style={{ marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.dangerBtn, { backgroundColor: theme.colors.error, borderRadius: theme.radii.sm }]}
                onPress={() => setShowClearConfirm(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.dangerBtnText}>Clear All Notification Data</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ========================================================
            7. ABOUT LIFEOS
        ======================================================== */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <SectionHeader title="About LifeOS" />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.md },
              theme.shadows.sm,
            ]}
          >
            <Text style={[theme.typography.titleMedium, { color: theme.colors.textPrimary }]}>
              LifeOS Mobile Orchestrator
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginTop: 2 }]}>
              Version 1.0.0 • Final Year Project Demo
            </Text>

            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 8, lineHeight: 18 }]}>
              Architecture: Deterministic Rule-Based Parsing + Slot Extraction + SQLite Mapping Repository + Expo Native Modules.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Destination Calendar Picker BottomSheet */}
      <BottomSheet
        visible={showCalendarPicker}
        onClose={() => setShowCalendarPicker(false)}
        title="Select Destination Calendar"
        subtitle="Events will be created in the selected calendar account"
      >
        <ScrollView style={{ maxHeight: 360 }}>
          {writableCalendars.map((cal) => {
            const isSelected =
              cal.id === calPreferences?.selectedCalendarId ||
              (!calPreferences?.selectedCalendarId && cal.isPrimary);
            return (
              <TouchableOpacity
                key={cal.id}
                style={[
                  styles.calendarOptionItem,
                  {
                    backgroundColor: isSelected ? theme.colors.surfaceSubtle : theme.colors.surface,
                    borderColor: isSelected ? theme.colors.primaryLight : theme.colors.border,
                    borderRadius: theme.radii.sm,
                  },
                ]}
                onPress={() => handleSelectDestinationCalendar(cal.id)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                    {cal.title} {cal.isPrimary ? '★ (Primary)' : ''}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                    {formatCalendarSourceDescription(cal)}
                  </Text>
                </View>
                {isSelected && (
                  <StatusBadge status="active" label="Selected" size="sm" />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {/* Confirmation Dialog for Clearing Data */}
      <ConfirmationDialog
        visible={showClearConfirm}
        title="Clear All Notification Data?"
        message="This will permanently delete all processed and pending notifications stored in the local SQLite inbox. This cannot be undone."
        confirmLabel="Clear Data"
        cancelLabel="Cancel"
        isDestructive
        isLoading={isClearingData}
        onConfirm={handleConfirmClearData}
        onCancel={() => setShowClearConfirm(false)}
      />
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 14,
  },
  card: {
    borderWidth: 1,
    padding: 14,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  themeOptionBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeOptionIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  themeOptionLabel: {
    fontSize: 11,
  },
  voiceLangRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  voiceLangBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingVertical: 10,
    gap: 6,
  },
  voiceLangLabel: {
    fontSize: 11,
  },
  diagnosticBox: {
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallActionBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 4,
  },
  smallActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  restrictedToggle: {
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  restrictedContent: {
    marginTop: 6,
    padding: 10,
    borderWidth: 1,
    borderRadius: 4,
  },
  retentionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  retentionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  retentionChipText: {
    fontSize: 11,
  },
  knownAppsList: {
    marginTop: 8,
    gap: 6,
  },
  knownAppItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
  },
  customAppRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  customAppInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 12,
  },
  addAppBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAppBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  allowedBadgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  allowedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  allowedChipText: {
    fontSize: 11,
  },
  removeAppX: {
    fontSize: 11,
    fontWeight: '700',
  },
  calendarOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  dangerBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
