import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { defaultAgentDispatcher } from '../../agents/agentRegistry';
import { defaultReminderAgent } from '../../agents/reminderAgent';
import { defaultReminderRepository, ReminderRecord } from '../../database/reminderRepository';
import { createTextInputEvent } from '../../input/inputCapture';
import { IdentificationResult } from '../../intent/identifier';
import { defaultIntentService } from '../../intent/intentService';
import { ActionPlan } from '../../models/ActionPlan';
import { AgentResult } from '../../models/AgentResult';
import { SupervisorAgent } from '../../supervisor/supervisor';
import { Header } from '../components/Header';
import { ResultsSection } from '../components/ResultsSection';
import { SampleChips } from '../components/SampleChips';
import { ScheduledRemindersList } from '../components/ScheduledRemindersList';
import { TextInputSection } from '../components/TextInputSection';

const supervisor = new SupervisorAgent(0.6);

export const MainScreen: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<IdentificationResult | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [executionResults, setExecutionResults] = useState<AgentResult[] | null>(null);
  const [scheduledReminders, setScheduledReminders] = useState<ReminderRecord[]>([]);

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      const list = await defaultReminderRepository.getAllScheduled();
      setScheduledReminders(list);
    } catch (err) {
      console.warn('[MainScreen] Failed to load reminders from SQLite:', err);
    }
  };

  const handleSelectSample = (sample: string) => {
    setInputText(sample);
    setErrorMessage(null);
  };

  const handleClear = () => {
    setInputText('');
    setErrorMessage(null);
    setAnalysisResult(null);
    setActionPlan(null);
    setExecutionResults(null);
  };

  const handleCancelReminder = async (reminderId: string) => {
    try {
      await defaultReminderAgent.cancel(reminderId);
      await loadReminders();
    } catch (err: unknown) {
      setErrorMessage(`Failed to cancel reminder: ${(err as Error).message}`);
    }
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
      // 1. Create normalized InputEvent
      const inputEvent = createTextInputEvent(trimmed);

      // 2. Stage 1: Local Intent Understanding (100% deterministic & offline)
      const idResult = await defaultIntentService.identify(inputEvent);
      setAnalysisResult(idResult);

      // 3. Stage 2: Supervisor Orchestration & ActionPlan Generation
      const plan = supervisor.plan(idResult.analysis);
      setActionPlan(plan);

      // 4. Stage 3: Agent Dispatch & Local Notification Scheduling
      const results = await defaultAgentDispatcher.dispatch(plan);
      setExecutionResults(results);

      // 5. Refresh SQLite scheduled reminders list
      await loadReminders();
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to process request';
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
          <Header />

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
            onClear={handleClear}
            errorMessage={errorMessage}
          />

          {/* Active Scheduled Reminders (Persistent from SQLite) */}
          <ScheduledRemindersList
            reminders={scheduledReminders}
            onCancelReminder={handleCancelReminder}
          />

          {/* Results: Stage 1 (Intent) + Stage 2 (Supervisor) + Stage 3 (Execution) */}
          {analysisResult && (
            <ResultsSection
              analysisResult={analysisResult}
              actionPlan={actionPlan || undefined}
              executionResults={executionResults || undefined}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
