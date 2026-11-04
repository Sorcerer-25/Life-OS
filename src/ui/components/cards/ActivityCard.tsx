import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { StatusBadge } from '../core/StatusBadge';

export interface ActivityItemData {
  id: string;
  sourceType: 'text' | 'voice' | 'notification';
  sourceApp?: string;
  title: string;
  description?: string;
  intents?: string[];
  agents?: string[];
  status: string;
  timestamp: string;
}

interface ActivityCardProps {
  item: ActivityItemData;
  onPress?: () => void;
  style?: ViewStyle;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ item, onPress, style }) => {
  const { theme } = useTheme();

  const getSourceIcon = () => {
    switch (item.sourceType) {
      case 'voice':
        return '🎤';
      case 'notification':
        return '🔔';
      case 'text':
      default:
        return '⌨️';
    }
  };

  const formattedTime = (() => {
    try {
      const d = new Date(item.timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return item.timestamp;
    }
  })();

  const content = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
        },
        theme.shadows.sm,
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.sourceGroup}>
          <Text style={styles.sourceIcon}>{getSourceIcon()}</Text>
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textSecondary, fontWeight: '700' },
            ]}
          >
            {item.sourceApp || item.sourceType.toUpperCase()}
          </Text>
        </View>

        <View style={styles.rightHeader}>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {formattedTime}
          </Text>
          <StatusBadge status={item.status} size="sm" />
        </View>
      </View>

      <Text
        style={[
          theme.typography.titleSmall,
          { color: theme.colors.textPrimary, marginTop: theme.spacing.xs },
        ]}
        numberOfLines={2}
      >
        {item.title}
      </Text>

      {item.description ? (
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.textSecondary, marginTop: 2 },
          ]}
          numberOfLines={2}
        >
          {item.description}
        </Text>
      ) : null}

      {(item.intents?.length || item.agents?.length) ? (
        <View style={[styles.tagsRow, { marginTop: theme.spacing.sm }]}>
          {item.intents?.map((intent, idx) => (
            <View
              key={`int_${idx}`}
              style={[
                styles.miniTag,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.miniTagText, { color: theme.colors.primaryLight }]}>
                🎯 {intent}
              </Text>
            </View>
          ))}
          {item.agents?.map((agent, idx) => (
            <View
              key={`ag_${idx}`}
              style={[
                styles.miniTag,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.miniTagText, { color: theme.colors.accent }]}>
                🤖 {agent}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginVertical: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sourceIcon: {
    fontSize: 13,
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

