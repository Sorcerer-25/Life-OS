import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SampleChipsProps {
  onSelectSample: (text: string) => void;
}

export const SAMPLE_INPUTS = [
  'I spent ₹250 on lunch today.',
  'Remind me to pay the electricity bill tomorrow for ₹1200.',
  'Add a task to clean my room.',
  'Schedule a project review tomorrow at 3 PM.',
  'I need to pay my internet bill next Friday.',
  'I received a refund of ₹500 yesterday.',
  'My payment of ₹1200 is pending.',
  'Remind me about the bill.',
];

export const SampleChips: React.FC<SampleChipsProps> = ({ onSelectSample }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Test Acceptance Samples (Tap to fill):</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {SAMPLE_INPUTS.map((sample, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.chip}
            activeOpacity={0.7}
            onPress={() => onSelectSample(sample)}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {sample}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  scroll: {
    paddingRight: 10,
    gap: 8,
  },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: 260,
  },
  chipText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '500',
  },
});

