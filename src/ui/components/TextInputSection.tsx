import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { IntentEngineMode } from '../../intent/intentService';

interface TextInputSectionProps {
  inputText: string;
  onChangeText: (text: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  engineMode: IntentEngineMode;
  onChangeEngineMode: (mode: IntentEngineMode) => void;
  onClear: () => void;
  errorMessage?: string | null;
}

export const TextInputSection: React.FC<TextInputSectionProps> = ({
  inputText,
  onChangeText,
  onAnalyze,
  isLoading,
  engineMode,
  onChangeEngineMode,
  onClear,
  errorMessage,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Natural Language Input</Text>
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, engineMode === 'auto' && styles.modeButtonActive]}
            onPress={() => onChangeEngineMode('auto')}
            disabled={isLoading}
          >
            <Text style={[styles.modeText, engineMode === 'auto' && styles.modeTextActive]}>
              Auto (LLM+Fallback)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, engineMode === 'rules_only' && styles.modeButtonActive]}
            onPress={() => onChangeEngineMode('rules_only')}
            disabled={isLoading}
          >
            <Text style={[styles.modeText, engineMode === 'rules_only' && styles.modeTextActive]}>
              Rules Only
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={styles.input}
        multiline
        numberOfLines={3}
        placeholder="Type a request (e.g. 'I spent ₹250 on lunch today', 'Remind me to pay bills')..."
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
              <Text style={styles.analyzeButtonTextLoading}>Analyzing...</Text>
            </View>
          ) : (
            <Text style={styles.analyzeButtonText}>⚡ Analyze Intent</Text>
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
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 0.3,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modeButtonActive: {
    backgroundColor: '#38bdf8',
  },
  modeText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#0f172a',
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
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
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
    marginTop: 12,
    gap: 12,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#1e293b',
  },
  analyzeButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  analyzeButtonTextLoading: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

