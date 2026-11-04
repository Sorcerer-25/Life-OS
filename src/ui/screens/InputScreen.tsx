import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { IdentificationResult } from '../../intent/identifier';
import { ActionPlan } from '../../models/ActionPlan';
import { AgentResult } from '../../models/AgentResult';
import { useTheme } from '../theme';
import { ActionPlanCard } from '../components/cards/ActionPlanCard';
import { IntentCard } from '../components/cards/IntentCard';
import { AppHeader } from '../components/core/AppHeader';
import { EmptyState } from '../components/core/EmptyState';
import { ErrorState } from '../components/core/ErrorState';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { SectionHeader } from '../components/core/SectionHeader';
import { StatusBadge } from '../components/core/StatusBadge';
import { QUICK_SHORTCUTS } from './HomeScreen';

interface InputScreenProps {
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onOpenVoiceModal: () => void;
  onOpenInbox?: () => void;
  analysisResult: IdentificationResult | null;
  actionPlan: ActionPlan | null;
  calendarAgent: CalendarAgent;
}

export const InputScreen: React.FC<InputScreenProps> = ({
  inputText,
  setInputText,
  isLoading,
  errorMessage,
  setErrorMessage,
  onAnalyze,
  onClear,
  onOpenVoiceModal,
  onOpenInbox,
  analysisResult,
  actionPlan,
  calendarAgent,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [calendarResults, setCalendarResults] = useState<Record<string, AgentResult>>({});
  const [executingActions, setExecutingActions] = useState<Record<string, boolean>>({});

  const handleExecuteCalendarAction = async (action: any) => {
    setExecutingActions((prev) => ({ ...prev, [action.action_id]: true }));
    try {
      const result = await calendarAgent.execute({
        taskId: `task_${Date.now()}`,
        requestId: actionPlan?.request_id || analysisResult?.analysis.request_id || 'req_input',
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
          message: err?.message || 'Execution error',
          error: err?.message,
        },
      }));
    } finally {
      setExecutingActions((prev) => ({ ...prev, [action.action_id]: false }));
    }
  };

  const handleSelectShortcut = (shortcut: (typeof QUICK_SHORTCUTS)[0]) => {
    if (shortcut.prompt === '__VOICE__') {
      onOpenVoiceModal();
      return;
    }
    setInputText(shortcut.prompt);
    setErrorMessage(null);
  };

  return (
    <ScreenContainer testID="input-screen">
      {/* Header */}
      <AppHeader
        title="Input & Speech"
        subtitle="Natural language capture & offline intent decomposition"
        showStatusIndicator
        statusLabel="Deterministic Engine"
        onToggleTheme={toggleTheme}
        onOpenInbox={onOpenInbox}
      />

      {/* Large Multiline Input Workspace */}
      <View
        style={[
          styles.inputCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
            padding: theme.spacing.lg,
          },
          theme.shadows.md,
        ]}
      >
        <View style={styles.inputHeaderRow}>
          <Text style={[theme.typography.titleMedium, { color: theme.colors.textPrimary }]}>
            Type or Dictate Request
          </Text>
          <View
            style={[
              styles.tagPill,
              {
                backgroundColor: theme.colors.primaryMuted,
                borderColor: theme.colors.primaryDark,
              },
            ]}
          >
            <Text style={[styles.tagPillText, { color: theme.colors.primaryLight }]}>
              Stage 1 & 2 Engine
            </Text>
          </View>
        </View>

        <TextInput
          style={[
            styles.largeInput,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
            },
            theme.typography.bodyLarge,
          ]}
          multiline
          numberOfLines={5}
          placeholder="Enter a request in plain English (e.g. 'I paid ₹200 for lunch and need to send Rahul the report by 5 PM' or 'Remind me to call Mom tomorrow')..."
          placeholderTextColor={theme.colors.textMuted}
          value={inputText}
          onChangeText={(txt) => {
            setInputText(txt);
            if (errorMessage) setErrorMessage(null);
          }}
          editable={!isLoading}
          testID="input-screen-textarea"
        />

        {errorMessage ? (
          <ErrorState message={errorMessage} onRetry={onAnalyze} />
        ) : null}

        {/* Action Controls */}
        <View style={[styles.actionControlsRow, { marginTop: theme.spacing.md }]}>
          {inputText.trim() ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={onClear}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textTertiary }]}>
                Clear
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          <View style={styles.rightButtonsRow}>
            <TouchableOpacity
              style={[
                styles.micButton,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
              onPress={onOpenVoiceModal}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
                🎙️ Speak
              </Text>
            </TouchableOpacity>

            <PrimaryButton
              label="Analyze & Plan"
              icon="⚡"
              onPress={onAnalyze}
              isLoading={isLoading}
              disabled={!inputText.trim()}
              size="md"
              testID="input-screen-send-btn"
            />
          </View>
        </View>
      </View>

      {/* Quick Suggestion Chips */}
      <View style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: 8 }]}>
          Sample Requests (Tap to prefill)
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shortcutsRow}
        >
          {QUICK_SHORTCUTS.map((shortcut, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.shortcutChip,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.pill,
                },
              ]}
              onPress={() => handleSelectShortcut(shortcut)}
              activeOpacity={0.7}
            >
              <Text style={styles.shortcutIcon}>{shortcut.icon}</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                {shortcut.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Analysis Results View */}
      {analysisResult ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <SectionHeader
            title="Understanding & Action Plan"
            badge={analysisResult.analysis.intents.length}
            actionLabel={showTechnicalDetails ? 'Hide JSON ▲' : 'Show Details ▼'}
            onAction={() => setShowTechnicalDetails(!showTechnicalDetails)}
          />

          {/* Supervisor Decision */}
          {actionPlan && (
            <View
              style={[
                styles.decisionCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.sm,
                },
              ]}
            >
              <View style={styles.decisionHeader}>
                <View>
                  <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                    SUPERVISOR DECISION
                  </Text>
                  <Text style={[theme.typography.titleMedium, { color: theme.colors.textPrimary, marginTop: 2 }]}>
                    Workflow Status
                  </Text>
                </View>
                <StatusBadge status={actionPlan.decision.workflow_status} size="md" />
              </View>

              <View style={{ marginTop: theme.spacing.xs }}>
                {actionPlan.decision.reasons.map((reason, idx) => (
                  <Text
                    key={idx}
                    style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}
                  >
                    • {reason}
                  </Text>
                ))}
              </View>

              {actionPlan.decision.clarification_questions.length > 0 && (
                <View
                  style={[
                    styles.clarifyBanner,
                    {
                      backgroundColor: theme.colors.warningSurface,
                      borderColor: theme.colors.warningBorder,
                      borderRadius: theme.radii.xs,
                      marginTop: theme.spacing.sm,
                    },
                  ]}
                >
                  <Text style={[theme.typography.caption, { color: theme.colors.warningForeground, fontWeight: '700' }]}>
                    ❓ Clarification Required:
                  </Text>
                  {actionPlan.decision.clarification_questions.map((q, idx) => (
                    <Text
                      key={idx}
                      style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, marginTop: 2 }]}
                    >
                      👉 {q}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 1. What LifeOS Understood */}
          <View style={{ marginTop: theme.spacing.xs }}>
            <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: 4 }]}>
              1. What LifeOS Understood ({analysisResult.analysis.intents.length} Intent{analysisResult.analysis.intents.length === 1 ? '' : 's'})
            </Text>
            {analysisResult.analysis.intents.map((item) => (
              <IntentCard key={item.sequence} item={item} />
            ))}
          </View>

          {/* 2. Proposed Actions */}
          {actionPlan && (
            <View style={{ marginTop: theme.spacing.sm }}>
              <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: 4 }]}>
                2. Proposed Actions Graph ({actionPlan.actions.length})
              </Text>
              {actionPlan.actions.length === 0 ? (
                <EmptyState
                  title="No Actions Dispatched"
                  description="No background execution required for this request."
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

          {/* Collapsible Technical Details */}
          {showTechnicalDetails && (
            <View
              style={[
                styles.techBox,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                  padding: theme.spacing.md,
                  marginTop: theme.spacing.md,
                },
              ]}
            >
              <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginBottom: 6 }]}>
                IntentAnalysis Audit JSON
              </Text>
              <Text style={[theme.typography.code, { color: theme.colors.textTertiary }]}>
                {JSON.stringify(analysisResult.analysis, null, 2)}
              </Text>

              {actionPlan && (
                <>
                  <Text
                    style={[
                      theme.typography.label,
                      { color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
                    ]}
                  >
                    ActionPlan Audit JSON
                  </Text>
                  <Text style={[theme.typography.code, { color: theme.colors.textTertiary }]}>
                    {JSON.stringify(actionPlan, null, 2)}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  inputCard: {
    borderWidth: 1,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  largeInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  actionControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rightButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  micButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutsRow: {
    gap: 8,
    paddingRight: 10,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    gap: 6,
  },
  shortcutIcon: {
    fontSize: 13,
  },
  decisionCard: {
    borderWidth: 1,
  },
  decisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clarifyBanner: {
    padding: 8,
    borderWidth: 1,
  },
  techBox: {
    borderWidth: 1,
  },
});
