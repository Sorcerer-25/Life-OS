import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  defaultVoiceService,
  VoiceLanguage,
  VoiceRecognitionState,
  VoiceService,
} from '../../voice/voiceService';
import { useTheme } from '../theme';
import { IconButton } from './core/IconButton';
import { PrimaryButton } from './core/PrimaryButton';
import { SecondaryButton } from './core/SecondaryButton';

interface VoiceInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSendTranscript: (
    transcript: string,
    metadata: { language: VoiceLanguage; recognition_confidence?: number }
  ) => void;
  voiceService?: VoiceService;
  defaultLanguage?: VoiceLanguage;
}

export const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  visible,
  onClose,
  onSendTranscript,
  voiceService = defaultVoiceService,
  defaultLanguage = 'en-IN',
}) => {
  const { theme } = useTheme();

  const [language, setLanguage] = useState<VoiceLanguage>(defaultLanguage);
  const [recordingState, setRecordingState] = useState<VoiceRecognitionState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPermanentlyDenied, setIsPermanentlyDenied] = useState<boolean>(false);
  const [isModuleAvailable, setIsModuleAvailable] = useState<boolean>(true);

  // Pulse animation for recording wave
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    if (recordingState === 'listening') {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      animLoop?.stop();
    };
  }, [recordingState]);

  useEffect(() => {
    if (visible) {
      resetState();
      const available = voiceService.isAvailable();
      setIsModuleAvailable(available);

      if (available) {
        startListening(language);
      } else {
        setErrorMessage(
          'On-device speech recognition module is not available in Expo Go. In an Android development build, native speech recognition operates offline.'
        );
      }
    } else {
      voiceService.abortListening();
      resetState();
    }
  }, [visible]);

  const resetState = () => {
    setTranscript('');
    setConfidence(undefined);
    setErrorMessage(null);
    setIsPermanentlyDenied(false);
    setRecordingState('idle');
  };

  const startListening = async (lang: VoiceLanguage) => {
    setErrorMessage(null);
    setIsPermanentlyDenied(false);
    setTranscript('');
    setConfidence(undefined);

    const started = await voiceService.startListening(lang, {
      onResult: (result) => {
        setTranscript(result.transcript);
        if (result.confidence !== undefined) {
          setConfidence(result.confidence);
        }
        if (result.isFinal) {
          setRecordingState('idle');
        }
      },
      onError: (err, code) => {
        setErrorMessage(err);
        setRecordingState('error');
        if (code === 'permanently_denied') {
          setIsPermanentlyDenied(true);
        }
      },
      onStateChange: (state) => {
        setRecordingState(state);
      },
    });

    if (!started && !errorMessage) {
      setRecordingState('idle');
    }
  };

  const handleStop = async () => {
    await voiceService.stopListening();
    setRecordingState('idle');
  };

  const handleLanguageChange = (newLang: VoiceLanguage) => {
    setLanguage(newLang);
    if (recordingState === 'listening') {
      voiceService.abortListening();
      startListening(newLang);
    }
  };

  const handleSend = () => {
    const trimmed = transcript.trim();
    if (!trimmed) {
      setErrorMessage('Please speak or type a request before sending.');
      return;
    }
    voiceService.abortListening();
    onSendTranscript(trimmed, {
      language,
      recognition_confidence: confidence,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
            },
            theme.shadows.lg,
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.modalHeader,
              {
                paddingBottom: theme.spacing.md,
                borderBottomColor: theme.colors.divider,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.titleLarge, { color: theme.colors.textPrimary }]}>
                🎤 Voice Request
              </Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                On-device speech recognition. Editable before sending.
              </Text>
            </View>
            <IconButton icon="✕" onPress={onClose} accessibilityLabel="Close voice modal" size="sm" />
          </View>

          {/* Language Selector */}
          <View style={[styles.languageContainer, { marginTop: theme.spacing.md }]}>
            <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: 6 }]}>
              Recognition Language
            </Text>
            <View style={styles.languageToggles}>
              {(
                [
                  { key: 'en-IN', label: '🇮🇳 English (India)' },
                  { key: 'en-US', label: '🇺🇸 English (US)' },
                ] as const
              ).map((langItem) => {
                const isActive = language === langItem.key;
                return (
                  <TouchableOpacity
                    key={langItem.key}
                    style={[
                      styles.languageChip,
                      {
                        backgroundColor: isActive
                          ? theme.colors.primaryMuted
                          : theme.colors.surfaceSubtle,
                        borderColor: isActive ? theme.colors.primaryLight : theme.colors.border,
                        borderRadius: theme.radii.sm,
                      },
                    ]}
                    onPress={() => handleLanguageChange(langItem.key)}
                    disabled={recordingState === 'listening'}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        theme.typography.bodySmall,
                        {
                          color: isActive ? theme.colors.primaryLight : theme.colors.textSecondary,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {langItem.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Pulsing Visual Recording Indicator */}
          <View style={styles.indicatorContainer}>
            {recordingState === 'listening' ? (
              <View style={styles.listeningCenter}>
                <Animated.View
                  style={[
                    styles.pulseCircle,
                    {
                      backgroundColor: theme.colors.errorSurface,
                      borderColor: theme.colors.error,
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                >
                  <Text style={styles.micIconLarge}>🎙️</Text>
                </Animated.View>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    { color: theme.colors.primaryLight, marginTop: theme.spacing.md },
                  ]}
                >
                  Listening... Speak your request
                </Text>
              </View>
            ) : recordingState === 'processing' ? (
              <View style={styles.listeningCenter}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text
                  style={[
                    theme.typography.bodyMedium,
                    { color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
                  ]}
                >
                  Finalizing transcript...
                </Text>
              </View>
            ) : (
              <View style={styles.listeningCenter}>
                <View
                  style={[
                    styles.idleCircle,
                    {
                      backgroundColor: theme.colors.surfaceSubtle,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text style={styles.micIconLarge}>🎙️</Text>
                </View>
                <Text
                  style={[
                    theme.typography.bodyMedium,
                    { color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
                  ]}
                >
                  {transcript
                    ? 'Review and edit transcript below'
                    : isModuleAvailable
                    ? 'Tap Start Speaking to record'
                    : 'Type a request below'}
                </Text>
              </View>
            )}
          </View>

          {/* Friendly Expo Go / Error Notice Banner */}
          {errorMessage && (
            <View
              style={[
                styles.noticeBanner,
                {
                  backgroundColor: !isModuleAvailable
                    ? theme.colors.infoSurface
                    : theme.colors.errorSurface,
                  borderColor: !isModuleAvailable
                    ? theme.colors.infoBorder
                    : theme.colors.errorBorder,
                  borderRadius: theme.radii.sm,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.sm,
                },
              ]}
            >
              <Text
                style={[
                  theme.typography.bodySmall,
                  {
                    color: !isModuleAvailable
                      ? theme.colors.infoForeground
                      : theme.colors.errorForeground,
                    lineHeight: 18,
                  },
                ]}
              >
                {!isModuleAvailable ? 'ℹ️ ' : '⚠️ '}
                {errorMessage}
              </Text>
              {isPermanentlyDenied && (
                <View style={{ marginTop: theme.spacing.sm }}>
                  <SecondaryButton
                    label="Open Phone Settings"
                    onPress={() => voiceService.openSettingsAsync()}
                    size="sm"
                  />
                </View>
              )}
            </View>
          )}

          {/* Editable Transcript Box */}
          <View
            style={[
              styles.transcriptBox,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
              },
            ]}
          >
            <View style={styles.transcriptHeaderRow}>
              <Text style={[theme.typography.label, { color: theme.colors.textTertiary }]}>
                Transcript (Tap to edit)
              </Text>
              {confidence !== undefined && (
                <Text style={[theme.typography.caption, { color: theme.colors.successForeground, fontWeight: '700' }]}>
                  Confidence: {Math.round(confidence * 100)}%
                </Text>
              )}
            </View>

            <TextInput
              style={[
                styles.transcriptInput,
                {
                  color: theme.colors.textPrimary,
                  marginTop: theme.spacing.xs,
                },
                theme.typography.bodyLarge,
              ]}
              multiline
              value={transcript}
              onChangeText={(text) => {
                setTranscript(text);
                if (errorMessage && isModuleAvailable) setErrorMessage(null);
              }}
              placeholder={
                recordingState === 'listening'
                  ? 'Words will appear here as you speak...'
                  : 'Speak into mic or type your request directly here...'
              }
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {/* Limitations note */}
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.textTertiary, marginVertical: theme.spacing.sm, textAlign: 'center' },
            ]}
          >
            ℹ️ Uses Android on-device speech engine. Offline capability depends on offline voice packs.
          </Text>

          {/* Action Buttons */}
          <View style={[styles.actionsRow, { gap: theme.spacing.md, marginTop: theme.spacing.xs }]}>
            {recordingState === 'listening' ? (
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Stop & Review"
                  icon="⏹️"
                  onPress={handleStop}
                  variant="danger"
                />
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label={transcript ? 'Re-record' : 'Start Speaking'}
                  icon="🎙️"
                  onPress={() => startListening(language)}
                  disabled={!isModuleAvailable}
                />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Send to LifeOS"
                icon="⚡"
                onPress={handleSend}
                disabled={!transcript.trim() || recordingState === 'listening'}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 20,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  languageContainer: {
    marginBottom: 8,
  },
  languageToggles: {
    flexDirection: 'row',
    gap: 8,
  },
  languageChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  indicatorContainer: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningCenter: {
    alignItems: 'center',
  },
  pulseCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  idleCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  micIconLarge: {
    fontSize: 26,
  },
  noticeBanner: {
    borderWidth: 1,
  },
  transcriptBox: {
    borderWidth: 1,
    minHeight: 100,
  },
  transcriptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transcriptInput: {
    minHeight: 80,
    maxHeight: 140,
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
  },
});
