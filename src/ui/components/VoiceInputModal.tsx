import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  const [language, setLanguage] = useState<VoiceLanguage>(defaultLanguage);
  const [recordingState, setRecordingState] = useState<VoiceRecognitionState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPermanentlyDenied, setIsPermanentlyDenied] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      resetState();
      // Start recording automatically when modal opens
      startListening(language);
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>🎤 Voice Input</Text>
              <Text style={styles.modalSubtitle}>
                On-device speech recognition. You can edit before sending.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Language Selector */}
          <View style={styles.languageContainer}>
            <Text style={styles.languageLabel}>Recognition Language:</Text>
            <View style={styles.languageToggles}>
              <TouchableOpacity
                style={[
                  styles.languageChip,
                  language === 'en-IN' && styles.languageChipActive,
                ]}
                onPress={() => handleLanguageChange('en-IN')}
                disabled={recordingState === 'listening'}
              >
                <Text
                  style={[
                    styles.languageChipText,
                    language === 'en-IN' && styles.languageChipTextActive,
                  ]}
                >
                  🇮🇳 English (India)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.languageChip,
                  language === 'en-US' && styles.languageChipActive,
                ]}
                onPress={() => handleLanguageChange('en-US')}
                disabled={recordingState === 'listening'}
              >
                <Text
                  style={[
                    styles.languageChipText,
                    language === 'en-US' && styles.languageChipTextActive,
                  ]}
                >
                  🇺🇸 English (US)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Mic Status & Live Indicator */}
          <View style={styles.indicatorContainer}>
            {recordingState === 'listening' ? (
              <View style={styles.listeningRow}>
                <View style={styles.pulsingMic}>
                  <Text style={styles.micIconLarge}>🎙️</Text>
                </View>
                <Text style={styles.listeningText}>Listening... Speak your request</Text>
              </View>
            ) : recordingState === 'processing' ? (
              <View style={styles.listeningRow}>
                <ActivityIndicator size="small" color="#38bdf8" />
                <Text style={styles.listeningText}>Finalizing transcript...</Text>
              </View>
            ) : (
              <View style={styles.listeningRow}>
                <Text style={styles.idleText}>
                  {transcript ? 'Tap the transcript to edit below' : 'Tap Re-record to start speaking'}
                </Text>
              </View>
            )}
          </View>

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              {isPermanentlyDenied && (
                <TouchableOpacity
                  style={styles.settingsButton}
                  onPress={() => voiceService.openSettingsAsync()}
                >
                  <Text style={styles.settingsButtonText}>Open Android Settings</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Editable Transcript Area */}
          <View style={styles.transcriptBox}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.transcriptLabel}>Transcript (Editable):</Text>
              {confidence !== undefined && (
                <Text style={styles.confidenceBadge}>
                  Confidence: {Math.round(confidence * 100)}%
                </Text>
              )}
            </View>
            <TextInput
              style={styles.transcriptInput}
              multiline
              value={transcript}
              onChangeText={(text) => {
                setTranscript(text);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder={
                recordingState === 'listening'
                  ? 'Words will appear here as you speak...'
                  : 'Speak into the mic or edit transcript here...'
              }
              placeholderTextColor="#64748b"
            />
          </View>

          {/* Notice on device offline limitations */}
          <Text style={styles.limitationsNote}>
            ℹ️ Speech-to-text uses Android SpeechRecognizer. Offline accuracy depends on whether
            your device has offline language packs installed.
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {recordingState === 'listening' ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.stopBtn]}
                onPress={handleStop}
              >
                <Text style={styles.stopBtnText}>⏹️ Stop & Review</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.recordBtn]}
                onPress={() => startListening(language)}
              >
                <Text style={styles.recordBtnText}>
                  {transcript ? '🔄 Re-record' : '🎙️ Start Speaking'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.sendBtn,
                (!transcript.trim() || recordingState === 'listening') && styles.disabledBtn,
              ]}
              onPress={handleSend}
              disabled={!transcript.trim() || recordingState === 'listening'}
            >
              <Text style={styles.sendBtnText}>⚡ Send to LifeOS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  languageContainer: {
    marginBottom: 14,
  },
  languageLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  languageToggles: {
    flexDirection: 'row',
    gap: 8,
  },
  languageChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  languageChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  languageChipText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  languageChipTextActive: {
    color: '#ffffff',
  },
  indicatorContainer: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulsingMic: {
    backgroundColor: '#ef4444',
    padding: 8,
    borderRadius: 20,
  },
  micIconLarge: {
    fontSize: 18,
  },
  listeningText: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '600',
  },
  idleText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
  },
  settingsButton: {
    marginTop: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  settingsButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  transcriptBox: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transcriptLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  confidenceBadge: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '500',
  },
  transcriptInput: {
    minHeight: 80,
    maxHeight: 140,
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  limitationsNote: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 15,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
  },
  recordBtnText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  stopBtn: {
    backgroundColor: '#ef4444',
  },
  stopBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  sendBtn: {
    backgroundColor: '#38bdf8',
  },
  sendBtnText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});

