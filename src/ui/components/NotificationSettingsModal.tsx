import React from 'react';
import { Modal } from 'react-native';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { SettingsScreen } from '../screens/SettingsScreen';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onClearAllNotifications?: () => void;
  processor?: NotificationProcessor;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  visible,
  onClose,
  onClearAllNotifications,
  processor,
}) => {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SettingsScreen
        processor={processor}
        onClearAllData={onClearAllNotifications ? async () => onClearAllNotifications() : undefined}
        isModal
        onClose={onClose}
      />
    </Modal>
  );
};
