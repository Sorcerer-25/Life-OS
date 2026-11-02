import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarAdapter } from '../../calendar/calendarAdapter';
import {
  formatCalendarSourceDescription,
  getCalendarPreferences,
  listWritableCalendars,
  setSelectedCalendarId,
  updateCalendarPreferences,
} from '../../calendar/calendarSettings';
import { ExpoCalendarAdapter } from '../../calendar/expoCalendarAdapter';
import {
  CalendarInfo,
  CalendarPermissionResponse,
  CalendarPreferences,
} from '../../calendar/types';

interface CalendarSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  adapter?: CalendarAdapter;
}

const defaultAdapter = new ExpoCalendarAdapter();

export const CalendarSettingsModal: React.FC<CalendarSettingsModalProps> = ({
  visible,
  onClose,
  adapter = defaultAdapter,
}) => {
  const [permission, setPermission] = useState<CalendarPermissionResponse | null>(null);
  const [writableCalendars, setWritableCalendars] = useState<CalendarInfo[]>([]);
  const [preferences, setPreferences] = useState<CalendarPreferences | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const perm = await adapter.getPermissionsAsync();
      setPermission(perm);

      const prefs = await getCalendarPreferences();
      setPreferences(prefs);

      if (perm.granted) {
        const cals = await listWritableCalendars(adapter);
        setWritableCalendars(cals);

        // If no calendar is selected, auto-select first or primary
        if (!prefs.selectedCalendarId && cals.length > 0) {
          const primary = cals.find((c) => c.isPrimary) || cals[0];
          await setSelectedCalendarId(primary.id);
          setPreferences({ ...prefs, selectedCalendarId: primary.id });
        }
      }
    } catch (err) {
      console.warn('Failed to load calendar settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const handleRequestPermission = async () => {
    const res = await adapter.requestPermissionsAsync();
    setPermission(res);
    if (res.granted) {
      const cals = await listWritableCalendars(adapter);
      setWritableCalendars(cals);
    }
  };

  const handleSelectCalendar = async (calId: string) => {
    await setSelectedCalendarId(calId);
    if (preferences) {
      setPreferences({ ...preferences, selectedCalendarId: calId });
    }
  };

  const handleToggleTaskSync = async (val: boolean) => {
    const updated = await updateCalendarPreferences({ createCalendarEventForTasks: val });
    setPreferences(updated);
  };

  const handleToggleAlarms = async (val: boolean) => {
    const updated = await updateCalendarPreferences({ enableCalendarAlarms: val });
    setPreferences(updated);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.headerRow}>
            <Text style={styles.modalTitle}>📅 Calendar Settings</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {/* 1. Permission Status */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Android Calendar Permission</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Permission Status:</Text>
                <View
                  style={[
                    styles.statusBadge,
                    permission?.granted
                      ? styles.badgeGranted
                      : permission?.status === 'denied_permanently'
                      ? styles.badgeDeniedPerm
                      : styles.badgeDenied,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {permission?.granted
                      ? '✓ GRANTED'
                      : permission?.status === 'denied_permanently'
                      ? '🚫 PERMANENTLY DENIED'
                      : '⚠️ NOT GRANTED'}
                  </Text>
                </View>
              </View>

              {!permission?.granted && (
                <View style={styles.permActionBox}>
                  <Text style={styles.permNoticeText}>
                    LifeOS needs native calendar access to schedule events in your device's calendar.
                  </Text>
                  {permission?.status === 'denied_permanently' ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => adapter.openSettingsAsync()}
                    >
                      <Text style={styles.actionBtnText}>⚙️ Open System Settings</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.actionBtn} onPress={handleRequestPermission}>
                      <Text style={styles.actionBtnText}>Request Permission</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* 2. Destination Calendar Selection */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Destination Calendar</Text>
              <Text style={styles.subtext}>
                Select which writable calendar LifeOS should insert scheduled events into:
              </Text>

              {loading ? (
                <Text style={styles.emptyText}>Loading calendars...</Text>
              ) : writableCalendars.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    {permission?.granted
                      ? 'No writable calendars found on this device.'
                      : 'Grant calendar permissions above to list available calendars.'}
                  </Text>
                </View>
              ) : (
                writableCalendars.map((cal) => {
                  const isSelected = preferences?.selectedCalendarId === cal.id;
                  return (
                    <TouchableOpacity
                      key={cal.id}
                      style={[styles.calendarItem, isSelected && styles.calendarItemSelected]}
                      onPress={() => handleSelectCalendar(cal.id)}
                    >
                      <View style={styles.radioContainer}>
                        <View style={[styles.radioCircle, isSelected && styles.radioActive]} />
                      </View>
                      <View style={styles.calendarInfo}>
                        <View style={styles.row}>
                          <Text style={styles.calendarTitle}>{cal.title}</Text>
                          {cal.isPrimary && (
                            <View style={styles.primaryBadge}>
                              <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.calendarDesc}>
                          {formatCalendarSourceDescription(cal)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerTitle}>ℹ️ Google Sync Transparency:</Text>
                <Text style={styles.disclaimerText}>
                  Inserting into a Google calendar writes locally to Android's native CalendarProvider.
                  Actual cloud sync to Google Calendar on the web depends entirely on Android account
                  sync being active for that Google account on this device.
                </Text>
              </View>
            </View>

            {/* 3. Task & Reminder Integration Preferences */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Integration Preferences</Text>

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleLabel}>Create calendar event for tasks</Text>
                  <Text style={styles.toggleSubtext}>
                    When enabled, tasks with a due date & time also create a calendar event. Note:
                    Calendar events are not tasks and do not have completion states.
                  </Text>
                </View>
                <Switch
                  value={preferences?.createCalendarEventForTasks ?? false}
                  onValueChange={handleToggleTaskSync}
                  trackColor={{ false: '#334155', true: '#3b82f6' }}
                  thumbColor="#ffffff"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.toggleRow}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleLabel}>Add calendar event alarm (15m before)</Text>
                  <Text style={styles.toggleSubtext}>
                    Default is OFF to avoid duplicate phone notifications with the existing Reminder
                    Agent.
                  </Text>
                </View>
                <Switch
                  value={preferences?.enableCalendarAlarms ?? false}
                  onValueChange={handleToggleAlarms}
                  trackColor={{ false: '#334155', true: '#3b82f6' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollBody: {
    maxHeight: 560,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtext: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeGranted: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  badgeDenied: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderWidth: 1,
    borderColor: '#eab308',
  },
  badgeDeniedPerm: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  statusBadgeText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  permActionBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 10,
  },
  permNoticeText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  actionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  calendarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  calendarItemSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  radioContainer: {
    marginRight: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748b',
  },
  radioActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#38bdf8',
  },
  calendarInfo: {
    flex: 1,
  },
  calendarTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
  },
  calendarDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  emptyBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
  },
  disclaimerBox: {
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  disclaimerTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  disclaimerText: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSubtext: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
});

