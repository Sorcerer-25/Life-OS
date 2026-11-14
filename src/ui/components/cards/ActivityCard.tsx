import { ScalePressable } from '../core/Motion';
import { agentType as resolveAgent, humanLabel } from '../../presentation';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { Icon } from '../core/Icon';
import { AgentType, IconTile } from '../core/IconTile';
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
  scheduledAt?: string;
  timestamp: string;
}

interface ActivityCardProps {
  item: ActivityItemData;
  onPress?: () => void;
  style?: ViewStyle;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ item, onPress, style }) => {
  const { theme } = useTheme();

  // Resolve agent type
  const agentType: AgentType = (() => {
    const ag = item.agents?.[0]?.toLowerCase() || '';
    if (ag.includes('calendar')) return 'calendar';
    if (ag.includes('reminder')) return 'reminder';
    if (ag.includes('task')) return 'task';
    const int = item.intents?.[0]?.toLowerCase() || '';
    if (int.includes('calendar') || int.includes('schedule') || int.includes('event')) return 'calendar';
    if (int.includes('reminder')) return 'reminder';
    if (int.includes('task')) return 'task';
    if (int.includes('expense')) return 'expense';
    return item.sourceType === 'voice' ? 'system' : 'inbox';
  })();

  const formattedTime = (() => {
    try {
      const d = new Date(item.timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return item.timestamp;
    }
  })();

  // Format activity headline by what happened
  const getActionHeadline = () => {
    const firstAgent = item.agents?.[0]?.toLowerCase() || '';
    const firstIntent = item.intents?.[0]?.toLowerCase() || '';
    if (firstAgent.includes('calendar') || firstIntent.includes('calendar') || firstIntent.includes('event')) {
      return item.status === 'failed' ? 'Calendar action failed' : item.status === 'actioned' ? 'Calendar event added' : 'Calendar event planned';
    }
    if (firstAgent.includes('reminder') || firstIntent.includes('reminder')) {
      return 'Reminder plan';
    }
    if (firstAgent.includes('task') || firstIntent.includes('task')) {
      return 'Task plan';
    }
    if (firstIntent.includes('expense')) {
      return 'Expense review';
    }
    return item.sourceType === 'notification' ? 'Notification received' : 'Request reviewed';
  };

  const actionHeadline = [getActionHeadline(), item.scheduledAt].filter(Boolean).join(' · ');
  const originalMessage = actionHeadline !== item.title ? item.title : (item.description || '');

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
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.sourceGroup}>
          <IconTile agent={agentType} size={30} iconSize={18} />
          <View style={{ marginLeft: 8 }}>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary, fontWeight: '700' },
              ]}
            >
              {item.sourceApp || item.sourceType.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.rightHeader}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {formattedTime}
          </Text>
          <StatusBadge status={item.status} size="sm" />
        </View>
      </View>

      {/* Main Headline: What happened */}
      <Text
        style={[
          theme.typography.titleSmall,
          { color: theme.colors.textPrimary, marginTop: theme.spacing.sm },
        ]}
        numberOfLines={2}
      >
        {actionHeadline}
      </Text>

      {/* Original message as smaller line underneath */}
      {originalMessage ? (
        <Text
          style={[
            theme.typography.bodyMedium,
            { color: theme.colors.textSecondary, marginTop: 2, lineHeight: 20 },
          ]}
          numberOfLines={2}
        >
          {originalMessage}
        </Text>
      ) : null}

      {/* Tags row with line icons */}
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
              <Icon name="check" size={18} color={theme.colors.success} style={{ marginRight: 4 }} />
              <Text style={[styles.miniTagText, { color: theme.colors.textPrimary }]}>
                {humanLabel(intent)}
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
              <IconTile agent={resolveAgent(agent)} size={28} style={{ marginRight: 4 }} />
              <Text style={[styles.miniTagText, { color: theme.colors.textPrimary }]}>
                {humanLabel(agent)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <ScalePressable onPress={onPress} activeOpacity={0.75}>
        {content}
      </ScalePressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  miniTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
