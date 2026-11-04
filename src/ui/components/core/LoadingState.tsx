import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface LoadingStateProps {
  message?: string;
  style?: ViewStyle;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  style,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { padding: theme.spacing.xl }, style]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {message ? (
        <Text
          style={[
            theme.typography.bodyMedium,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.md, textAlign: 'center' },
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
