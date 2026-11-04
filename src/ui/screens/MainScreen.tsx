import React, { useEffect, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  View,
} from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { createTextInputEvent, createVoiceInputEvent } from '../../input/inputCapture';
import { IdentificationResult } from '../../intent/identifier';
import { defaultIntentService } from '../../intent/intentService';
import { ActionPlan } from '../../models/ActionPlan';
import {
  drainAndProcessQueue,
  subscribeToLiveNotifications,
  syncSettingsToNative,
} from '../../notifications/nativeNotificationListener';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { getNotificationSettings } from '../../notifications/notificationSettings';
import { SupervisorAgent } from '../../supervisor/supervisor';
import { VoiceLanguage } from '../../voice/voiceService';
import { CalendarSettingsModal } from '../components/CalendarSettingsModal';
import { CreatedEventsModal } from '../components/CreatedEventsModal';
import { NotificationInboxModal } from '../components/NotificationInboxModal';
import { NotificationSettingsModal } from '../components/NotificationSettingsModal';
import { SimulatedNotificationModal } from '../components/SimulatedNotificationModal';
import { VoiceInputModal } from '../components/VoiceInputModal';
import { BottomNavBar, TabKey } from '../components/core/BottomNavBar';
import { HomeScreen } from './HomeScreen';
import { InboxScreen } from './InboxScreen';
import { InputScreen } from './InputScreen';

const supervisor = new SupervisorAgent(0.6);
const calendarAgent = new CalendarAgent();
const notificationProcessor = new NotificationProcessor(undefined, undefined, calendarAgent);

export const MainScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<IdentificationResult | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);

  // Modals state
  const [showCalendarSettings, setShowCalendarSettings] = useState<boolean>(false);
  const [showCreatedEvents, setShowCreatedEvents] = useState<boolean>(false);
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);
  const [showNotificationInbox, setShowNotificationInbox] = useState<boolean>(false);
  const [showSimulateNotification, setShowSimulateNotification] = useState<boolean>(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState<boolean>(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);

  const refreshNotificationCount = async () => {
    try {
      const repo = notificationProcessor.getRepository();
      const newItems = await repo.listAll('new');
      setUnreadNotificationCount(newItems.length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshNotificationCount();

    // 1. Initial drain of native queue on launch
    drainAndProcessQueue(notificationProcessor).then(() => {
      refreshNotificationCount();
    });

    // 2. Sync current settings to native SharedPreferences on launch
    const settings = getNotificationSettings();
    syncSettingsToNative(settings.captureEnabled, settings.allowedApps);

    // 3. Listen for live incoming notifications while app is in foreground
    const liveSub = subscribeToLiveNotifications(async (event) => {
      await notificationProcessor.processNotification(event);
      refreshNotificationCount();
    });

    // 4. Drain queue whenever app returns to foreground from background
    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        drainAndProcessQueue(notificationProcessor).then(() => {
          refreshNotificationCount();
        });
      }
    });

    return () => {
      liveSub.remove();
      appStateSub.remove();
    };
  }, []);

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
    <View style={{ flex: 1 }}>
      {activeTab === 'home' ? (
        <HomeScreen
          inputText={inputText}
          setInputText={setInputText}
          isLoading={isLoading}
          errorMessage={errorMessage}
          setErrorMessage={setErrorMessage}
          onAnalyze={handleAnalyze}
          onClear={handleClear}
          onOpenVoiceModal={() => setShowVoiceModal(true)}
          onOpenInbox={() => {
            setShowNotificationInbox(true);
            refreshNotificationCount();
          }}
          onOpenSimulateNotification={() => setShowSimulateNotification(true)}
          onOpenNotificationSettings={() => setShowNotificationSettings(true)}
          onOpenCalendarSettings={() => setShowCalendarSettings(true)}
          onOpenCreatedEvents={() => setShowCreatedEvents(true)}
          unreadNotificationCount={unreadNotificationCount}
          analysisResult={analysisResult}
          actionPlan={actionPlan}
          calendarAgent={calendarAgent}
          notificationProcessor={notificationProcessor}
          refreshNotificationCount={refreshNotificationCount}
        />
      ) : activeTab === 'input' ? (
        <InputScreen
          inputText={inputText}
          setInputText={setInputText}
          isLoading={isLoading}
          errorMessage={errorMessage}
          setErrorMessage={setErrorMessage}
          onAnalyze={handleAnalyze}
          onClear={handleClear}
          onOpenVoiceModal={() => setShowVoiceModal(true)}
          onOpenInbox={() => {
            setActiveTab('inbox');
            refreshNotificationCount();
          }}
          analysisResult={analysisResult}
          actionPlan={actionPlan}
          calendarAgent={calendarAgent}
        />
      ) : activeTab === 'inbox' ? (
        <InboxScreen
          processor={notificationProcessor}
          onOpenSimulate={() => setShowSimulateNotification(true)}
          onOpenSettings={() => setShowNotificationSettings(true)}
        />
      ) : null}

      {/* Persistent Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'settings') {
            setShowNotificationSettings(true);
          } else if (tab === 'activity') {
            setActiveTab('inbox');
          } else {
            setActiveTab(tab);
          }
        }}
        unreadInboxCount={unreadNotificationCount}
      />

      {/* Voice Recognition Modal */}
      <VoiceInputModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSendTranscript={handleVoiceSend}
      />

      {/* Notification Modals */}
      <SimulatedNotificationModal
        visible={showSimulateNotification}
        onClose={() => setShowSimulateNotification(false)}
        onOpenInbox={() => {
          setShowNotificationInbox(true);
          refreshNotificationCount();
        }}
        processor={notificationProcessor}
        onNotificationProcessed={refreshNotificationCount}
      />

      <NotificationInboxModal
        visible={showNotificationInbox}
        onClose={() => {
          setShowNotificationInbox(false);
          refreshNotificationCount();
        }}
        processor={notificationProcessor}
      />

      <NotificationSettingsModal
        visible={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
        onClearAllNotifications={async () => {
          await notificationProcessor.getRepository().clearAll();
          refreshNotificationCount();
        }}
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
    </View>
  );
};
