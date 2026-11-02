import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { CalendarMappingRecord } from '../../calendar/mappingRepository';
import { CalendarEventRecord } from '../../calendar/types';

interface CreatedEventsModalProps {
  visible: boolean;
  onClose: () => void;
  calendarAgent: CalendarAgent;
}

export const CreatedEventsModal: React.FC<CreatedEventsModalProps> = ({
  visible,
  onClose,
  calendarAgent,
}) => {
  const [events, setEvents] = useState<
    Array<{ mapping: CalendarMappingRecord; event: CalendarEventRecord | null }>
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editLocation, setEditLocation] = useState<string>('');

  const loadEvents = async () => {
    setLoading(true);
    try {
      const list = await calendarAgent.listCreatedEvents();
      setEvents(list);
    } catch (err) {
      console.warn('Failed to load created events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadEvents();
      setEditingActionId(null);
    }
  }, [visible]);

  const handleDelete = (actionId: string, title: string) => {
    Alert.alert(
      'Confirm Calendar Event Deletion',
      `Are you sure you want to delete "${title}" from your device calendar? This will remove the event directly from the native Android calendar provider.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Event',
          style: 'destructive',
          onPress: async () => {
            const res = await calendarAgent.deleteEvent(actionId);
            if (res.status === 'success') {
              Alert.alert('Deleted', 'Event deleted successfully from calendar.');
              loadEvents();
            } else {
              Alert.alert('Delete Failed', res.message);
            }
          },
        },
      ]
    );
  };

  const handleStartEdit = (actionId: string, event: CalendarEventRecord | null) => {
    setEditingActionId(actionId);
    setEditTitle(event?.title || '');
    setEditLocation(event?.location || '');
  };

  const handleSaveEdit = async (actionId: string) => {
    const res = await calendarAgent.updateEvent(actionId, {
      title: editTitle.trim(),
      location: editLocation.trim() || undefined,
    });

    if (res.status === 'success') {
      Alert.alert('Updated', 'Calendar event updated successfully.');
      setEditingActionId(null);
      loadEvents();
    } else {
      Alert.alert('Update Failed', res.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.headerRow}>
            <Text style={styles.modalTitle}>🗓️ LifeOS Created Events</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <Text style={styles.emptyText}>Loading events from mapping table...</Text>
            ) : events.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No calendar events have been created yet.</Text>
                <Text style={styles.emptySubtext}>
                  Schedule an event using text (e.g. "Schedule project review tomorrow at 3 PM") and
                  it will appear here.
                </Text>
              </View>
            ) : (
              events.map(({ mapping, event }) => {
                const isEditing = editingActionId === mapping.action_id;
                const isDeletedOutside = mapping.status === 'created' && !event;

                return (
                  <View key={mapping.action_id} style={styles.eventCard}>
                    {/* Header */}
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>
                        {event?.title || `Event (${mapping.action_id})`}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          mapping.status === 'created' && event
                            ? styles.badgeCreated
                            : isDeletedOutside
                            ? styles.badgeDeletedOutside
                            : styles.badgeDeleted,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {mapping.status === 'created' && event
                            ? '✓ IN PROVIDER'
                            : isDeletedOutside
                            ? '⚠️ DELETED OUTSIDE'
                            : mapping.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Meta info */}
                    <View style={styles.metaBox}>
                      <Text style={styles.metaText}>
                        <Text style={styles.metaLabel}>Action ID: </Text>
                        {mapping.action_id}
                      </Text>
                      <Text style={styles.metaText}>
                        <Text style={styles.metaLabel}>Android Event ID: </Text>
                        {mapping.android_event_id || 'None'}
                      </Text>
                      {event && (
                        <>
                          <Text style={styles.metaText}>
                            <Text style={styles.metaLabel}>Start: </Text>
                            {new Date(event.startDate).toLocaleString()}
                          </Text>
                          <Text style={styles.metaText}>
                            <Text style={styles.metaLabel}>End: </Text>
                            {new Date(event.endDate).toLocaleString()}
                          </Text>
                          {event.location ? (
                            <Text style={styles.metaText}>
                              <Text style={styles.metaLabel}>Location: </Text>
                              {event.location}
                            </Text>
                          ) : null}
                        </>
                      )}
                    </View>

                    {/* Edit Form */}
                    {isEditing ? (
                      <View style={styles.editBox}>
                        <Text style={styles.editLabel}>Edit Title:</Text>
                        <TextInput
                          style={styles.input}
                          value={editTitle}
                          onChangeText={setEditTitle}
                          placeholder="Event Title"
                          placeholderTextColor="#64748b"
                        />
                        <Text style={styles.editLabel}>Edit Location:</Text>
                        <TextInput
                          style={styles.input}
                          value={editLocation}
                          onChangeText={setEditLocation}
                          placeholder="Event Location"
                          placeholderTextColor="#64748b"
                        />
                        <View style={styles.buttonRow}>
                          <TouchableOpacity
                            style={[styles.smallBtn, styles.saveBtn]}
                            onPress={() => handleSaveEdit(mapping.action_id)}
                          >
                            <Text style={styles.btnText}>Save Changes</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallBtn, styles.cancelBtn]}
                            onPress={() => setEditingActionId(null)}
                          >
                            <Text style={styles.btnText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      /* Action Buttons */
                      mapping.status !== 'deleted' && (
                        <View style={styles.buttonRow}>
                          {event && (
                            <TouchableOpacity
                              style={[styles.smallBtn, styles.editBtn]}
                              onPress={() => handleStartEdit(mapping.action_id, event)}
                            >
                              <Text style={styles.btnText}>✏️ Edit</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.smallBtn, styles.deleteBtn]}
                            onPress={() =>
                              handleDelete(mapping.action_id, event?.title || mapping.action_id)
                            }
                          >
                            <Text style={styles.btnText}>🗑️ Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )
                    )}
                  </View>
                );
              })
            )}
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
    gap: 14,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  eventCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeCreated: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  badgeDeletedOutside: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderWidth: 1,
    borderColor: '#eab308',
  },
  badgeDeleted: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderWidth: 1,
    borderColor: '#64748b',
  },
  statusBadgeText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '700',
  },
  metaBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  metaText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  metaLabel: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  editBtn: {
    backgroundColor: '#334155',
  },
  deleteBtn: {
    backgroundColor: '#ef4444',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
  },
  cancelBtn: {
    backgroundColor: '#475569',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  editBox: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  editLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
});

