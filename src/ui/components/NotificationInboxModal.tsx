import React from 'react';
import { Modal } from 'react-native';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { InboxScreen } from '../screens/InboxScreen';

interface NotificationInboxModalProps {
  visible: boolean;
  onClose: () => void;
  processor: NotificationProcessor;
}

export const NotificationInboxModal: React.FC<NotificationInboxModalProps> = ({
  visible,
  onClose,
  processor,
}) => {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <InboxScreen
        processor={processor}
        isModal
        onClose={onClose}
      />
    </Modal>
  );
};
