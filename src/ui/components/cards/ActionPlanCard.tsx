import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { ActionItem } from '../../../models/ActionPlan';
import { AgentResult } from '../../../models/AgentResult';
import { useTheme } from '../../theme';
import { actionDate, agentType, humanLabel } from '../../presentation';
import { IconTile } from '../core/IconTile';
import { Icon } from '../core/Icon';
import { PrimaryButton } from '../core/PrimaryButton';
import { ScalePressable, animateLayout } from '../core/Motion';
import { StatusBadge } from '../core/StatusBadge';
import { SuccessFeedback } from '../core/SuccessFeedback';
interface Props { action: ActionItem; executionResult?: AgentResult; isExecuting?: boolean; onExecute?: (action: ActionItem) => void; style?: import('react-native').ViewStyle }
export function ActionPlanCard({ action, executionResult, isExecuting, onExecute, style }: Props) {
  const { theme } = useTheme();
  const [details, setDetails] = useState(false);
  const data = action.data as Record<string, unknown>;
  const scheduled = actionDate(data);
  const calendar = action.agent === 'calendar_agent';
  return <View style={[{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 12, padding: 14, marginVertical: 6 }, style]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconTile agent={agentType(action.agent)} />
      <View style={{ flex: 1 }}><Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>{humanLabel(action.operation)}</Text>
        <Text style={[theme.typography.bodyMedium, { color: theme.colors.textSecondary }]}>{String(data.title || data.description || humanLabel(action.agent))}</Text></View>
      <StatusBadge status={action.status} />
    </View>
    {scheduled ? <Text style={[theme.typography.bodyMedium, { color: theme.colors.textSecondary, marginTop: 10 }]}>{scheduled}</Text> : null}
    {action.clarification_prompt ? <Text style={[theme.typography.bodyMedium, { color: theme.colors.warning, marginTop: 10 }]}>{action.clarification_prompt}</Text> : null}
    {executionResult?.status === 'success' ? <SuccessFeedback label={executionResult.output?.verified_in_provider ? 'Added to Calendar · Verified' : 'Added to Calendar · Verification unavailable'} /> : executionResult ?
      <Text accessibilityRole="alert" style={[theme.typography.bodyMedium, { color: theme.colors.error, marginTop: 10 }]}>{executionResult.message}</Text> : null}
    {calendar && !executionResult && onExecute ? <View style={{ marginTop: 12, alignItems: 'flex-start' }}><PrimaryButton label="Add to Calendar" icon="calendar" onPress={() => onExecute(action)} disabled={action.status !== 'ready'} isLoading={isExecuting} /></View> : null}
    {!calendar && <Text style={[theme.typography.bodyMedium, { color: theme.colors.textSecondary, marginTop: 10 }]}>{action.agent === 'finance_agent' ? 'Saved as a proposal. No payment will be made.' : 'Planning is available. Creating tasks and scheduling reminders are not connected yet.'}</Text>}
    <ScalePressable onPress={() => { animateLayout(); setDetails(!details); }} accessibilityRole="button" accessibilityState={{ expanded: details }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 }}>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Technical details</Text><Icon name={details ? 'chevron-up' : 'chevron-down'} color={theme.colors.textSecondary} />
    </ScalePressable>
    {details && <Text selectable style={[theme.typography.code, { color: theme.colors.textSecondary }]}>{JSON.stringify({ action, executionResult }, null, 2)}</Text>}
  </View>;
}
