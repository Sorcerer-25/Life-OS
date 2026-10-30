import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IdentificationResult } from '../../intent/identifier';

interface ResultsSectionProps {
  result: IdentificationResult;
}

export const ResultsSection: React.FC<ResultsSectionProps> = ({ result }) => {
  const [showJson, setShowJson] = useState<boolean>(false);
  const { plan, method, warning, executionTimeMs } = result;

  const renderMethodBadge = () => {
    switch (method) {
      case 'llm':
        return (
          <View style={[styles.methodBadge, styles.badgeLlm]}>
            <Text style={styles.badgeText}>🤖 LLM (Gemini)</Text>
          </View>
        );
      case 'rule_based':
        return (
          <View style={[styles.methodBadge, styles.badgeRule]}>
            <Text style={styles.badgeText}>⚡ Rule-Based</Text>
          </View>
        );
      case 'fallback_rule_based':
        return (
          <View style={[styles.methodBadge, styles.badgeFallback]}>
            <Text style={styles.badgeText}>🔄 Rule Fallback (LLM Unavailable)</Text>
          </View>
        );
    }
  };

  const entityEntries = Object.entries(plan.entities || {});

  return (
    <View style={styles.container}>
      <View style={styles.mainHeader}>
        <Text style={styles.mainTitle}>Identification Results</Text>
        {renderMethodBadge()}
      </View>

      {warning ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Engine Notice:</Text>
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : null}

      {/* A. Original Input */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>A. Original Input</Text>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Raw Input:</Text>
          <Text style={[styles.fieldValue, styles.rawInputText]}>"{plan.source.raw_input}"</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Source Type:</Text>
          <Text style={styles.fieldValue}>{plan.source.type.toUpperCase()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Request ID:</Text>
          <Text style={[styles.fieldValue, styles.codeText]}>{plan.request_id}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Timestamp:</Text>
          <Text style={styles.fieldValue}>{plan.source.timestamp}</Text>
        </View>
        {executionTimeMs !== undefined && (
          <View style={styles.row}>
            <Text style={styles.fieldLabel}>Processing Time:</Text>
            <Text style={styles.fieldValue}>{executionTimeMs} ms</Text>
          </View>
        )}
      </View>

      {/* B. Identified Intent */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>B. Identified Intent</Text>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Intent Name:</Text>
          <View style={styles.intentBadge}>
            <Text style={styles.intentBadgeText}>{plan.intent}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Confidence:</Text>
          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceValue}>
              {(plan.confidence * 100).toFixed(0)}% ({plan.confidence.toFixed(2)})
            </Text>
            <Text style={styles.confidenceNote}>(model-reported)</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.fieldLabel}>Identification Method:</Text>
          <Text style={styles.fieldValue}>
            {method === 'llm'
              ? 'LLM Model Generation'
              : method === 'fallback_rule_based'
              ? 'Automatic Rule-Based Fallback'
              : 'Deterministic Rule Engine'}
          </Text>
        </View>
      </View>

      {/* C. Extracted Entities */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>C. Extracted Entities</Text>
        {entityEntries.length === 0 ? (
          <Text style={styles.emptyText}>No entities extracted.</Text>
        ) : (
          entityEntries.map(([key, val]) => (
            <View key={key} style={styles.entityRow}>
              <Text style={styles.entityKey}>{key}:</Text>
              <Text style={styles.entityVal}>
                {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* D. Required Agents */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>D. Required Agents</Text>
        {plan.required_agents.length === 0 ? (
          <Text style={styles.emptyText}>None selected (unresolved / no actions).</Text>
        ) : (
          <View style={styles.agentTagContainer}>
            {plan.required_agents.map((agent) => (
              <View key={agent} style={styles.agentTag}>
                <Text style={styles.agentTagText}>🤖 {agent}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* E. Proposed Actions */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>E. Proposed Actions</Text>
          <Text style={styles.proposalNote}>Proposal Only (Not Dispatched)</Text>
        </View>
        {plan.actions.length === 0 ? (
          <Text style={styles.emptyText}>No actions proposed for this intent.</Text>
        ) : (
          plan.actions.map((act) => (
            <View key={act.action_id} style={styles.actionBox}>
              <View style={styles.actionHeader}>
                <Text style={styles.actionId}>{act.action_id}</Text>
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
              <View style={styles.actionDataBox}>
                <Text style={styles.actionDataLabel}>Action Data:</Text>
                <Text style={styles.actionDataJson}>
                  {JSON.stringify(act.data, null, 2)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* F. Missing Information */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>F. Missing Information</Text>
        {plan.missing_fields.length === 0 ? (
          <View style={styles.completeBox}>
            <Text style={styles.completeText}>✓ All required fields are present.</Text>
          </View>
        ) : (
          <View style={styles.missingBox}>
            <Text style={styles.missingWarningTitle}>
              Needs Additional Details ({plan.missing_fields.length} missing):
            </Text>
            {plan.missing_fields.map((f) => (
              <Text key={f} style={styles.missingFieldItem}>
                • <Text style={styles.boldMissingField}>{f}</Text>
                {getMissingFieldExplanation(f)}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* G. ActionPlan JSON */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>G. ActionPlan JSON</Text>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowJson(!showJson)}
          >
            <Text style={styles.toggleButtonText}>
              {showJson ? 'Hide JSON ▲' : 'View Plan JSON ▼'}
            </Text>
          </TouchableOpacity>
        </View>

        {showJson && (
          <View style={styles.jsonContainer}>
            <ScrollView horizontal style={styles.jsonScrollHorizontal}>
              <ScrollView nestedScrollEnabled style={styles.jsonScrollVertical}>
                <Text style={styles.jsonText}>{JSON.stringify(plan, null, 2)}</Text>
              </ScrollView>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
};

function getMissingFieldExplanation(field: string): string {
  switch (field) {
    case 'due_date':
    case 'date':
      return ': A specific date (e.g. tomorrow, Friday, 2026-10-28) is needed.';
    case 'time':
      return ': A specific time of day (e.g. 3 PM, 15:00) is required.';
    case 'amount':
      return ': Monetary amount (e.g. ₹1200) was not specified.';
    case 'bill_type':
      return ': Type of utility or bill (e.g. electricity, internet, water) is missing.';
    case 'duration':
      return ': Meeting/event duration was not specified.';
    case 'action_clarification':
      return ': The input reports a state (e.g. pending payment) without specifying an intended action.';
    case 'intent_clarification':
      return ': Could not determine intent from input text.';
    default:
      return `: Required parameter '${field}' is not provided.`;
  }
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 30,
  },
  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  methodBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeLlm: {
    backgroundColor: '#065f46',
  },
  badgeRule: {
    backgroundColor: '#1e3a8a',
  },
  badgeFallback: {
    backgroundColor: '#9a3412',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    width: 130,
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  fieldValue: {
    flex: 1,
    fontSize: 13,
    color: '#f8fafc',
  },
  rawInputText: {
    fontStyle: 'italic',
    color: '#e2e8f0',
  },
  codeText: {
    fontFamily: 'monospace',
    color: '#a5f3fc',
    fontSize: 12,
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
    fontSize: 13,
    fontWeight: '700',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confidenceValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34d399',
  },
  confidenceNote: {
    fontSize: 11,
    color: '#64748b',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  entityRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  entityKey: {
    width: 120,
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  entityVal: {
    flex: 1,
    fontSize: 12,
    color: '#f8fafc',
  },
  agentTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  agentTag: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  agentTagText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600',
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
  actionAgent: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a78bfa',
  },
  actionFieldLabel: {
    width: 100,
    fontSize: 11,
    color: '#94a3b8',
  },
  actionOperation: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34d399',
  },
  actionFieldVal: {
    fontSize: 11,
    color: '#cbd5e1',
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
  completeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  completeText: {
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: '600',
  },
  missingBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  missingWarningTitle: {
    color: '#fcd34d',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  missingFieldItem: {
    color: '#fde68a',
    fontSize: 12,
    lineHeight: 18,
  },
  boldMissingField: {
    fontWeight: '700',
    color: '#ffffff',
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

