import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { IdentificationResult } from '../../intent/identifier';
import { ActionPlan } from '../../models/ActionPlan';
import { useTheme } from '../theme';
import { AppHeader } from '../components/core/AppHeader';
import { ErrorState } from '../components/core/ErrorState';
import { PrimaryButton } from '../components/core/PrimaryButton';
import { ScreenContainer } from '../components/core/ScreenContainer';
import { UnderstandingAndPlanView } from '../components/plan/UnderstandingAndPlanView';
import { QUICK_SHORTCUTS } from './HomeScreen';

interface InputScreenProps {
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  onAnalyze: () => void;
  onClear: () => void;
  onOpenVoiceModal: () => void;
  onOpenInbox?: () => void;
  analysisResult: IdentificationResult | null;
  actionPlan: ActionPlan | null;
  calendarAgent: CalendarAgent;
}

export const InputScreen: React.FC<InputScreenProps> = ({
  inputText,
  setInputText,
  isLoading,
  errorMessage,
  setErrorMessage,
  onAnalyze,
  onClear,
  onOpenVoiceModal,
  onOpenInbox,
  analysisResult,
  actionPlan,
  calendarAgent,
}) => {
  const { theme, toggleTheme } = useTheme();

  const handleSelectShortcut = (shortcut: (typeof QUICK_SHORTCUTS)[0]) => {
    if (shortcut.prompt === '__VOICE__') {
      onOpenVoiceModal();
      return;
    }
    setInputText(shortcut.prompt);
    setErrorMessage(null);
  };

  return (
    <ScreenContainer testID="input-screen">
      {/* Header */}
      <AppHeader
        title="Input & Speech"
        subtitle="Natural language capture & offline intent decomposition"
        showStatusIndicator
        statusLabel="Deterministic Engine"
        onToggleTheme={toggleTheme}
        onOpenInbox={onOpenInbox}
      />

      {/* Large Multiline Input Workspace */}
      <View
        style={[
          styles.inputCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
            padding: theme.spacing.lg,
          },
          theme.shadows.md,
        ]}
      >
        <View style={styles.inputHeaderRow}>
          <Text style={[theme.typography.titleMedium, { color: theme.colors.textPrimary }]}>
            Type or Dictate Request
          </Text>
          <View
            style={[
              styles.tagPill,
              {
                backgroundColor: theme.colors.primaryMuted,
                borderColor: theme.colors.primaryDark,
              },
            ]}
          >
            <Text style={[styles.tagPillText, { color: theme.colors.primaryLight }]}>
              Stage 1 & 2 Engine
            </Text>
          </View>
        </View>

        <TextInput
          style={[
            styles.largeInput,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
            },
            theme.typography.bodyLarge,
          ]}
          multiline
          numberOfLines={5}
          placeholder="Enter a request in plain English (e.g. 'I paid ₹200 for lunch and need to send Rahul the report by 5 PM' or 'Remind me to call Mom tomorrow')..."
          placeholderTextColor={theme.colors.textMuted}
          value={inputText}
          onChangeText={(txt) => {
            setInputText(txt);
            if (errorMessage) setErrorMessage(null);
          }}
          editable={!isLoading}
          testID="input-screen-textarea"
        />

        {errorMessage ? (
          <ErrorState message={errorMessage} onRetry={onAnalyze} />
        ) : null}

        {/* Action Controls */}
        <View style={[styles.actionControlsRow, { marginTop: theme.spacing.md }]}>
          {inputText.trim() ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={onClear}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textTertiary }]}>
                Clear
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          <View style={styles.rightButtonsRow}>
            <TouchableOpacity
              style={[
                styles.micButton,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
              onPress={onOpenVoiceModal}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={[theme.typography.titleSmall, { color: theme.colors.primaryLight }]}>
                🎙️ Speak
              </Text>
            </TouchableOpacity>

            <PrimaryButton
              label="Analyze & Plan"
              icon="⚡"
              onPress={onAnalyze}
              isLoading={isLoading}
              disabled={!inputText.trim()}
              size="md"
              testID="input-screen-send-btn"
            />
          </View>
        </View>
      </View>

      {/* Quick Suggestion Chips */}
      <View style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.sm }}>
        <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: 8 }]}>
          Sample Requests (Tap to prefill)
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shortcutsRow}
        >
          {QUICK_SHORTCUTS.map((shortcut, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.shortcutChip,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.pill,
                },
              ]}
              onPress={() => handleSelectShortcut(shortcut)}
              activeOpacity={0.7}
            >
              <Text style={styles.shortcutIcon}>{shortcut.icon}</Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                {shortcut.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Analysis Results View */}
      {analysisResult ? (
        <UnderstandingAndPlanView
          analysisResult={analysisResult}
          actionPlan={actionPlan}
          calendarAgent={calendarAgent}
        />
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  inputCard: {
    borderWidth: 1,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  largeInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  actionControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rightButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  micButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutsRow: {
    gap: 8,
    paddingRight: 10,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    gap: 6,
  },
  shortcutIcon: {
    fontSize: 13,
  },
  decisionCard: {
    borderWidth: 1,
  },
  decisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clarifyBanner: {
    padding: 8,
    borderWidth: 1,
  },
  techBox: {
    borderWidth: 1,
  },
});

