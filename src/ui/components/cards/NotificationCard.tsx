import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { NotificationInboxItem } from '../../../models/NotificationEvent';
import { useTheme } from '../../theme';
import { PrimaryButton } from '../core/PrimaryButton';
import { SecondaryButton } from '../core/SecondaryButton';
import { StatusBadge } from '../core/StatusBadge';

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

  const formattedTime = (() => {
    try {
      const d = new Date(item.posted_at);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  })();

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
        theme.shadows.sm,
        style,
      ]}
    >
      {/* Top Header: App Badge & Status */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.appBadge,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.appBadgeText, { color: theme.colors.primaryLight }]}>
            {item.app_label}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {formattedTime ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
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
          { color: theme.colors.textPrimary, marginTop: theme.spacing.xs },
        ]}
        numberOfLines={compact ? 1 : 2}
      >
        {item.title}
      </Text>

      <Text
        style={[
          theme.typography.bodySmall,
          { color: theme.colors.textSecondary, marginTop: 2, lineHeight: 18 },
        ]}
        numberOfLines={compact ? 2 : 4}
      >
        {item.text}
      </Text>

      {/* Package Meta */}
      {!compact && (
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
          App: {item.source_app}
        </Text>
      )}

      {/* Analysed Details (if analysed) */}
      {!compact && item.analysis && (
        <View
          style={[
            styles.analysisBox,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderColor: theme.colors.borderSubtle,
              borderRadius: theme.radii.xs,
              marginTop: theme.spacing.sm,
            },
          ]}
        >
          <View style={styles.analysisHeader}>
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, fontWeight: '700' }]}>
              DETECTED INTENT & PLAN
            </Text>
            {item.action_plan?.decision.workflow_status && (
              <StatusBadge status={item.action_plan.decision.workflow_status} size="sm" />
            )}
          </View>

          {item.analysis.intents.map((intent: any, idx: number) => (
            <Text
              key={idx}
              style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, marginTop: 2 }]}
            >
              🎯 {intent.intent} ({(intent.confidence * 100).toFixed(0)}%)
            </Text>
          ))}

          {item.action_plan?.actions.map((act: any, idx: number) => (
            <View key={idx} style={styles.actionPlanRow}>
              <Text style={[theme.typography.caption, { color: theme.colors.accent, fontWeight: '600' }]}>
                🤖 {act.agent} • {act.operation}
              </Text>
              {act.requires_confirmation && (
                <Text style={[theme.typography.caption, { color: theme.colors.warningForeground }]}>
                  ⚠️ Confirmation required
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Execution Result (if actioned) */}
      {!compact && item.status === 'actioned' && item.execution_result && (
        <View
          style={[
            styles.resultBox,
            {
              backgroundColor: theme.colors.successSurface,
              borderColor: theme.colors.successBorder,
              borderRadius: theme.radii.xs,
              marginTop: theme.spacing.sm,
            },
          ]}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.successForeground, fontWeight: '700' }]}>
            ✓ Execution Succeeded
          </Text>
          <Text style={[theme.typography.code, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            {JSON.stringify(item.execution_result, null, 2)}
          </Text>
        </View>
      )}

      {/* Action Buttons Row */}
      <View style={[styles.actionsRow, { marginTop: theme.spacing.md }]}>
        {item.status === 'new' && onAnalyse && (
          <PrimaryButton
            label="Analyse Request"
            icon="⚡"
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
                icon="✏️"
                onPress={() => onEdit(item)}
                disabled={isProcessing}
                size="sm"
              />
            )}
            {onApprove && (
              <PrimaryButton
                label="Approve & Execute"
                icon="✓"
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
  appBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  appBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analysisBox: {
    padding: 8,
    borderWidth: 1,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionPlanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultBox: {
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
