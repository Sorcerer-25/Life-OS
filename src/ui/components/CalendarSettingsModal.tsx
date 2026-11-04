import React, { useEffect, useState } from 'react';
import {
  Modal,
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
import { useTheme } from '../theme';
import { BottomSheet } from './core/BottomSheet';
import { LoadingState } from './core/LoadingState';
import { PrimaryButton } from './core/PrimaryButton';
import { StatusBadge } from './core/StatusBadge';

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
  const { theme } = useTheme();

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
    <BottomSheet
      visible={visible}
      title="Calendar Settings"
      subtitle="Native Android CalendarProvider preferences"
      onClose={onClose}
    >
      <View style={{ gap: theme.spacing.lg }}>
        {/* 1. Android Permission Status Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
            },
          ]}
        >
          <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
            Android Calendar Permission
          </Text>

          <View style={[styles.rowBetween, { marginTop: theme.spacing.sm }]}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              Permission Status:
            </Text>
            <StatusBadge
              status={
                permission?.granted
                  ? 'in_provider'
                  : permission?.status === 'denied_permanently'
                  ? 'blocked'
                  : 'warning'
              }
              label={
                permission?.granted
                  ? '✓ GRANTED'
                  : permission?.status === 'denied_permanently'
                  ? 'PERMANENTLY DENIED'
                  : 'NOT GRANTED'
              }
              size="sm"
            />
          </View>

          {!permission?.granted && (
            <View style={{ marginTop: theme.spacing.md }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
                LifeOS schedules events directly in your Android system calendar.
              </Text>
              {permission?.status === 'denied_permanently' ? (
                <PrimaryButton
                  label="Open Phone Settings"
                  icon="⚙️"
                  onPress={() => adapter.openSettingsAsync()}
                  size="sm"
                />
              ) : (
                <PrimaryButton
                  label="Grant Calendar Permission"
                  icon="✓"
                  onPress={handleRequestPermission}
                  size="sm"
                />
              )}
            </View>
          )}
        </View>

        {/* 2. Destination Calendar Selection */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
            },
          ]}
        >
          <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
            Destination Calendar
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2, marginBottom: 10 }]}>
            Select which writable calendar LifeOS should insert scheduled events into:
          </Text>

          {loading ? (
            <LoadingState message="Loading calendars..." />
          ) : writableCalendars.length === 0 ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontStyle: 'italic' }]}>
              {permission?.granted
                ? 'No writable calendars found on this device.'
                : 'Grant calendar permission above to list available calendars.'}
            </Text>
          ) : (
            writableCalendars.map((cal) => {
              const isSelected = preferences?.selectedCalendarId === cal.id;
              return (
                <TouchableOpacity
                  key={cal.id}
                  style={[
                    styles.calItem,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primaryMuted
                        : theme.colors.surfaceSubtle,
                      borderColor: isSelected ? theme.colors.primaryLight : theme.colors.border,
                      borderRadius: theme.radii.sm,
                      padding: theme.spacing.sm,
                    },
                  ]}
                  onPress={() => handleSelectCalendar(cal.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.calRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                          {cal.title}
                        </Text>
                        {cal.isPrimary && (
                          <View
                            style={[
                              styles.primaryBadge,
                              { backgroundColor: theme.colors.primaryLight },
                            ]}
                          >
                            <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                        {formatCalendarSourceDescription(cal)}
                      </Text>
                    </View>

                    <Text style={{ fontSize: 16 }}>{isSelected ? '🔘' : '⚪'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* Google Sync Transparency Box */}
          <View
            style={[
              styles.disclaimer,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.xs,
                padding: theme.spacing.sm,
                marginTop: theme.spacing.sm,
              },
            ]}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.infoForeground, fontWeight: '700' }]}>
              ℹ️ Google Account Sync Notice:
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2, lineHeight: 15 }]}>
              Writes directly to Android native CalendarProvider. Google Calendar cloud sync depends on Android account sync being active for that Google account on this device.
            </Text>
          </View>
        </View>

        {/* 3. Integration Preferences */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
            },
          ]}
        >
          <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
            Integration Preferences
          </Text>

          <View style={[styles.toggleRow, { marginTop: theme.spacing.md }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                Create calendar event for tasks
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 1 }]}>
                When enabled, tasks with a due date & time also create a calendar event.
              </Text>
            </View>
            <Switch
              value={preferences?.createCalendarEventForTasks ?? false}
              onValueChange={handleToggleTaskSync}
              trackColor={{ false: theme.colors.border, true: theme.colors.primaryDark }}
              thumbColor={preferences?.createCalendarEventForTasks ? theme.colors.primaryLight : theme.colors.textMuted}
            />
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: theme.colors.divider, marginVertical: theme.spacing.md },
            ]}
          />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                Add calendar event alarm (15m before)
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 1 }]}>
                Default is OFF to avoid duplicate phone notifications with Reminder Agent.
              </Text>
            </View>
            <Switch
              value={preferences?.enableCalendarAlarms ?? false}
              onValueChange={handleToggleAlarms}
              trackColor={{ false: theme.colors.border, true: theme.colors.primaryDark }}
              thumbColor={preferences?.enableCalendarAlarms ? theme.colors.primaryLight : theme.colors.textMuted}
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calItem: {
    borderWidth: 1,
    marginVertical: 3,
  },
  calRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  primaryBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  disclaimer: {
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
  },
});
