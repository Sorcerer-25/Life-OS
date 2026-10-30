import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface HeaderProps {
  mode: string;
  isLlmActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({ mode, isLlmActive }) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>LifeOS</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Phase 1 Prototype</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        Event-driven multi-agent workflow orchestration. Raw inputs are translated into standardized, explainable ActionPlans.
      </Text>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: isLlmActive ? '#10b981' : '#f59e0b' }]} />
        <Text style={styles.statusText}>
          Engine: <Text style={styles.boldText}>{mode.toUpperCase()}</Text>
          {isLlmActive ? ' (Gemini Active)' : ' (Rule Fallback Ready)'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  boldText: {
    fontWeight: '700',
    color: '#f8fafc',
  },
});

