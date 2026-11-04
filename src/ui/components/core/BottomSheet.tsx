import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import { IconButton } from './IconButton';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightPercent?: number; // e.g. 90
  footer?: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightPercent = 90,
  footer,
}) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropTouch} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderTopLeftRadius: theme.radii.xl,
                borderTopRightRadius: theme.radii.xl,
                maxHeight: `${maxHeightPercent}%`,
              },
              theme.shadows.lg,
            ]}
          >
            {/* Drag Handle Indicator */}
            <View style={styles.handleContainer}>
              <View style={[styles.dragHandle, { backgroundColor: theme.colors.border }]} />
            </View>

            {/* Header */}
            <View
              style={[
                styles.headerRow,
                {
                  paddingHorizontal: theme.spacing.xl,
                  paddingBottom: theme.spacing.md,
                  borderBottomColor: theme.colors.divider,
                },
              ]}
            >
              <View style={styles.titleCol}>
                <Text style={[theme.typography.titleLarge, { color: theme.colors.textPrimary }]}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    style={[
                      theme.typography.bodySmall,
                      { color: theme.colors.textSecondary, marginTop: 2 },
                    ]}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>

              <IconButton
                icon="✕"
                onPress={onClose}
                accessibilityLabel="Close sheet"
                size="sm"
                variant="subtle"
              />
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={{ padding: theme.spacing.xl, paddingBottom: 30 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {/* Optional Footer Action */}
            {footer && (
              <View
                style={[
                  styles.footerRow,
                  {
                    padding: theme.spacing.lg,
                    borderTopColor: theme.colors.divider,
                    backgroundColor: theme.colors.surfaceElevated,
                  },
                ]}
              >
                {footer}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  keyboardContainer: {
    width: '100%',
  },
  sheet: {
    width: '100%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  titleCol: {
    flex: 1,
    marginRight: 12,
  },
  contentScroll: {
    flexGrow: 0,
  },
  footerRow: {
    borderTopWidth: 1,
  },
});
