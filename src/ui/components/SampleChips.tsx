import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SampleChipsProps {
  onSelectSample: (text: string) => void;
}

export const SAMPLE_INPUTS = [
  'Remind me to submit my assignment tomorrow at 10 AM.',
  'I paid ₹200 for lunch and need to send Rahul the project report by 5 PM.',
  'I need to pay my electricity bill of ₹1200 tomorrow.',
  'Remind me about the payment.',
  'Find me the cheapest flight to Mumbai.',
  'I paid ₹300 for lunch and remind me about the payment.',
  'Remind me to call Rahul tomorrow and submit my assignment on Friday.',
  'Blue seven running quickly.',
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
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  scroll: {
    paddingRight: 10,
    gap: 8,
  },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: 280,
  },
  chipText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '500',
  },
});
