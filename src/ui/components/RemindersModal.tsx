import React from 'react';
import { Modal } from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { RemindersScreen } from '../screens/RemindersScreen';

interface RemindersModalProps {
  visible: boolean;
  onClose: () => void;
  calendarAgent: CalendarAgent;
  processor: NotificationProcessor;
  onNavigateToInput?: (suggestion?: string) => void;
}

export const RemindersModal: React.FC<RemindersModalProps> = ({
  visible,
  onClose,
  calendarAgent,
  processor,
  onNavigateToInput,
}) => {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <RemindersScreen
        calendarAgent={calendarAgent}
        processor={processor}
        onNavigateToInput={onNavigateToInput}
        isModal
        onClose={onClose}
      />
    </Modal>
  );
};
