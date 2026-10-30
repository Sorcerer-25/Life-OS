import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Config } from '../../config/environment';
import { createTextInputEvent } from '../../input/inputCapture';
import { IdentificationResult } from '../../intent/identifier';
import { defaultIntentService, IntentEngineMode } from '../../intent/intentService';
import { Header } from '../components/Header';
import { ResultsSection } from '../components/ResultsSection';
import { SampleChips } from '../components/SampleChips';
import { TextInputSection } from '../components/TextInputSection';

export const MainScreen: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<IdentificationResult | null>(null);
  const [engineMode, setEngineMode] = useState<IntentEngineMode>('auto');

  // API Key config modal state
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(Config.getGeminiApiKey() || '');

  const handleSelectSample = (sample: string) => {
    setInputText(sample);
    setErrorMessage(null);
  };

  const handleClear = () => {
    setInputText('');
    setErrorMessage(null);
  };

  const handleAnalyze = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a request to analyze.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Create normalized InputEvent (Step 1 model)
      const inputEvent = createTextInputEvent(trimmed);

      // 2. Configure engine mode
      defaultIntentService.setMode(engineMode);

      // 3. Process with Intent Identifier (LLM with rule fallback or rules only)
      const identificationResult = await defaultIntentService.identify(inputEvent);

      setResult(identificationResult);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to identify intent';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = () => {
    Config.setGeminiApiKey(apiKeyInput);
    setShowConfigModal(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with Engine Status */}
          <Header
            mode={engineMode}
            isLlmActive={Config.isLlmConfigured() && engineMode !== 'rules_only'}
          />

          {/* Quick Config Row */}
          <View style={styles.configBar}>
            <Text style={styles.configBarText}>
              Gemini API Key:{' '}
              {Config.isLlmConfigured() ? (
                <Text style={styles.keyActive}>Configured ✓</Text>
              ) : (
                <Text style={styles.keyMissing}>Not Set (Rule Fallback active)</Text>
              )}
            </Text>
            <TouchableOpacity
              style={styles.configButton}
              onPress={() => setShowConfigModal(true)}
            >
              <Text style={styles.configButtonText}>⚙️ Configure Key</Text>
            </TouchableOpacity>
          </View>

          {/* Test Acceptance Sample Chips */}
          <SampleChips onSelectSample={handleSelectSample} />

          {/* Natural Language Text Input Section */}
          <TextInputSection
            inputText={inputText}
            onChangeText={(txt) => {
              setInputText(txt);
              if (errorMessage) setErrorMessage(null);
            }}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            engineMode={engineMode}
            onChangeEngineMode={(m) => setEngineMode(m)}
            onClear={handleClear}
            errorMessage={errorMessage}
          />

          {/* Identification Results Section */}
          {result && <ResultsSection result={result} />}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* API Key Modal for easy demo testing */}
      <Modal
        visible={showConfigModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfigModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Configure Gemini API Key</Text>
            <Text style={styles.modalDesc}>
              Enter a Google Gemini API key to test live LLM classification. If left empty,
              LifeOS automatically uses the rule-based fallback engine.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Paste AI Studio API Key (AIzaSy...)"
              placeholderTextColor="#64748b"
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowConfigModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSaveApiKey}>
                <Text style={styles.modalSaveText}>Save Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  configBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0b1120',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 8,
  },
  configBarText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  keyActive: {
    color: '#34d399',
    fontWeight: '700',
  },
  keyMissing: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  configButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1e293b',
    borderRadius: 6,
  },
  configButtonText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#020617',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#38bdf8',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  modalSave: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalSaveText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
});
