import { ScalePressable, useReducedMotion } from './core/Motion';
import React, { useEffect, useState , useCallback } from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { defaultVoiceService, VoiceLanguage, VoiceRecognitionState, VoiceService } from '../../voice/voiceService';
import { useTheme } from '../theme';
import { Icon } from './core/Icon';
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
  const reducedMotion = useReducedMotion();

  const [language, setLanguage] = useState<VoiceLanguage>(defaultLanguage);
  const [recordingState, setRecordingState] = useState<VoiceRecognitionState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPermanentlyDenied, setIsPermanentlyDenied] = useState<boolean>(false);
  const [isModuleAvailable, setIsModuleAvailable] = useState<boolean>(true);

  // Pulse animation for recording wave
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [pulseOpacity] = useState(() => new Animated.Value(0.6));

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    if (recordingState === 'listening' && !reducedMotion && visible) {
      animLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.4,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, {
              toValue: 0.15,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.6,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animLoop.start();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.6);
    }

    return () => {
      animLoop?.stop();
    };
  }, [recordingState, reducedMotion, visible, pulseAnim, pulseOpacity]);


  const resetState = useCallback(() => {
    setTranscript('');
    setConfidence(undefined);
    setErrorMessage(null);
    setIsPermanentlyDenied(false);
    setRecordingState('idle');
  }, []);

  const startListening = useCallback(async (lang: VoiceLanguage) => {
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

    if (!started) setRecordingState(previous => previous === 'error' ? previous : 'idle');
  }, [voiceService]);

  const handleStop = async () => {
    await voiceService.stopListening();
    setRecordingState('idle');
  };

  const handleLanguageChange = (newLang: VoiceLanguage) => setLanguage(newLang);

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

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
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
    });
    return () => { cancelled = true; voiceService.abortListening(); };
  }, [visible, language, startListening, resetState, voiceService]);

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
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="mic" size={18} color={theme.colors.info} />
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.titleLarge, { color: theme.colors.textPrimary }]}>
                  Voice Request
                </Text>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                  On-device speech recognition. Editable before sending.
                </Text>
              </View>
            </View>
            <IconButton icon="x" onPress={onClose} accessibilityLabel="Close voice modal" size="sm" />
          </View>

          {/* Language Selector */}
          <View style={[styles.languageContainer, { marginTop: theme.spacing.md }]}>
            <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginBottom: 6 }]}>
              Recognition Language
            </Text>
            <View style={styles.languageToggles}>
              {(
                [
                  { key: 'en-IN', label: 'English (India)' },
                  { key: 'en-US', label: 'English (US)' },
                ] as const
              ).map((langItem) => {
                const isActive = language === langItem.key;
                return (
                  <ScalePressable key={langItem.key}
                    style={[
                      styles.languageChip,
                      {
                        backgroundColor: isActive
                          ? theme.colors.surfaceSubtle
                          : theme.colors.surface,
                        borderColor: isActive ? theme.colors.info : theme.colors.border,
                        borderRadius: theme.radii.sm,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 6,
                      },
                    ]}
                    onPress={() => handleLanguageChange(langItem.key)}
                    disabled={recordingState === 'listening'}
                    activeOpacity={0.7}
                  >
                    <Icon name="globe" size={18} color={isActive ? theme.colors.info : theme.colors.textSecondary} />
                    <Text
                      style={[
                        theme.typography.bodySmall,
                        {
                          color: isActive ? theme.colors.textPrimary : theme.colors.textSecondary,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {langItem.label}
                    </Text>
                  </ScalePressable>
                );
              })}
            </View>
          </View>

          {/* Pulsing Visual Recording Indicator */}
          <View style={styles.indicatorContainer}>
            {recordingState === 'listening' ? (
              <View style={styles.listeningCenter}>
                <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View
                    style={[
                      styles.pulsingRing,
                      {
                        borderColor: theme.colors.error,
                        transform: [{ scale: pulseAnim }],
                        opacity: pulseOpacity,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.pulseCircle,
                      {
                        backgroundColor: theme.colors.surfaceSubtle,
                        borderColor: theme.colors.error,
                      },
                    ]}
                  >
                    <Icon name="mic" size={18} color={theme.colors.error} />
                  </View>
                </View>
                <Text
                  style={[
                    theme.typography.titleSmall,
                    { color: theme.colors.textPrimary, marginTop: theme.spacing.md },
                  ]}
                >
                  Listening... Speak your request
                </Text>
              </View>
            ) : recordingState === 'processing' ? (
              <View style={styles.listeningCenter}>
                <ActivityIndicator size="large" color={theme.colors.info} />
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
                  <Icon name="mic" size={18} color={theme.colors.textSecondary} />
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
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: !isModuleAvailable
                    ? theme.colors.border
                    : theme.colors.error,
                  borderRadius: theme.radii.sm,
                  padding: theme.spacing.md,
                  marginBottom: theme.spacing.sm,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon
                  name={!isModuleAvailable ? 'info' : 'alert-triangle'}
                  size={18}
                  color={!isModuleAvailable ? theme.colors.info : theme.colors.error}
                />
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {
                      color: !isModuleAvailable
                        ? theme.colors.textSecondary
                        : theme.colors.error,
                      lineHeight: 22,
                      flex: 1,
                    },
                  ]}
                >
                  {errorMessage}
                </Text>
              </View>
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
            Uses Android on-device speech engine. Offline capability depends on offline voice packs.
          </Text>

          {/* Action Buttons */}
          <View style={[styles.actionsRow, { gap: theme.spacing.md, marginTop: theme.spacing.xs }]}>
            {recordingState === 'listening' ? (
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Stop & Review"
                  icon="square"
                  onPress={handleStop}
                  variant="danger"
                />
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label={transcript ? 'Re-record' : 'Start Speaking'}
                  icon="mic"
                  onPress={() => startListening(language)}
                  disabled={!isModuleAvailable}
                />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Send to LifeOS"
                icon="zap"
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
  pulsingRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
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
