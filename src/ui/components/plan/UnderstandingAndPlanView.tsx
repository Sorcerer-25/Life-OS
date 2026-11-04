import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { CalendarAgent } from '../../../calendar/calendarAgent';
import { IdentificationResult } from '../../../intent/identifier';
import { ActionItem, ActionPlan } from '../../../models/ActionPlan';
import { AgentResult } from '../../../models/AgentResult';
import { useTheme } from '../../theme';
import { ActionPlanCard } from '../cards/ActionPlanCard';
import { IntentCard } from '../cards/IntentCard';
import { EmptyState } from '../core/EmptyState';
import { SectionHeader } from '../core/SectionHeader';
import { StatusBadge } from '../core/StatusBadge';

interface UnderstandingAndPlanViewProps {
  analysisResult: IdentificationResult;
  actionPlan?: ActionPlan | null;
  calendarAgent?: CalendarAgent;
  style?: ViewStyle;
}

export const UnderstandingAndPlanView: React.FC<UnderstandingAndPlanViewProps> = ({
  analysisResult,
  actionPlan,
  calendarAgent,
  style,
}) => {
  const { theme } = useTheme();

  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [calendarResults, setCalendarResults] = useState<Record<string, AgentResult>>({});
  const [executingActions, setExecutingActions] = useState<Record<string, boolean>>({});

  const { analysis, warning, executionTimeMs } = analysisResult;
  const agent = calendarAgent || new CalendarAgent();

  const handleExecuteCalendarAction = async (action: ActionItem) => {
    setExecutingActions((prev) => ({ ...prev, [action.action_id]: true }));
    try {
      const result = await agent.execute({
        taskId: `task_${Date.now()}`,
        requestId: actionPlan?.request_id || analysis.request_id,
        actionId: action.action_id,
        agentName: 'calendar_agent',
        operation: action.operation,
        data: action.data as unknown as Record<string, unknown>,
      });
      setCalendarResults((prev) => ({ ...prev, [action.action_id]: result }));
    } catch (err: any) {
      setCalendarResults((prev) => ({
        ...prev,
        [action.action_id]: {
          taskId: `err_${Date.now()}`,
          actionId: action.action_id,
          agentName: 'calendar_agent',
          status: 'failure',
          message: err?.message || 'Calendar execution error',
          error: err?.message,
        },
      }));
    } finally {
      setExecutingActions((prev) => ({ ...prev, [action.action_id]: false }));
    }
  };

  const hasMissingInformation =
    analysis.overall_missing && analysis.overall_missing.length > 0;
  const hasClarificationQuestions =
    actionPlan && actionPlan.decision.clarification_questions.length > 0;
  const hasUnsupported =
    analysis.unsupported_components && analysis.unsupported_components.length > 0;
  const hasUnrecognized =
    analysis.unrecognized_components && analysis.unrecognized_components.length > 0;

  return (
    <View style={[styles.container, style]}>
      {/* Parser Notice Banner (if any) */}
      {warning && (
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: theme.colors.warningSurface,
              borderColor: theme.colors.warningBorder,
              borderRadius: theme.radii.sm,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.md,
            },
          ]}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.warningForeground, fontWeight: '700' }]}>
            ⚠️ Parser Notice:
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, marginTop: 2 }]}>
            {warning}
          </Text>
        </View>
      )}

      {/* Unsupported Capability Warning Card */}
      {hasUnsupported && (
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: theme.colors.errorSurface,
              borderColor: theme.colors.errorBorder,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.md,
            },
          ]}
        >
          <Text style={[theme.typography.titleSmall, { color: theme.colors.errorForeground }]}>
            🚫 Unsupported Capability Detected
          </Text>
          {analysis.unsupported_components.map((un, idx) => (
            <View key={idx} style={{ marginTop: 4 }}>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                Requested: {un.capability}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 1 }]}>
                {un.reason}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Unrecognized Input Warning Card */}
      {hasUnrecognized && (
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: theme.colors.warningSurface,
              borderColor: theme.colors.warningBorder,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.md,
            },
          ]}
        >
          <Text style={[theme.typography.titleSmall, { color: theme.colors.warningForeground }]}>
            ❓ Unrecognized Input Clause
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            LifeOS could not identify a supported action for:
          </Text>
          {analysis.unrecognized_components.map((text, idx) => (
            <Text
              key={idx}
              style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '700', marginTop: 2 }]}
            >
              • "{text}"
            </Text>
          ))}
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginTop: 6, fontStyle: 'italic' }]}>
            Tip: Try phrasing as a reminder ("Remind me to..."), calendar meeting ("Schedule..."), or expense ("Paid ₹...").
          </Text>
        </View>
      )}

      {/* Missing Required Information Banner */}
      {hasMissingInformation && (
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: theme.colors.warningSurface,
              borderColor: theme.colors.warningBorder,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.md,
            },
          ]}
        >
          <Text style={[theme.typography.titleSmall, { color: theme.colors.warningForeground }]}>
            ⚠️ Missing Required Information
          </Text>
          {analysis.overall_missing.map((missing, idx) => (
            <Text
              key={idx}
              style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, marginTop: 2 }]}
            >
              • {missing}
            </Text>
          ))}
        </View>
      )}

      {/* Clarification Prompts Banner */}
      {hasClarificationQuestions && actionPlan && (
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: theme.colors.warningSurface,
              borderColor: theme.colors.warningBorder,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.md,
            },
          ]}
        >
          <Text style={[theme.typography.titleSmall, { color: theme.colors.warningForeground }]}>
            ❓ User Clarification Required
          </Text>
          {actionPlan.decision.clarification_questions.map((q, idx) => (
            <Text
              key={idx}
              style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary, fontWeight: '600', marginTop: 4 }]}
            >
              👉 {q}
            </Text>
          ))}
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* STEP 1: WHAT LIFEOS UNDERSTOOD                              */}
      {/* ─────────────────────────────────────────────────────────── */}
      <SectionHeader
        title="1. What LifeOS Understood"
        badge={analysis.intents.length}
      />

      {analysis.intents.length === 0 ? (
        <EmptyState
          title="No Supported Intents"
          description="LifeOS analyzed your input but found no action intents matching supported categories."
        />
      ) : (
        analysis.intents.map((item) => (
          <IntentCard key={item.sequence} item={item} />
        ))
      )}

      {/* Explicit Ordering Hints (if any) */}
      {analysis.ordering_hints && analysis.ordering_hints.length > 0 && (
        <View
          style={[
            styles.orderingCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              marginTop: theme.spacing.sm,
            },
          ]}
        >
          <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: 4 }]}>
            Execution Ordering Hints
          </Text>
          {analysis.ordering_hints.map((hint, idx) => (
            <Text
              key={idx}
              style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}
            >
              Sequence <Text style={{ color: theme.colors.primaryLight, fontWeight: '700' }}>#{hint.from_sequence}</Text> runs before Sequence <Text style={{ color: theme.colors.primaryLight, fontWeight: '700' }}>#{hint.to_sequence}</Text> ({hint.relationship.toUpperCase()})
            </Text>
          ))}
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* STEP 2: HOW LIFEOS PLANS TO HANDLE IT (SUPERVISOR DECISION) */}
      {/* ─────────────────────────────────────────────────────────── */}
      {actionPlan && (
        <View style={{ marginTop: theme.spacing.lg }}>
          <SectionHeader title="2. How LifeOS Plans to Handle It" />

          <View
            style={[
              styles.decisionCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
              },
              theme.shadows.sm,
            ]}
          >
            <View style={styles.decisionHeader}>
              <View>
                <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                  SUPERVISOR WORKFLOW
                </Text>
                <Text style={[theme.typography.titleMedium, { color: theme.colors.textPrimary, marginTop: 2 }]}>
                  Evaluation Outcome
                </Text>
              </View>
              <StatusBadge status={actionPlan.decision.workflow_status} size="md" />
            </View>

            {/* Decision Reasons */}
            <View style={{ marginTop: theme.spacing.sm, gap: 3 }}>
              {actionPlan.decision.reasons.map((reason, idx) => (
                <Text
                  key={idx}
                  style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}
                >
                  • {reason}
                </Text>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* STEP 3: PROPOSED ACTIONS (ACTION GRAPH)                    */}
      {/* ─────────────────────────────────────────────────────────── */}
      {actionPlan && (
        <View style={{ marginTop: theme.spacing.lg }}>
          <SectionHeader
            title="3. Proposed Actions Graph"
            badge={actionPlan.actions.length}
          />

          {actionPlan.actions.length === 0 ? (
            <EmptyState
              title="No Actions Dispatched"
              description="LifeOS verified this request does not require background action dispatch."
            />
          ) : (
            actionPlan.actions.map((act) => (
              <ActionPlanCard
                key={act.action_id}
                action={act}
                executionResult={calendarResults[act.action_id]}
                isExecuting={Boolean(executingActions[act.action_id])}
                onExecute={handleExecuteCalendarAction}
              />
            ))
          )}
        </View>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* DEMO TECHNICAL AUDIT SECTION (COLLAPSED BY DEFAULT)        */}
      {/* ─────────────────────────────────────────────────────────── */}
      <View style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.lg }}>
        <TouchableOpacity
          style={[
            styles.techToggleBtn,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
            },
          ]}
          onPress={() => setShowTechnicalDetails(!showTechnicalDetails)}
          activeOpacity={0.7}
        >
          <View style={styles.techToggleRow}>
            <View>
              <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>
                🛠️ Technical Details & Audit Logs
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                For final-year project evaluation & supervisor validation
              </Text>
            </View>
            <Text style={[styles.arrowText, { color: theme.colors.primaryLight }]}>
              {showTechnicalDetails ? '▲ Hide' : '▼ View'}
            </Text>
          </View>
        </TouchableOpacity>

        {showTechnicalDetails && (
          <View
            style={[
              styles.techDetailsBox,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
                marginTop: theme.spacing.sm,
              },
            ]}
          >
            {/* Latency & Processing Meta */}
            <View style={styles.metaRow}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                Request ID:{' '}
                <Text style={[theme.typography.code, { color: theme.colors.primaryLight }]}>
                  {analysis.request_id}
                </Text>
              </Text>
              {executionTimeMs !== undefined && (
                <Text style={[theme.typography.caption, { color: theme.colors.successForeground }]}>
                  ⚡ {executionTimeMs} ms (Local Rule-Based)
                </Text>
              )}
            </View>

            {/* IntentAnalysis JSON */}
            <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginTop: 10, marginBottom: 4 }]}>
              IntentAnalysis JSON (Stage 1)
            </Text>
            <ScrollView horizontal style={styles.jsonScroll}>
              <Text style={[theme.typography.code, { color: theme.colors.textSecondary }]}>
                {JSON.stringify(analysis, null, 2)}
              </Text>
            </ScrollView>

            {/* ActionPlan JSON */}
            {actionPlan && (
              <>
                <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginTop: 14, marginBottom: 4 }]}>
                  ActionPlan JSON (Stage 2)
                </Text>
                <ScrollView horizontal style={styles.jsonScroll}>
                  <Text style={[theme.typography.code, { color: theme.colors.textSecondary }]}>
                    {JSON.stringify(actionPlan, null, 2)}
                  </Text>
                </ScrollView>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  noticeCard: {
    borderWidth: 1,
  },
  orderingCard: {
    borderWidth: 1,
  },
  decisionCard: {
    borderWidth: 1,
  },
  decisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  techToggleBtn: {
    borderWidth: 1,
  },
  techToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 12,
    fontWeight: '700',
  },
  techDetailsBox: {
    borderWidth: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  jsonScroll: {
    maxHeight: 260,
  },
});
