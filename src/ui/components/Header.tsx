import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const Header: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>LifeOS</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Phase 1.5A Prototype</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        Event-driven personal workflow orchestration. Deterministic local intent understanding and supervisor action planning.
      </Text>
      <View style={styles.statusRow}>
        <View style={styles.dot} />
        <Text style={styles.statusText}>
          Processing Mode: <Text style={styles.boldText}>LOCAL RULE-BASED</Text> (Offline & Fast)
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#cbd5e1',
  },
  boldText: {
    fontWeight: '700',
    color: '#34d399',
  },
});
