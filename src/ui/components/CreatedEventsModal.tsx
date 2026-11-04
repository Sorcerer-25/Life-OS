import React from 'react';
import { Modal } from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { CalendarScreen } from '../screens/CalendarScreen';

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
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <CalendarScreen
        calendarAgent={calendarAgent}
        isModal
        onClose={onClose}
      />
    </Modal>
  );
};
