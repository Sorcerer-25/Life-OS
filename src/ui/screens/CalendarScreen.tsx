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
import { CalendarAdapter } from '../../calendar/calendarAdapter';
import { CalendarAgent } from '../../calendar/calendarAgent';
import {
  formatCalendarSourceDescription,
  getCalendarPreferences,
  listWritableCalendars,
  setSelectedCalendarId,
} from '../../calendar/calendarSettings';
import { CalendarMappingRecord } from '../../calendar/mappingRepository';
import {
  CalendarEventRecord,
  CalendarInfo,
  CalendarPermissionResponse,
  CalendarPreferences,
} from '../../calendar/types';
import { ExpoCalendarAdapter } from '../../calendar/expoCalendarAdapter';
import { useTheme } from '../theme';
import { AppHeader } from '../components/core/AppHeader';
import { BottomSheet } from '../components/core/BottomSheet';
import { ConfirmationDialog } from '../components/core/ConfirmationDialog';
import { EmptyState } from '../components/core/EmptyState';
import { LoadingState } from '../components/core/LoadingState';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { SecondaryButton } from '../components/core/SecondaryButton';
import { SectionHeader } from '../components/core/SectionHeader';
import { StatusBadge } from '../components/core/StatusBadge';

const defaultAdapter = new ExpoCalendarAdapter();

interface CalendarScreenProps {
  calendarAgent: CalendarAgent;
  adapter?: CalendarAdapter;
  onOpenSettings?: () => void;
  onOpenInbox?: () => void;
  onNavigateToInput?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const CalendarScreen: React.FC<CalendarScreenProps> = ({
  calendarAgent,
  adapter = defaultAdapter,
  onOpenSettings,
  onOpenInbox,
  onNavigateToInput,
  onClose,
  isModal = false,
}) => {
  const { theme, toggleTheme } = useTheme();

  const [events, setEvents] = useState<
    Array<{ mapping: CalendarMappingRecord; event: CalendarEventRecord | null }>
  >([]);
  const [permission, setPermission] = useState<CalendarPermissionResponse | null>(null);
  const [writableCalendars, setWritableCalendars] = useState<CalendarInfo[]>([]);
  const [preferences, setPreferences] = useState<CalendarPreferences | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Edit event state (BottomSheet)
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editLocation, setEditLocation] = useState<string>('');

  // Delete event confirmation dialog
  const [itemToDelete, setItemToDelete] = useState<{ actionId: string; title: string } | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Show destination calendar selector toggle
  const [showCalendarSelector, setShowCalendarSelector] = useState<boolean>(false);

