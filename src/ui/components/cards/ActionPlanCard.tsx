import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ActionItem } from '../../../models/ActionPlan';
import { AgentResult } from '../../../models/AgentResult';
import { useTheme } from '../../theme';
import { PrimaryButton } from '../core/PrimaryButton';
import { StatusBadge } from '../core/StatusBadge';

interface ActionPlanCardProps {
  action: ActionItem;
  executionResult?: AgentResult;
  isExecuting?: boolean;
  onExecute?: (action: ActionItem) => void;
  style?: ViewStyle;
}

export const ActionPlanCard: React.FC<ActionPlanCardProps> = ({
  action,
  executionResult,
  isExecuting = false,
  onExecute,
  style,
}) => {
  const { theme } = useTheme();
  const [showPayload, setShowPayload] = useState<boolean>(false);

  const isCalendarAction = action.agent === 'calendar_agent';
  const isFinanceAction = action.agent === 'finance_agent';

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
      {/* Top Header: ID & Status Badges */}
      <View style={styles.headerRow}>
        <Text style={[theme.typography.code, { color: theme.colors.primaryLight, fontWeight: '700' }]}>
          {action.action_id}
        </Text>

        <View style={styles.badgeRow}>
          {action.requires_confirmation && (
            <StatusBadge status="confirmation_required" size="sm" />
          )}
          <StatusBadge status={action.status} size="sm" />
        </View>
      </View>

      {/* Agent & Operation Row */}
      <View style={[styles.metaRow, { marginTop: theme.spacing.sm }]}>
        <View style={styles.metaCol}>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            DISPATCHED AGENT
          </Text>
          <View style={styles.agentTag}>
            <Text style={[theme.typography.titleSmall, { color: theme.colors.accent }]}>
              🤖 {action.agent}
            </Text>
          </View>
        </View>

        <View style={styles.metaCol}>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            OPERATION
          </Text>
          <Text style={[theme.typography.titleSmall, { color: theme.colors.successForeground }]}>
            ⚡ {action.operation}
          </Text>
        </View>
      </View>

      {/* Dependencies */}
      <View style={{ marginTop: theme.spacing.xs }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          Dependencies:{' '}
          <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
            {action.depends_on.length > 0 ? action.depends_on.join(', ') : 'None (Root Action)'}
          </Text>
        </Text>
      </View>

      {/* Clarification Prompt Box (if needed) */}
      {action.clarification_prompt && (
        <View
          style={[
            styles.clarifyBox,
            {
              backgroundColor: theme.colors.warningSurface,
              borderColor: theme.colors.warningBorder,
              borderRadius: theme.radii.xs,
              marginTop: theme.spacing.sm,
            },
          ]}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.warningForeground, fontWeight: '700' }]}>
            ❓ Clarification Prompt:
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, marginTop: 2 }]}>
            {action.clarification_prompt}
          </Text>
        </View>
      )}

      {/* Collapsible Typed Payload Data */}
      <View style={{ marginTop: theme.spacing.sm }}>
        <TouchableOpacity
          onPress={() => setShowPayload(!showPayload)}
          activeOpacity={0.7}
          style={styles.payloadToggle}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.primaryLight }]}>
            {showPayload ? '▲ Hide Action Payload' : '▼ View Action Payload'}
          </Text>
        </TouchableOpacity>

        {showPayload && (
          <View
            style={[
              styles.payloadCodeBox,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.borderSubtle,
                borderRadius: theme.radii.xs,
              },
            ]}
          >
            <Text style={[theme.typography.code, { color: theme.colors.textSecondary }]}>
              {JSON.stringify(action.data, null, 2)}
            </Text>
          </View>
        )}
      </View>

      {/* Native Calendar Execution Card */}
      {isCalendarAction && (
        <View
          style={[
            styles.calendarBox,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderColor: theme.colors.primaryDark,
              borderRadius: theme.radii.sm,
              padding: theme.spacing.md,
              marginTop: theme.spacing.md,
            },
          ]}
        >
          <View style={styles.calendarHeader}>
            <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
              🗓️ Android Calendar Provider
            </Text>
            {executionResult && (
              <StatusBadge
                status={executionResult.status === 'success' ? 'ready' : 'failed'}
                label={executionResult.status.toUpperCase()}
              />
            )}
          </View>

          {executionResult ? (
            <View style={{ marginTop: theme.spacing.xs, gap: 4 }}>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary }]}>
                {executionResult.message}
              </Text>
              {Boolean(executionResult.output?.android_event_id) && (
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  Android Event ID: {String(executionResult.output?.android_event_id)}
                </Text>
              )}
              {Boolean(executionResult.output?.verified_in_provider) && (
                <Text style={[theme.typography.caption, { color: theme.colors.successForeground, fontWeight: '700' }]}>
                  ✓ Verified in native Android CalendarProvider
                </Text>
              )}
              {Boolean(executionResult.output?.duplicate) && (
                <Text style={[theme.typography.caption, { color: theme.colors.warningForeground }]}>
                  ⚡ Idempotent: Existing device event returned without re-inserting.
                </Text>
              )}
            </View>
          ) : (
            onExecute && (
              <View style={{ marginTop: theme.spacing.sm }}>
                <PrimaryButton
                  label="Insert into Device Calendar"
                  icon="📅"
                  onPress={() => onExecute(action)}
                  isLoading={isExecuting}
                  disabled={action.status === 'blocked'}
                  size="sm"
                />
              </View>
            )
          )}
        </View>
      )}

      {/* Financial Safety Guard Notice */}
      {isFinanceAction && (
        <View
          style={[
            styles.financeNotice,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.xs,
              marginTop: theme.spacing.sm,
            },
          ]}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.warningForeground, fontWeight: '700' }]}>
            🛡️ Financial Safety Policy:
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 1 }]}>
            Financial intents are safely identified and structured, but never executed automatically without explicit manual review.
          </Text>
        </View>
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCol: {
    flex: 1,
  },
  agentTag: {
    marginTop: 2,
  },
  clarifyBox: {
    padding: 8,
    borderWidth: 1,
  },
  payloadToggle: {
    paddingVertical: 2,
  },
  payloadCodeBox: {
    padding: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  calendarBox: {
    borderWidth: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financeNotice: {
    padding: 8,
    borderWidth: 1,
  },
});
