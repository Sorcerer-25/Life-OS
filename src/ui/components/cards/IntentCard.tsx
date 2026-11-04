import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { DetectedIntent } from '../../../models/IntentAnalysis';
import { useTheme } from '../../theme';

interface IntentCardProps {
  item: DetectedIntent;
  style?: ViewStyle;
}

export const IntentCard: React.FC<IntentCardProps> = ({ item, style }) => {
  const { theme } = useTheme();

  const entityEntries = Object.entries(item.entities || {});
  const confidencePercent = Math.round(item.confidence * 100);

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
      {/* Header: Sequence, Intent Name, Confidence */}
      <View style={styles.headerRow}>
        <View style={styles.leftGroup}>
          <View
            style={[
              styles.seqBadge,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.seqText, { color: theme.colors.textSecondary }]}>
              #{item.sequence}
            </Text>
          </View>

          <View
            style={[
              styles.intentBadge,
              {
                backgroundColor: theme.colors.primaryMuted,
                borderColor: theme.colors.primaryDark,
              },
            ]}
          >
            <Text style={[styles.intentBadgeText, { color: theme.colors.primaryLight }]}>
              {item.intent}
            </Text>
          </View>
        </View>

        <View style={styles.confidenceCol}>
          <Text style={[styles.confidenceValue, { color: theme.colors.successForeground }]}>
            {confidencePercent}%
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            confidence
          </Text>
        </View>
      </View>

      {/* Raw Segment / Clause */}
      {item.raw_segment ? (
        <View
          style={[
            styles.clauseBox,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderRadius: theme.radii.xs,
              marginTop: theme.spacing.xs,
            },
          ]}
        >
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            Matched clause:
          </Text>
          <Text
            style={[
              theme.typography.bodySmall,
              { color: theme.colors.textPrimary, fontStyle: 'italic', marginTop: 1 },
            ]}
          >
            "{item.raw_segment}"
          </Text>
        </View>
      ) : null}

      {/* Canonical Entities */}
      <View style={{ marginTop: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: 4 }]}>
          Canonical Entities
        </Text>
        {entityEntries.length === 0 ? (
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textMuted, fontStyle: 'italic' }]}>
            No entities extracted.
          </Text>
        ) : (
          <View
            style={[
              styles.entitiesGrid,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.borderSubtle,
                borderRadius: theme.radii.xs,
              },
            ]}
          >
            {entityEntries.map(([key, val]) => (
              <View key={key} style={styles.entityRow}>
                <Text style={[styles.entityKey, { color: theme.colors.textSecondary }]}>
                  {key}:
                </Text>
                <Text
                  style={[styles.entityVal, { color: theme.colors.textPrimary }]}
                  numberOfLines={2}
                >
                  {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Missing Required Entities Check */}
      <View style={{ marginTop: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: 4 }]}>
          Missing Required Entities
        </Text>
        {item.missing.length === 0 ? (
          <View style={styles.completeRow}>
            <Text style={[styles.checkmark, { color: theme.colors.success }]}>✓</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.successForeground, fontWeight: '700' }]}>
              All required fields present
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.missingBox,
              {
                backgroundColor: theme.colors.warningSurface,
                borderColor: theme.colors.warningBorder,
                borderRadius: theme.radii.xs,
              },
            ]}
          >
            {item.missing.map((field: string) => (
              <Text
                key={field}
                style={[theme.typography.caption, { color: theme.colors.warningForeground, fontWeight: '700' }]}
              >
                • Missing required: {field}
              </Text>
            ))}
          </View>
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
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seqBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  seqText: {
    fontSize: 10,
    fontWeight: '800',
  },
  intentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  intentBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  confidenceCol: {
    alignItems: 'flex-end',
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  clauseBox: {
    padding: 8,
  },
  entitiesGrid: {
    padding: 8,
    borderWidth: 1,
    gap: 3,
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  entityKey: {
    width: 100,
    fontSize: 11,
    fontWeight: '600',
  },
  entityVal: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  checkmark: {
    fontSize: 12,
    fontWeight: '800',
  },
  missingBox: {
    padding: 8,
    borderWidth: 1,
    gap: 2,
  },
});
