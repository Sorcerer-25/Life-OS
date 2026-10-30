import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface TextInputSectionProps {
  inputText: string;
  onChangeText: (text: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  onClear: () => void;
  errorMessage?: string | null;
}

export const TextInputSection: React.FC<TextInputSectionProps> = ({
  inputText,
  onChangeText,
  onAnalyze,
  isLoading,
  onClear,
  errorMessage,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Natural Language Input</Text>
        <View style={styles.modeTag}>
          <Text style={styles.modeTagText}>Deterministic Engine</Text>
        </View>
      </View>

      <TextInput
        style={styles.input}
        multiline
        numberOfLines={3}
        placeholder="Type a request (e.g. 'I paid ₹200 for lunch and need to send Rahul the report by 5 PM')..."
        placeholderTextColor="#64748b"
        value={inputText}
        onChangeText={onChangeText}
        editable={!isLoading}
      />

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={onClear}
          disabled={isLoading || !inputText.trim()}
        >
          <Text
            style={[
              styles.clearButtonText,
              (!inputText.trim() || isLoading) && styles.disabledText,
            ]}
          >
            Clear
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.analyzeButton, (!inputText.trim() || isLoading) && styles.buttonDisabled]}
          onPress={onAnalyze}
          disabled={isLoading || !inputText.trim()}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#0f172a" size="small" />
              <Text style={styles.analyzeButtonTextLoading}>Processing...</Text>
            </View>
          ) : (
            <Text style={styles.analyzeButtonText}>⚡ Analyze & Plan</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 0.3,
  },
  modeTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  modeTagText: {
    fontSize: 10,
    color: '#38bdf8',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#020617',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledText: {
    color: '#475569',
  },
  analyzeButton: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#1e293b',
  },
  analyzeButtonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  analyzeButtonTextLoading: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
