import React, { useState } from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { CalendarAgent } from '../../../calendar/calendarAgent';
import { IdentificationResult } from '../../../intent/identifier';
import { ActionItem, ActionPlan } from '../../../models/ActionPlan';
import { AgentResult } from '../../../models/AgentResult';
import { useTheme } from '../../theme';
import { ActionPlanCard } from '../cards/ActionPlanCard';
import { Entrance, ScalePressable, animateLayout } from '../core/Motion';
import { Icon } from '../core/Icon';
import { StatusBadge } from '../core/StatusBadge';
import { SuccessFeedback } from '../core/SuccessFeedback';
interface Props { analysisResult: IdentificationResult; actionPlan?: ActionPlan | null; calendarAgent?: CalendarAgent; style?: ViewStyle }
export function UnderstandingAndPlanView({ analysisResult, actionPlan, calendarAgent, style }: Props) {
  const { theme } = useTheme();
  const [details, setDetails] = useState(false);
  const [results, setResults] = useState<Record<string, AgentResult>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const execute = async (action: ActionItem) => {
    if (busy[action.action_id] || action.status !== 'ready') return;
    setBusy(previous => ({ ...previous, [action.action_id]: true }));
    try {
      const result = await (calendarAgent || new CalendarAgent()).execute({ taskId: `task_${Date.now()}`, requestId: analysisResult.analysis.request_id, actionId: action.action_id, agentName: 'calendar_agent', operation: action.operation, data: action.data as Record<string, unknown> });
      setResults(previous => ({ ...previous, [action.action_id]: result }));
    } catch (error) {
      setResults(previous => ({ ...previous, [action.action_id]: { taskId: action.action_id, actionId: action.action_id, agentName: action.agent, status: 'failure', message: error instanceof Error ? error.message : 'Could not create the event.' } }));
    } finally { setBusy(previous => ({ ...previous, [action.action_id]: false })); }
  };
  const { analysis } = analysisResult;
  return <View style={style}>
    <SuccessFeedback key={analysis.request_id} label={actionPlan?.decision.workflow_status === 'ready' ? 'Your plan is ready to review' : 'Request reviewed'} />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 }}>
      <Text style={[theme.typography.titleMedium, { color: theme.colors.textPrimary }]}>Your plan</Text>
      {actionPlan && <StatusBadge status={actionPlan.decision.workflow_status} />}
    </View>
    {analysis.unsupported_components?.map((item, index) => <Text key={index} style={[theme.typography.bodyMedium, { color: theme.colors.warning, marginBottom: 8 }]}>{item.reason}</Text>)}
    {analysis.unrecognized_components?.length ? <Text style={[theme.typography.bodyMedium, { color: theme.colors.textSecondary }]}>Try rephrasing: {analysis.unrecognized_components.join('; ')}</Text> : null}
    {actionPlan?.actions.length ? actionPlan.actions.map((action, index) => <Entrance key={action.action_id} index={index}><ActionPlanCard action={action} executionResult={results[action.action_id]} isExecuting={busy[action.action_id]} onExecute={execute} /></Entrance>) : <Text style={[theme.typography.bodyMedium, { color: theme.colors.textSecondary }]}>Try a reminder, a calendar event, a task, or an expense. Include a date and time when needed.</Text>}
    <ScalePressable onPress={() => { animateLayout(); setDetails(!details); }} accessibilityRole="button" accessibilityState={{ expanded: details }} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 14 }}>
      <Icon name={details ? 'chevron-up' : 'chevron-down'} color={theme.colors.textSecondary} /><Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Technical details</Text>
    </ScalePressable>
    {details && <Text selectable style={[theme.typography.code, { color: theme.colors.textSecondary }]}>{JSON.stringify({ analysis, actionPlan, elapsedMs: analysisResult.executionTimeMs }, null, 2)}</Text>}
  </View>;
}