  const loadCalendarData = async () => {
    setIsLoading(true);
    try {
      // 1. Check permissions
      const perm = await adapter.getPermissionsAsync();
      setPermission(perm);

      // 2. Load preferences
      const prefs = await getCalendarPreferences();
      setPreferences(prefs);

      // 3. Load writable calendars
      if (perm.granted) {
        const cals = await listWritableCalendars(adapter);
        setWritableCalendars(cals);

        if (!prefs.selectedCalendarId && cals.length > 0) {
          const primary = cals.find((c) => c.isPrimary) || cals[0];
          await setSelectedCalendarId(primary.id);
          setPreferences({ ...prefs, selectedCalendarId: primary.id });
        }
      }

      // 4. Load events created by LifeOS
      const list = await calendarAgent.listCreatedEvents();
      setEvents(list);
    } catch (err) {
      console.warn('[CalendarScreen] Failed to load calendar data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, []);

  const handleRequestPermission = async () => {
    try {
      const res = await adapter.requestPermissionsAsync();
      setPermission(res);
      if (res.granted) {
        await loadCalendarData();
      }
    } catch (err: any) {
      Alert.alert('Permission Error', err?.message || 'Failed to request calendar permission');
    }
  };

  const handleSelectCalendar = async (calId: string) => {
    await setSelectedCalendarId(calId);
    if (preferences) {
      setPreferences({ ...preferences, selectedCalendarId: calId });
    }
  };

  const handleStartEdit = (actionId: string, event: CalendarEventRecord | null) => {
    setEditingActionId(actionId);
    setEditTitle(event?.title || '');
    setEditLocation(event?.location || '');
  };

  const handleSaveEdit = async () => {
    if (!editingActionId) return;

    const res = await calendarAgent.updateEvent(editingActionId, {
      title: editTitle.trim(),
      location: editLocation.trim() || undefined,
    });

    if (res.status === 'success') {
      Alert.alert('Updated', 'Calendar event updated successfully.');
      setEditingActionId(null);
      await loadCalendarData();
    } else {
      Alert.alert('Update Failed', res.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    try {
      const res = await calendarAgent.deleteEvent(itemToDelete.actionId);
      if (res.status === 'success') {
        Alert.alert('Deleted', 'Event deleted successfully from device calendar.');
      } else {
        Alert.alert('Delete Failed', res.message);
      }
      setItemToDelete(null);
      await loadCalendarData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete event.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter out permanently deleted events from agenda
  const activeEvents = events.filter((e) => e.mapping.status !== 'deleted');

  // Group agenda events by day
  const groupedEvents = activeEvents.reduce(
    (
      acc: Record<string, Array<{ mapping: CalendarMappingRecord; event: CalendarEventRecord | null }>>,
      item
    ) => {
      const eventDate = item.event
        ? new Date(item.event.startDate)
        : new Date(item.mapping.created_at);

      const todayStr = new Date().toISOString().split('T')[0];
      const itemDateStr = eventDate.toISOString().split('T')[0];

      let dayLabel = itemDateStr;
      if (itemDateStr === todayStr) {
        dayLabel = 'Today';
      } else {
        try {
          dayLabel = eventDate.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          });
        } catch {
          dayLabel = itemDateStr;
        }
      }

      if (!acc[dayLabel]) {
        acc[dayLabel] = [];
      }
      acc[dayLabel].push(item);
      return acc;
    },
    {}
  );

  const groupKeys = Object.keys(groupedEvents);

  return (
    <ScreenContainer testID="calendar-screen">
      {/* Header */}
      <AppHeader
        title="Calendar Agenda"
        subtitle="Android CalendarProvider • Verified on-device synchronization"
        showStatusIndicator
        statusLabel="Deterministic Engine"
        onToggleTheme={toggleTheme}
        onOpenInbox={onOpenInbox}
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

      {/* Permission-Denied Banner (if permission not granted) */}
      {!permission?.granted && (
        <View
          style={[
            styles.permCard,
            {
              backgroundColor: theme.colors.errorSurface,
              borderColor: theme.colors.errorBorder,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.md,
            },
          ]}
        >
          <Text style={[theme.typography.titleSmall, { color: theme.colors.errorForeground }]}>
            ⚠️ Android Calendar Access Required
          </Text>
          <Text
            style={[
              theme.typography.bodySmall,
              { color: theme.colors.textPrimary, marginTop: 4, lineHeight: 18 },
            ]}
          >
            LifeOS interacts with your Android device's native CalendarProvider. To view, create, and manage calendar events, please grant calendar access.
          </Text>

          <View style={{ marginTop: theme.spacing.sm, flexDirection: 'row', gap: 8 }}>
            {permission?.status === 'denied_permanently' ? (
              <PrimaryButton
                label="Open Phone Settings"
                icon="⚙️"
                onPress={() => adapter.openSettingsAsync()}
                size="sm"
              />
            ) : (
              <PrimaryButton
                label="Grant Calendar Access"
                icon="✓"
                onPress={handleRequestPermission}
                size="sm"
              />
            )}
          </View>
        </View>
      )}

      {/* Destination Calendar Selection Dropdown Card */}
      <View
        style={[
          styles.destinationCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.md,
          },
          theme.shadows.sm,
        ]}
      >
        <TouchableOpacity
          style={styles.destinationToggleRow}
          onPress={() => setShowCalendarSelector(!showCalendarSelector)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.label, { color: theme.colors.textTertiary }]}>
              TARGET DEVICE CALENDAR
            </Text>
            <Text
              style={[
                theme.typography.titleSmall,
                { color: theme.colors.textPrimary, marginTop: 2 },
              ]}
              numberOfLines={1}
            >
              {writableCalendars.find((c) => c.id === preferences?.selectedCalendarId)?.title ||
                'Auto-selected Primary Calendar'}
            </Text>
          </View>

          <Text style={[styles.arrowText, { color: theme.colors.primaryLight }]}>
            {showCalendarSelector ? '▲ Hide' : '▼ Change'}
          </Text>
        </TouchableOpacity>

        {showCalendarSelector && (
          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.xs }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginBottom: 4 }]}>
              Select writable Android calendar:
            </Text>
            {writableCalendars.map((cal) => {
              const isSelected = preferences?.selectedCalendarId === cal.id;
              return (
                <TouchableOpacity
                  key={cal.id}
                  style={[
                    styles.calOption,
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
                  <View style={styles.calOptionRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                          {cal.title}
                        </Text>
                        {cal.isPrimary && (
                          <View
                            style={[
                              styles.primaryPill,
                              { backgroundColor: theme.colors.primaryLight },
                            ]}
                          >
                            <Text style={styles.primaryPillText}>PRIMARY</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          theme.typography.caption,
                          { color: theme.colors.textSecondary, marginTop: 2 },
                        ]}
                      >
                        {formatCalendarSourceDescription(cal)}
                      </Text>
                    </View>

                    <Text style={{ color: isSelected ? theme.colors.primaryLight : theme.colors.textMuted, fontSize: 16 }}>
                      {isSelected ? '🔘' : '⚪'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Google Sync Transparency Notice */}
            <View
              style={[
                styles.disclaimerBox,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.xs,
                  padding: theme.spacing.sm,
                  marginTop: theme.spacing.xs,
                },
              ]}
            >
              <Text style={[theme.typography.caption, { color: theme.colors.infoForeground, fontWeight: '700' }]}>
                ℹ️ Google Account Synchronization Transparency:
              </Text>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textSecondary, marginTop: 2, lineHeight: 15 },
                ]}
              >
                LifeOS inserts directly into Android's native CalendarProvider. Cloud sync to Google Calendar on the web depends entirely on Android account synchronization being enabled for that Google account on this device.
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Row: Refresh & Quick Create */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.actionPill,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={loadCalendarData}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionPillText, { color: theme.colors.primaryLight }]}>
            🔄 Refresh Agenda
          </Text>
        </TouchableOpacity>

        {onNavigateToInput && (
          <TouchableOpacity
            style={[
              styles.actionPill,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={onNavigateToInput}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionPillText, { color: theme.colors.accent }]}>
              + Schedule Event
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Agenda-Style Events List */}
      {isLoading ? (
        <LoadingState message="Loading calendar events from Android provider..." />
      ) : groupKeys.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="No Scheduled Events"
          description={
            permission?.granted
              ? 'No events have been created by LifeOS yet. Try typing "Schedule project review tomorrow at 3 PM".'
              : 'Grant calendar permissions above to load your scheduled events.'
          }
          actionLabel={onNavigateToInput ? 'Schedule an Event' : undefined}
          onAction={onNavigateToInput}
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {groupKeys.map((dayLabel) => (
            <View key={dayLabel} style={styles.dayGroup}>
              {/* Day Header */}
              <View style={styles.dayHeaderRow}>
                <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
                  🗓️ {dayLabel}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                  {groupedEvents[dayLabel].length} event{groupedEvents[dayLabel].length === 1 ? '' : 's'}
                </Text>
              </View>

              {/* Event Cards */}
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
                {groupedEvents[dayLabel].map(({ mapping, event }) => {
                  const isDeletedOutside = mapping.status === 'created' && !event;

                  return (
                    <View
                      key={mapping.action_id}
                      style={[
                        styles.agendaCard,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: theme.colors.border,
                          borderRadius: theme.radii.md,
                          padding: theme.spacing.md,
                        },
                        theme.shadows.sm,
                      ]}
                    >
                      <View style={styles.agendaTopRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                            {event?.title || mapping.action_id}
                          </Text>

                          {event ? (
                            <View style={{ marginTop: 2 }}>
                              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                                ⏰{' '}
                                {new Date(event.startDate).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}{' '}
                                –{' '}
                                {new Date(event.endDate).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>

                              {event.location ? (
                                <Text
                                  style={[
                                    theme.typography.caption,
                                    { color: theme.colors.textSecondary, marginTop: 1 },
                                  ]}
                                >
                                  📍 {event.location}
                                </Text>
                              ) : null}
                            </View>
                          ) : (
                            <Text style={[theme.typography.caption, { color: theme.colors.errorForeground, marginTop: 2 }]}>
                              ⚠️ Event not found in device provider
                            </Text>
                          )}
                        </View>

                        <StatusBadge
                          status={
                            mapping.status === 'created' && event
                              ? 'in_provider'
                              : isDeletedOutside
                              ? 'deleted'
                              : mapping.status
                          }
                          size="sm"
                        />
                      </View>

                      {/* Meta: Action ID & Android Event ID */}
                      <View style={[styles.metaBar, { borderTopColor: theme.colors.divider }]}>
                        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                          Action ID: {mapping.action_id}
                        </Text>
                        {mapping.android_event_id && (
                          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                            Event ID: {mapping.android_event_id}
                          </Text>
                        )}
                      </View>

                      {/* Action Buttons: Edit & Delete */}
                      <View style={[styles.agendaActions, { marginTop: theme.spacing.sm }]}>
                        {event && (
                          <SecondaryButton
                            label="Edit"
                            icon="✏️"
                            onPress={() => handleStartEdit(mapping.action_id, event)}
                            size="sm"
                          />
                        )}

                        <TouchableOpacity
                          style={[
                            styles.deleteBtn,
                            {
                              backgroundColor: theme.colors.errorSurface,
                              borderColor: theme.colors.errorBorder,
                            },
                          ]}
                          onPress={() =>
                            setItemToDelete({
                              actionId: mapping.action_id,
                              title: event?.title || mapping.action_id,
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.deleteBtnText, { color: theme.colors.errorForeground }]}>
                            🗑️ Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Delete Confirmation Dialog */}
      {itemToDelete && (
        <ConfirmationDialog
          visible={true}
          title="Delete Calendar Event"
          message={`Are you sure you want to delete "${itemToDelete.title}"? This will remove the event directly from your native Android calendar.`}
          confirmLabel="Delete Event"
          cancelLabel="Cancel"
          isDestructive
          isLoading={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setItemToDelete(null)}
        />
      )}

      {/* Edit Event BottomSheet */}
      {editingActionId && (
        <BottomSheet
          visible={true}
          title="Edit Calendar Event"
          subtitle="Update event details in Android CalendarProvider"
          onClose={() => setEditingActionId(null)}
          footer={
            <View style={styles.sheetFooterRow}>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label="Cancel"
                  onPress={() => setEditingActionId(null)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Save Changes"
                  icon="✓"
                  onPress={handleSaveEdit}
                />
              </View>
            </View>
          }
        >
          <View style={{ gap: theme.spacing.md }}>
            <View>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 4 }]}>
                Event Title:
              </Text>
              <TextInput
                style={[
                  styles.sheetInput,
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
                placeholder="Event Title"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <View>
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 4 }]}>
                Location (Optional):
              </Text>
              <TextInput
                style={[
                  styles.sheetInput,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    color: theme.colors.textPrimary,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.sm,
                    padding: theme.spacing.md,
                  },
                  theme.typography.bodyLarge,
                ]}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="e.g. Conference Room B / Zoom"
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
  permCard: {
    borderWidth: 1,
  },
  destinationCard: {
    borderWidth: 1,
  },
  destinationToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 12,
    fontWeight: '700',
  },
  calOption: {
    borderWidth: 1,
    marginVertical: 2,
  },
  calOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  primaryPillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  disclaimerBox: {
    borderWidth: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  dayGroup: {
    marginBottom: 6,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  agendaCard: {
    borderWidth: 1,
  },
  agendaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 6,
  },
  agendaActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sheetFooterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetInput: {
    borderWidth: 1,
  },
});
