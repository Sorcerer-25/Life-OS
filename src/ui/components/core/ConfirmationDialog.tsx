import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
              padding: theme.spacing.xl,
            },
            theme.shadows.lg,
          ]}
        >
          <Text style={[theme.typography.titleLarge, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>

          <Text
            style={[
              theme.typography.bodyMedium,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.sm, lineHeight: 20 },
            ]}
          >
            {message}
          </Text>

          <View style={[styles.actionsRow, { marginTop: theme.spacing.xl, gap: theme.spacing.md }]}>
            <View style={styles.actionCol}>
              <SecondaryButton
                label={cancelLabel}
                onPress={onCancel}
                disabled={isLoading}
              />
            </View>
            <View style={styles.actionCol}>
              <PrimaryButton
                label={confirmLabel}
                onPress={onConfirm}
                variant={isDestructive ? 'danger' : 'teal'}
                isLoading={isLoading}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionCol: {
    flex: 1,
  },
});
