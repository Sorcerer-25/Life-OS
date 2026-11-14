import React, { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { router, Slot, usePathname } from 'expo-router';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { createTextInputEvent, createVoiceInputEvent } from '../../input/inputCapture';
import { IdentificationResult } from '../../intent/identifier';
import { defaultIntentService } from '../../intent/intentService';
import { ActionPlan } from '../../models/ActionPlan';
import { drainAndProcessQueue, subscribeToLiveNotifications, syncSettingsToNative } from '../../notifications/nativeNotificationListener';
import { NotificationProcessor } from '../../notifications/notificationProcessor';
import { loadNotificationSettings } from '../../notifications/notificationSettings';
import { SupervisorAgent } from '../../supervisor/supervisor';
import { VoiceLanguage } from '../../voice/voiceService';
import { AppScreenContext, AppScreens } from '../AppScreenContext';
import { useTheme } from '../theme';
import { CalendarSettingsModal } from '../components/CalendarSettingsModal';
import { CreatedEventsModal } from '../components/CreatedEventsModal';
import { RemindersModal } from '../components/RemindersModal';
import { SimulatedNotificationModal } from '../components/SimulatedNotificationModal';
import { VoiceInputModal } from '../components/VoiceInputModal';
import { QuickInputSheet, RecentRequest } from '../components/QuickInputSheet';
import { BottomNavBar, TabKey } from '../components/core/BottomNavBar';
import { Entrance } from '../components/core/Motion';

const supervisor = new SupervisorAgent(0.6);
const calendarAgent = new CalendarAgent();
const notificationProcessor = new NotificationProcessor(undefined, undefined, calendarAgent);
const paths = { home: '/', inbox: '/inbox', activity: '/activity', settings: '/settings' } as const;

export const MainScreen: React.FC = () => {
  const pathname = usePathname();
  const activeTab: TabKey = pathname === '/inbox' ? 'inbox' : pathname === '/activity' ? 'activity' : pathname === '/settings' ? 'settings' : 'home';
  const { theme } = useTheme();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<IdentificationResult | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [recent, setRecent] = useState<RecentRequest[]>([]);
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [showCreatedEvents, setShowCreatedEvents] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [returnToQuickInput, setReturnToQuickInput] = useState(false);
  const [showSimulateNotification, setShowSimulateNotification] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const refreshNotificationCount = useCallback(async () => {
    try { setUnreadNotificationCount((await notificationProcessor.getRepository().listAll('new')).length); } catch { /* Inbox may still be initializing. */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let live: { remove: () => void } | undefined;
    let appState: { remove: () => void } | undefined;
    const drain = async () => { await drainAndProcessQueue(notificationProcessor); if (!cancelled) await refreshNotificationCount(); };
    void (async () => {
      try {
        const settings = await loadNotificationSettings();
        if (cancelled) return;
        await syncSettingsToNative(settings.captureEnabled, settings.allowedApps);
        if (cancelled) return;
        live = subscribeToLiveNotifications(event => {
          void notificationProcessor.processNotification(event).then(refreshNotificationCount).catch(console.warn);
        });
        appState = AppState.addEventListener('change', state => { if (state === 'active') void drain().catch(console.warn); });
        await drain();
      } catch (error) { console.warn('[Notifications] Initialization failed', error); }
    })();
    return () => { cancelled = true; live?.remove(); appState?.remove(); };
  }, [refreshNotificationCount]);

  const navigate = (tab: TabKey) => { router.navigate(paths[tab]); void refreshNotificationCount(); };
  const openInput = (suggestion?: string) => { if (suggestion) setInputText(suggestion); setShowQuickInput(true); };
  const clear = () => { setInputText(''); setErrorMessage(null); setAnalysisResult(null); setActionPlan(null); };
  const analyze = async (text: string, metadata?: { language: VoiceLanguage; recognition_confidence?: number }) => {
    if (isLoading) return;
    if (!text.trim()) { setErrorMessage('Enter a request to analyze.'); return; }
    setIsLoading(true); setErrorMessage(null);
    try {
      const input = metadata ? createVoiceInputEvent({ rawTranscript: text.trim(), language: metadata.language, confidence: metadata.recognition_confidence }) : createTextInputEvent(text.trim());
      const result = await defaultIntentService.identify(input);
      const plan = supervisor.plan(result.analysis);
      setAnalysisResult(result); setActionPlan(plan);
      setRecent(previous => [{ text: text.trim(), analysis: result, plan }, ...previous.filter(item => item.text !== text.trim())].slice(0, 5));
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Could not analyze this request.'); }
    finally { setIsLoading(false); }
  };
  const speak = () => { setReturnToQuickInput(showQuickInput); setShowQuickInput(false); setShowVoiceModal(true); };
  const screens: AppScreens = {
    home: {
      inputText, setInputText, isLoading, errorMessage, setErrorMessage,
      onAnalyze: () => { void analyze(inputText); }, onClear: clear, onOpenVoiceModal: speak,
      onOpenInbox: () => navigate('inbox'), onOpenSimulateNotification: () => setShowSimulateNotification(true),
      onOpenNotificationSettings: () => navigate('settings'), onOpenCalendarSettings: () => setShowCalendarSettings(true),
      onOpenCreatedEvents: () => setShowCreatedEvents(true), onOpenReminders: () => setShowReminders(true),
      unreadNotificationCount, analysisResult, actionPlan, calendarAgent, notificationProcessor, refreshNotificationCount,
      recentRequests: recent, onSelectRecent: request => { setInputText(request.text); setAnalysisResult(request.analysis); setActionPlan(request.plan); },
    },
    inbox: { processor: notificationProcessor, onOpenSimulate: () => setShowSimulateNotification(true), onOpenSettings: () => navigate('settings') },
    activity: { processor: notificationProcessor, calendarAgent, onNavigateToInput: openInput, onOpenInbox: () => navigate('inbox') },
    settings: { processor: notificationProcessor, onClearAllData: async () => { await notificationProcessor.getRepository().clearAll(); await refreshNotificationCount(); } },
  };
  return <AppScreenContext.Provider value={screens}>
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Entrance key={pathname} style={{ flex: 1 }}><Slot /></Entrance>
      <BottomNavBar activeTab={activeTab} onSelectTab={navigate} onOpenQuickInput={() => openInput()} unreadInboxCount={unreadNotificationCount} />
      <QuickInputSheet visible={showQuickInput} onClose={() => setShowQuickInput(false)} text={inputText} onChangeText={text => { setInputText(text); setErrorMessage(null); }}
        onAnalyze={() => { void analyze(inputText); }} onSpeak={speak} loading={isLoading} error={errorMessage} analysis={analysisResult} plan={actionPlan} calendarAgent={calendarAgent}
        recent={recent} onSelectRecent={screens.home.onSelectRecent!} />
      <VoiceInputModal visible={showVoiceModal} onClose={() => { setShowVoiceModal(false); if (returnToQuickInput) setShowQuickInput(true); }}
        onSendTranscript={(text, metadata) => { setInputText(text); void analyze(text, metadata); }} />
      <SimulatedNotificationModal visible={showSimulateNotification} onClose={() => setShowSimulateNotification(false)} processor={notificationProcessor}
        onOpenInbox={() => { setShowSimulateNotification(false); navigate('inbox'); }} onNotificationProcessed={refreshNotificationCount} />
      <CalendarSettingsModal visible={showCalendarSettings} onClose={() => setShowCalendarSettings(false)} />
      <CreatedEventsModal visible={showCreatedEvents} onClose={() => setShowCreatedEvents(false)} calendarAgent={calendarAgent} />
      <RemindersModal visible={showReminders} onClose={() => setShowReminders(false)} calendarAgent={calendarAgent} processor={notificationProcessor}
        onNavigateToInput={suggestion => { setShowReminders(false); openInput(suggestion); }} />
    </View>
  </AppScreenContext.Provider>;
};
