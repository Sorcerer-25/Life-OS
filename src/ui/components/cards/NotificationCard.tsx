import { ScalePressable, animateLayout } from '../core/Motion';
import { actionDate, agentType, humanLabel, notificationResult } from '../../presentation';
import { SuccessFeedback } from '../core/SuccessFeedback';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, UIManager, View, ViewStyle } from 'react-native';
import { NotificationInboxItem } from '../../../models/NotificationEvent';
import { useTheme } from '../../theme';
import { Icon } from '../core/Icon';
import { IconTile } from '../core/IconTile';
import { PrimaryButton } from '../core/PrimaryButton';
import { SecondaryButton } from '../core/SecondaryButton';
import { StatusBadge } from '../core/StatusBadge';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface NotificationCardProps {
  item: NotificationInboxItem;
  isProcessing?: boolean;
  onAnalyse?: (itemId: string) => void;
  onApprove?: (itemId: string) => void;
  onEdit?: (item: NotificationInboxItem) => void;
  onDismiss?: (itemId: string) => void;
  compact?: boolean;
  style?: ViewStyle;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({
  item,
  isProcessing = false,
  onAnalyse,
  onApprove,
  onEdit,
  onDismiss,
  compact = false,
  style,
}) => {
  const { theme } = useTheme();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  const toggleTechnicalDetails = () => {
    animateLayout();
    setShowTechnicalDetails(!showTechnicalDetails);
  };

  const formattedTime = (() => {
    try {
      const d = new Date(item.posted_at);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  })();

  // Resolve primary agent for this notification
  const primaryAgent = (() => {
    const act = item.action_plan?.actions?.[0];
    if (act?.agent) {
      const a = act.agent.toLowerCase();
      if (a.includes('calendar')) return 'calendar' as const;
      if (a.includes('reminder')) return 'reminder' as const;
      if (a.includes('task')) return 'task' as const;
    }
    const intent = item.analysis?.intents?.[0]?.intent?.toLowerCase();
    if (intent?.includes('calendar') || intent?.includes('event') || intent?.includes('schedule')) return 'calendar' as const;
    if (intent?.includes('reminder')) return 'reminder' as const;
    if (intent?.includes('task')) return 'task' as const;
    return 'inbox' as const;
  })();

  // Build a clean human-readable result line
  const formatCleanResult = () => notificationResult(item.action_plan, item.execution_result);

  return (
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
      {/* Top Header: Agent Icon Tile + App Badge + Status */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <IconTile agent={primaryAgent} size={34} iconSize={18} style={{ marginRight: 8 }} />
          <View
            style={[
              styles.appBadge,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.appBadgeText, { color: theme.colors.textPrimary }]}>
              {item.app_label}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {formattedTime ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {formattedTime}
            </Text>
          ) : null}
          <StatusBadge status={item.status} size="sm" />
        </View>
      </View>

      {/* Title & Body */}
      <Text
        style={[
          theme.typography.titleSmall,
          { color: theme.colors.textPrimary, marginTop: theme.spacing.sm },
        ]}
        numberOfLines={compact ? 1 : 2}
      >
        {item.title}
      </Text>

      <Text
        style={[
          theme.typography.bodyMedium,
          { color: theme.colors.textSecondary, marginTop: 4, lineHeight: 22 },
        ]}
        numberOfLines={compact ? 2 : 4}
      >
        {item.text}
      </Text>

      {/* Detected Intent & Plan (if analysed) */}
      {!compact && item.analysis && (
        <View
          style={[
            styles.analysisBox,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.sm,
              marginTop: theme.spacing.md,
            },
          ]}
        >
          <View style={styles.analysisHeader}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '700' }]}>
              DETECTED PLAN
            </Text>
            {item.action_plan?.decision.workflow_status && (
              <StatusBadge status={item.action_plan.decision.workflow_status} size="sm" />
            )}
          </View>

          {item.analysis.intents.map((intent: any, idx: number) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Icon name="check" size={18} color={theme.colors.success} style={{ marginRight: 6 }} />
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, flex: 1 }]}>
                {humanLabel(intent.intent)}
              </Text>
            </View>
          ))}

          {item.action_plan?.actions.map((act: any, idx: number) => (
            <View key={idx} style={styles.actionPlanRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconTile agent={agentType(act.agent)} size={30} style={{ marginRight: 6 }} />
                <Text style={[theme.typography.caption, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                  {humanLabel(act.operation)} {actionDate(act.data as Record<string, unknown>)}
                </Text>
              </View>
              {act.requires_confirmation ? (
                <Text style={[theme.typography.caption, { color: theme.colors.warning }]}>
                  Confirmation req
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Clean Result Line (if actioned) - Hides raw JSON behind expander */}
      {!compact && item.status === 'actioned' && (
        <View
          style={[
            styles.resultBox,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderColor: theme.colors.successBorder,
              borderRadius: theme.radii.sm,
              marginTop: theme.spacing.sm,
            },
          ]}
        >
          <SuccessFeedback label={formatCleanResult()} />

          {/* Technical Details Expander */}
          <ScalePressable style={styles.techToggleRow}
            onPress={toggleTechnicalDetails}
            activeOpacity={0.7}
          >
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontWeight: '600' }]}>
              Technical details
            </Text>
            <Icon
              name={showTechnicalDetails ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.colors.textSecondary}
              style={{ marginLeft: 4 }}
            />
          </ScalePressable>

          {showTechnicalDetails && item.execution_result && (
            <View
              style={[
                styles.jsonContainer,
                {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.xs,
                  marginTop: 6,
                },
              ]}
            >
              <Text style={[theme.typography.code, { color: theme.colors.textSecondary }]}>
                {JSON.stringify(item.execution_result, null, 2)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons Row */}
      <View style={[styles.actionsRow, { marginTop: theme.spacing.md, flexWrap: 'wrap' }]}>
        {item.status === 'new' && onAnalyse && (
          <PrimaryButton
            label="Analyse Request"
            icon="zap"
            onPress={() => onAnalyse(item.id)}
            isLoading={isProcessing}
            size="sm"
          />
        )}

        {item.status === 'analysed' && (
          <View style={styles.actionButtonGroup}>
            {onEdit && (
              <SecondaryButton
                label="Edit"
                icon="settings"
                onPress={() => onEdit(item)}
                disabled={isProcessing}
                size="sm"
              />
            )}
            {onApprove && (
              <PrimaryButton
                label="Approve plan"
                icon="check"
                onPress={() => onApprove(item.id)}
                isLoading={isProcessing}
                size="sm"
              />
            )}
          </View>
        )}

        {item.status !== 'dismissed' && item.status !== 'actioned' && onDismiss && (
          <SecondaryButton
            label="Dismiss"
            onPress={() => onDismiss(item.id)}
            disabled={isProcessing}
            size="sm"
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  appBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analysisBox: {
    padding: 10,
    borderWidth: 1,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionPlanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultBox: {
    padding: 10,
    borderWidth: 1,
  },
  resultLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  techToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  jsonContainer: {
    padding: 8,
    borderWidth: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
});
