import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { createTextInputEvent, createVoiceInputEvent } from '../../input/inputCapture';
import { IdentificationResult } from '../../intent/identifier';
import { defaultIntentService } from '../../intent/intentService';
import { ActionPlan } from '../../models/ActionPlan';
import { SupervisorAgent } from '../../supervisor/supervisor';
import { VoiceLanguage } from '../../voice/voiceService';
import { CalendarSettingsModal } from '../components/CalendarSettingsModal';
import { CreatedEventsModal } from '../components/CreatedEventsModal';
import { Header } from '../components/Header';
import { ResultsSection } from '../components/ResultsSection';
import { SampleChips } from '../components/SampleChips';
import { TextInputSection } from '../components/TextInputSection';
import { VoiceInputModal } from '../components/VoiceInputModal';

const supervisor = new SupervisorAgent(0.6);
const calendarAgent = new CalendarAgent();

export const MainScreen: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<IdentificationResult | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [showCalendarSettings, setShowCalendarSettings] = useState<boolean>(false);
  const [showCreatedEvents, setShowCreatedEvents] = useState<boolean>(false);
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);

  const handleSelectSample = (sample: string) => {
    setInputText(sample);
    setErrorMessage(null);
  };

  const handleClear = () => {
    setInputText('');
    setErrorMessage(null);
    setAnalysisResult(null);
    setActionPlan(null);
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
      // 1. Create normalized InputEvent for text
      const inputEvent = createTextInputEvent(trimmed);

      // 2. Stage 1: Local Intent Understanding (100% deterministic & offline)
      const idResult = await defaultIntentService.identify(inputEvent);
      setAnalysisResult(idResult);

      // 3. Stage 2: Supervisor Orchestration & ActionPlan Generation
      const plan = supervisor.plan(idResult.analysis);
      setActionPlan(plan);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to process request';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceSend = async (
    transcript: string,
    metadata: { language: VoiceLanguage; recognition_confidence?: number }
  ) => {
    const trimmed = transcript.trim();
    if (!trimmed) return;

    setInputText(trimmed);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Create normalized InputEvent for voice
      const inputEvent = createVoiceInputEvent({
        rawTranscript: trimmed,
        language: metadata.language,
        confidence: metadata.recognition_confidence,
      });

      // 2. Stage 1: Local Intent Understanding
      const idResult = await defaultIntentService.identify(inputEvent);
      setAnalysisResult(idResult);

      // 3. Stage 2: Supervisor Orchestration & ActionPlan Generation
      const plan = supervisor.plan(idResult.analysis);
      setActionPlan(plan);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to process voice request';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
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
          {/* Header */}
          <Header
            onOpenCalendarSettings={() => setShowCalendarSettings(true)}
            onOpenCreatedEvents={() => setShowCreatedEvents(true)}
          />

          {/* Test Acceptance Sample Chips */}
          <SampleChips onSelectSample={handleSelectSample} />

          {/* Natural Language Text & Voice Input Section */}
          <TextInputSection
            inputText={inputText}
            onChangeText={(txt) => {
              setInputText(txt);
              if (errorMessage) setErrorMessage(null);
            }}
            onAnalyze={handleAnalyze}
            onOpenVoiceModal={() => setShowVoiceModal(true)}
            isLoading={isLoading}
            onClear={handleClear}
            errorMessage={errorMessage}
          />

          {/* Results: Stage 1 (Intent Understanding) + Stage 2 (Supervisor & ActionPlan) */}
          {analysisResult && (
            <ResultsSection
              analysisResult={analysisResult}
              actionPlan={actionPlan || undefined}
              calendarAgent={calendarAgent}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Voice Recognition Modal */}
      <VoiceInputModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSendTranscript={handleVoiceSend}
      />

      {/* Calendar Settings Modal */}
      <CalendarSettingsModal
        visible={showCalendarSettings}
        onClose={() => setShowCalendarSettings(false)}
      />

      {/* Created Events & Management Modal */}
      <CreatedEventsModal
        visible={showCreatedEvents}
        onClose={() => setShowCreatedEvents(false)}
        calendarAgent={calendarAgent}
      />
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
});
