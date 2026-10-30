import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IdentificationResult } from '../../intent/identifier';
import { ActionPlan } from '../../models/ActionPlan';

interface ResultsSectionProps {
  analysisResult: IdentificationResult;
  actionPlan?: ActionPlan;
}

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  analysisResult,
  actionPlan,
}) => {
  const [showAnalysisJson, setShowAnalysisJson] = useState<boolean>(false);
  const [showPlanJson, setShowPlanJson] = useState<boolean>(false);

  const { analysis, method, warning, executionTimeMs } = analysisResult;

  const renderWorkflowStatusBadge = (status?: string) => {
    switch (status) {
      case 'ready':
        return (
          <View style={[styles.statusBadge, styles.statusReady]}>
            <Text style={styles.statusBadgeText}>✓ READY</Text>
          </View>
        );
      case 'partial':
        return (
          <View style={[styles.statusBadge, styles.statusPartial]}>
            <Text style={styles.statusBadgeText}>⚡ PARTIAL (MIXED)</Text>
          </View>
        );
      case 'needs_clarification':
        return (
          <View style={[styles.statusBadge, styles.statusClarify]}>
            <Text style={styles.statusBadgeText}>❓ NEEDS CLARIFICATION</Text>
          </View>
        );
      case 'unsupported':
        return (
          <View style={[styles.statusBadge, styles.statusUnsupported]}>
            <Text style={styles.statusBadgeText}>🚫 UNSUPPORTED CAPABILITY</Text>
          </View>
        );
      case 'rejected':
      default:
        return (
          <View style={[styles.statusBadge, styles.statusRejected]}>
            <Text style={styles.statusBadgeText}>❌ REJECTED / UNRECOGNIZED</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* ───────────────────────────────────────────────────────── */}
      {/* STAGE 1: INTENT UNDERSTANDING                             */}
      {/* ───────────────────────────────────────────────────────── */}
      <View style={styles.stageHeader}>
        <Text style={styles.stageTitle}>Stage 1: Intent Understanding</Text>
        <View style={styles.engineBadge}>
          <Text style={styles.engineBadgeText}>⚙️ LOCAL RULE-BASED</Text>
        </View>
      </View>

      {warning ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Parser Notice:</Text>
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : null}

      {/* A. Original Input */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>A. Captured Input Event</Text>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Raw Input:</Text>
          <Text style={[styles.fieldValue, styles.rawInputText]}>"{analysis.source.raw_input}"</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Source Type:</Text>
          <Text style={styles.fieldValue}>{analysis.source.type.toUpperCase()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Request ID:</Text>
          <Text style={[styles.fieldValue, styles.codeText]}>{analysis.request_id}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Timestamp:</Text>
          <Text style={styles.fieldValue}>{analysis.source.timestamp}</Text>
        </View>
        {executionTimeMs !== undefined && (
          <View style={styles.row}>
            <Text style={styles.fieldLabel}>Latency:</Text>
            <Text style={styles.fieldValue}>{executionTimeMs} ms (Local processing)</Text>
          </View>
        )}
      </View>

      {/* B. Unsupported Components (if any) */}
      {analysis.unsupported_components && analysis.unsupported_components.length > 0 && (
        <View style={[styles.card, styles.unsupportedCard]}>
          <Text style={styles.unsupportedTitle}>🚫 Unsupported Capability Detected</Text>
          {analysis.unsupported_components.map((un, idx) => (
            <View key={idx} style={styles.unsupportedItem}>
              <Text style={styles.unsupportedCapability}>
                Requested: <Text style={styles.boldText}>{un.capability}</Text>
              </Text>
              <Text style={styles.unsupportedReason}>{un.reason}</Text>
            </View>
          ))}
        </View>
      )}

      {/* C. Unrecognized Input (if any) */}
      {analysis.unrecognized_components && analysis.unrecognized_components.length > 0 && (
        <View style={[styles.card, styles.unrecognizedCard]}>
          <Text style={styles.unrecognizedTitle}>❓ Unrecognized Input</Text>
          <Text style={styles.unrecognizedDesc}>
            The system could not identify a supported action for:
          </Text>
          {analysis.unrecognized_components.map((text, idx) => (
            <Text key={idx} style={styles.unrecognizedText}>
              • "{text}"
            </Text>
          ))}
          <Text style={styles.rephraseTip}>
            Tip: Try phrasing as a reminder, task, planned payment, or calendar meeting.
          </Text>
        </View>
      )}

      {/* D. Detected Intents */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>
            B. Detected Intents ({analysis.intents.length})
          </Text>
          <Text style={styles.boundaryBadge}>No Agent Mappings in Stage 1</Text>
        </View>

        {analysis.intents.length === 0 ? (
          <Text style={styles.emptyText}>No supported intents detected.</Text>
        ) : (
          analysis.intents.map((item) => {
            const entityEntries = Object.entries(item.entities || {});
            return (
              <View key={item.sequence} style={styles.intentCard}>
                <View style={styles.intentHeader}>
                  <View style={styles.seqBadge}>
                    <Text style={styles.seqText}>#{item.sequence}</Text>
                  </View>
                  <View style={styles.intentBadge}>
                    <Text style={styles.intentBadgeText}>{item.intent}</Text>
                  </View>
                  <View style={styles.confidenceRow}>
                    <Text style={styles.confidenceValue}>
                      {(item.confidence * 100).toFixed(0)}% ({item.confidence.toFixed(2)})
                    </Text>
                    <Text style={styles.confidenceNote}>(model-reported)</Text>
                  </View>
                </View>

                {/* Segment text */}
                {item.raw_segment ? (
                  <View style={styles.segmentRow}>
                    <Text style={styles.segmentLabel}>Clause:</Text>
                    <Text style={styles.segmentText}>"{item.raw_segment}"</Text>
                  </View>
                ) : null}

                {/* Canonical Entities */}
                <View style={styles.entitiesBlock}>
                  <Text style={styles.blockTitle}>Canonical Entities:</Text>
                  {entityEntries.length === 0 ? (
                    <Text style={styles.emptyText}>No entities extracted.</Text>
                  ) : (
                    entityEntries.map(([key, val]) => (
                      <View key={key} style={styles.entityRow}>
                        <Text style={styles.entityKey}>{key}:</Text>
                        <Text style={styles.entityVal}>
                          {typeof val === 'object' && val !== null
                            ? JSON.stringify(val)
                            : String(val)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Missing required entities */}
                <View style={styles.missingBlock}>
                  <Text style={styles.blockTitle}>Missing Required Entities:</Text>
                  {item.missing.length === 0 ? (
                    <Text style={styles.completeText}>✓ All required entities present.</Text>
                  ) : (
                    <View style={styles.missingList}>
                      {item.missing.map((field) => (
                        <Text key={field} style={styles.missingFieldText}>
                          • <Text style={styles.boldMissingField}>{field}</Text>
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* E. Ordering Hints */}
      {analysis.ordering_hints && analysis.ordering_hints.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>C. Explicit Ordering Hints</Text>
          {analysis.ordering_hints.map((hint, idx) => (
            <View key={idx} style={styles.hintRow}>
              <Text style={styles.hintText}>
                Sequence <Text style={styles.boldText}>#{hint.from_sequence}</Text> runs before
                Sequence <Text style={styles.boldText}>#{hint.to_sequence}</Text> (Relationship:{' '}
                <Text style={styles.relationBadge}>{hint.relationship.toUpperCase()}</Text>)
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Toggle IntentAnalysis JSON */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>IntentAnalysis JSON</Text>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowAnalysisJson(!showAnalysisJson)}
          >
            <Text style={styles.toggleButtonText}>
              {showAnalysisJson ? 'Hide JSON ▲' : 'View JSON ▼'}
            </Text>
          </TouchableOpacity>
        </View>

        {showAnalysisJson && (
          <View style={styles.jsonContainer}>
            <ScrollView horizontal style={styles.jsonScrollHorizontal}>
              <ScrollView nestedScrollEnabled style={styles.jsonScrollVertical}>
                <Text style={styles.jsonText}>{JSON.stringify(analysis, null, 2)}</Text>
              </ScrollView>
            </ScrollView>
          </View>
        )}
      </View>

      {/* ───────────────────────────────────────────────────────── */}
      {/* STAGE 2: SUPERVISOR AGENT & ACTION PLAN                   */}
      {/* ───────────────────────────────────────────────────────── */}
      {actionPlan && (
        <View style={styles.stageTwoContainer}>
          <View style={styles.stageHeader}>
            <Text style={styles.stageTitle}>Stage 2: Supervisor Orchestration</Text>
            {renderWorkflowStatusBadge(actionPlan.decision.workflow_status)}
          </View>

          {/* Supervisor Decision & Reasons */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Supervisor Evaluation</Text>
            {actionPlan.decision.reasons.map((r, idx) => (
              <Text key={idx} style={styles.decisionReason}>
                • {r}
              </Text>
            ))}

            {/* Clarification Prompts (if any action needs clarification) */}
            {actionPlan.decision.clarification_questions.length > 0 && (
              <View style={styles.clarificationBox}>
                <Text style={styles.clarificationTitle}>
                  ❓ User Clarification Required:
                </Text>
                {actionPlan.decision.clarification_questions.map((q, idx) => (
                  <Text key={idx} style={styles.clarificationQuestion}>
                    👉 {q}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* Selected Agents & Proposed Actions */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>
                Proposed Actions ({actionPlan.actions.length})
              </Text>
              <Text style={styles.proposalNote}>Action Graph Proposal</Text>
            </View>

            {actionPlan.actions.length === 0 ? (
              <Text style={styles.emptyText}>
                No actions dispatched for this request.
              </Text>
            ) : (
              actionPlan.actions.map((act) => (
                <View key={act.action_id} style={styles.actionBox}>
                  <View style={styles.actionHeader}>
                    <Text style={styles.actionId}>{act.action_id}</Text>
                    <View style={styles.actionBadges}>
                      {act.requires_confirmation && (
                        <View style={styles.confirmBadge}>
                          <Text style={styles.confirmBadgeText}>⚠️ CONFIRMATION REQ</Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.actionStatusBadge,
                          act.status === 'ready'
                            ? styles.statusBadgeReady
                            : act.status === 'blocked'
                            ? styles.statusBadgeBlocked
                            : styles.statusBadgeClarify,
                        ]}
                      >
                        <Text style={styles.actionStatusText}>{act.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.actionFieldLabel}>Agent:</Text>
                    <Text style={styles.actionAgent}>{act.agent}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.actionFieldLabel}>Operation:</Text>
                    <Text style={styles.actionOperation}>{act.operation}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.actionFieldLabel}>Depends On:</Text>
                    <Text style={styles.actionFieldVal}>
                      {act.depends_on.length > 0 ? act.depends_on.join(', ') : 'None (Root Action)'}
                    </Text>
                  </View>

                  {act.clarification_prompt ? (
                    <View style={styles.actionClarifyBox}>
                      <Text style={styles.actionClarifyText}>
                        Clarification: {act.clarification_prompt}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.actionDataBox}>
                    <Text style={styles.actionDataLabel}>Typed Payload Data:</Text>
                    <Text style={styles.actionDataJson}>
                      {JSON.stringify(act.data, null, 2)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Toggle ActionPlan JSON */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>ActionPlan JSON</Text>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setShowPlanJson(!showPlanJson)}
              >
                <Text style={styles.toggleButtonText}>
                  {showPlanJson ? 'Hide Plan JSON ▲' : 'View Plan JSON ▼'}
                </Text>
              </TouchableOpacity>
            </View>

            {showPlanJson && (
              <View style={styles.jsonContainer}>
                <ScrollView horizontal style={styles.jsonScrollHorizontal}>
                  <ScrollView nestedScrollEnabled style={styles.jsonScrollVertical}>
                    <Text style={styles.jsonText}>{JSON.stringify(actionPlan, null, 2)}</Text>
                  </ScrollView>
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 30,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#38bdf8',
  },
  engineBadge: {
    backgroundColor: '#065f46',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  engineBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
  },
  warningBox: {
    backgroundColor: '#451a03',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  warningTitle: {
    color: '#fdba74',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  warningText: {
    color: '#ffedd5',
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  unsupportedCard: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
  },
  unsupportedTitle: {
    color: '#fb923c',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  unsupportedItem: {
    marginBottom: 6,
  },
  unsupportedCapability: {
    color: '#fed7aa',
    fontSize: 12,
  },
  unsupportedReason: {
    color: '#fdba74',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  unrecognizedCard: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  unrecognizedTitle: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  unrecognizedDesc: {
    color: '#fca5a5',
    fontSize: 12,
  },
  unrecognizedText: {
    color: '#fee2e2',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  rephraseTip: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 6,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  boundaryBadge: {
    fontSize: 9,
    color: '#a78bfa',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  fieldLabel: {
    width: 120,
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  fieldValue: {
    flex: 1,
    fontSize: 12,
    color: '#f8fafc',
  },
  rawInputText: {
    fontStyle: 'italic',
    color: '#e2e8f0',
  },
  codeText: {
    fontFamily: 'monospace',
    color: '#a5f3fc',
    fontSize: 11,
  },
  intentCard: {
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  intentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 6,
    marginBottom: 6,
  },
  seqBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  seqText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '700',
  },
  intentBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  intentBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34d399',
  },
  confidenceNote: {
    fontSize: 9,
    color: '#64748b',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#0b1120',
    padding: 6,
    borderRadius: 4,
    marginBottom: 6,
  },
  segmentLabel: {
    fontSize: 11,
    color: '#94a3b8',
    width: 60,
  },
  segmentText: {
    flex: 1,
    fontSize: 11,
    color: '#cbd5e1',
    fontStyle: 'italic',
  },
  entitiesBlock: {
    marginBottom: 6,
  },
  blockTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  entityRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  entityKey: {
    width: 110,
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  entityVal: {
    flex: 1,
    fontSize: 11,
    color: '#f8fafc',
  },
  missingBlock: {
    marginTop: 2,
  },
  completeText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '600',
  },
  missingList: {
    marginTop: 2,
  },
  missingFieldText: {
    color: '#fde68a',
    fontSize: 11,
    lineHeight: 16,
  },
  boldMissingField: {
    fontWeight: '700',
    color: '#ffffff',
  },
  hintRow: {
    backgroundColor: '#020617',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  hintText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  boldText: {
    fontWeight: '700',
    color: '#f8fafc',
  },
  relationBadge: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  stageTwoContainer: {
    marginTop: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusReady: {
    backgroundColor: '#065f46',
  },
  statusPartial: {
    backgroundColor: '#78350f',
  },
  statusClarify: {
    backgroundColor: '#9a3412',
  },
  statusUnsupported: {
    backgroundColor: '#7f1d1d',
  },
  statusRejected: {
    backgroundColor: '#450a0a',
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  decisionReason: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
  },
  clarificationBox: {
    marginTop: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  clarificationTitle: {
    color: '#fcd34d',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  clarificationQuestion: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  proposalNote: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actionBox: {
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 4,
  },
  actionId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
    fontFamily: 'monospace',
  },
  actionBadges: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  confirmBadge: {
    backgroundColor: '#7c2d12',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confirmBadgeText: {
    color: '#fed7aa',
    fontSize: 9,
    fontWeight: '700',
  },
  actionStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeReady: {
    backgroundColor: '#065f46',
  },
  statusBadgeBlocked: {
    backgroundColor: '#7f1d1d',
  },
  statusBadgeClarify: {
    backgroundColor: '#9a3412',
  },
  actionStatusText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  actionFieldLabel: {
    width: 90,
    fontSize: 11,
    color: '#94a3b8',
  },
  actionAgent: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a78bfa',
  },
  actionOperation: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34d399',
  },
  actionFieldVal: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  actionClarifyBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
  },
  actionClarifyText: {
    color: '#fcd34d',
    fontSize: 11,
  },
  actionDataBox: {
    marginTop: 4,
    backgroundColor: '#0b1120',
    padding: 6,
    borderRadius: 4,
  },
  actionDataLabel: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 2,
  },
  actionDataJson: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  toggleButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
  },
  toggleButtonText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  jsonContainer: {
    backgroundColor: '#020617',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  jsonScrollHorizontal: {
    maxHeight: 280,
  },
  jsonScrollVertical: {
    maxHeight: 280,
  },
  jsonText: {
    fontFamily: 'monospace',
    color: '#a5f3fc',
    fontSize: 11,
    lineHeight: 16,
  },
});
