import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { SecondaryButton } from './SecondaryButton';

interface ErrorStateProps {
  title?: string;
  message: string;
  technicalError?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Processing Issue',
  message,
  technicalError,
  onRetry,
  style,
}) => {
  const { theme } = useTheme();
  const [showDetails, setShowDetails] = useState<boolean>(false);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.errorSurface,
          borderColor: theme.colors.errorBorder,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
        },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.icon}>⚠️</Text>
        <Text
          style={[
            theme.typography.titleSmall,
            { color: theme.colors.errorForeground, flex: 1, marginLeft: theme.spacing.sm },
          ]}
        >
          {title}
        </Text>
      </View>

      <Text
        style={[
          theme.typography.bodyMedium,
          { color: theme.colors.textPrimary, marginTop: theme.spacing.xs, lineHeight: 18 },
        ]}
      >
        {message}
      </Text>

      {technicalError && (
        <View style={{ marginTop: theme.spacing.sm }}>
          <TouchableOpacity
            onPress={() => setShowDetails(!showDetails)}
            activeOpacity={0.7}
            style={styles.detailsToggle}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.errorForeground }]}>
              {showDetails ? '▲ Hide raw error' : '▼ View technical details'}
            </Text>
          </TouchableOpacity>

          {showDetails && (
            <View
              style={[
                styles.codeBox,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[theme.typography.code, { color: theme.colors.textSecondary }]}>
                {technicalError}
              </Text>
            </View>
          )}
        </View>
      )}

      {onRetry && (
        <View style={{ marginTop: theme.spacing.md, alignSelf: 'flex-start' }}>
          <SecondaryButton label="Try Again" onPress={onRetry} size="sm" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 4,
    borderWidth: 1,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
  },
  detailsToggle: {
    paddingVertical: 3,
  },
  codeBox: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
});
