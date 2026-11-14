import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { CalendarAgent } from '../../calendar/calendarAgent';
import { IdentificationResult } from '../../intent/identifier';
import { ActionPlan } from '../../models/ActionPlan';
import { useTheme } from '../theme';
import { BottomSheet } from './core/BottomSheet';
import { PrimaryButton } from './core/PrimaryButton';
import { SecondaryButton } from './core/SecondaryButton';
import { ScalePressable } from './core/Motion';
import { IconTile } from './core/IconTile';
import { UnderstandingAndPlanView } from './plan/UnderstandingAndPlanView';
import { QUICK_SHORTCUTS } from '../screens/HomeScreen';

export interface RecentRequest { text: string; analysis: IdentificationResult; plan: ActionPlan }
interface Props {
  visible: boolean; onClose: () => void; text: string; onChangeText: (text: string) => void;
  onAnalyze: () => void; onSpeak: () => void; loading: boolean; error: string | null;
  analysis: IdentificationResult | null; plan: ActionPlan | null; calendarAgent: CalendarAgent;
  recent: RecentRequest[]; onSelectRecent: (request: RecentRequest) => void;
}
export function QuickInputSheet(props: Props) {
  const { theme } = useTheme();
  return <BottomSheet visible={props.visible} onClose={props.onClose} title="What's on your mind?" subtitle="Capture a request from anywhere.">
    <TextInput accessibilityLabel="Your request" autoFocus multiline value={props.text} onChangeText={props.onChangeText}
      editable={!props.loading} placeholder="Schedule a meeting tomorrow at 3 PM…" placeholderTextColor={theme.colors.textSecondary}
      style={[theme.typography.bodyLarge, { color: theme.colors.textPrimary, borderColor: theme.colors.border, borderWidth: 1, backgroundColor: theme.colors.background, borderRadius: 12, padding: 14, minHeight: 108, textAlignVertical: 'top' }]} />
    {props.error && <Text accessibilityRole="alert" style={[theme.typography.bodyMedium, { color: theme.colors.error, marginTop: 8 }]}>{props.error}</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
      <SecondaryButton label="Speak" icon="mic" onPress={props.onSpeak} disabled={props.loading} />
      <PrimaryButton label="Analyze & Plan" icon="zap" onPress={props.onAnalyze} isLoading={props.loading} disabled={!props.text.trim()} />
    </View>
    <Text style={[theme.typography.label, { color: theme.colors.textSecondary, marginVertical: 8 }]}>Try a request</Text>
    {QUICK_SHORTCUTS.slice(0, 3).map(shortcut => <ScalePressable key={shortcut.prompt} onPress={() => props.onChangeText(shortcut.prompt)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <IconTile agent={shortcut.agent} /><Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary, flex: 1 }]}>{shortcut.label}</Text>
    </ScalePressable>)}
    {props.analysis ? <UnderstandingAndPlanView key={props.analysis.analysis.request_id} analysisResult={props.analysis} actionPlan={props.plan} calendarAgent={props.calendarAgent} /> :
      <View style={{ marginTop: 16 }}>
        <Text style={[theme.typography.titleSmall, { color: theme.colors.textPrimary }]}>Recent requests</Text>
        {props.recent.length ? props.recent.map(request => <ScalePressable key={request.analysis.analysis.request_id} onPress={() => props.onSelectRecent(request)} style={{ paddingVertical: 12 }}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.textSecondary }]}>{request.text}</Text>
        </ScalePressable>) : <Text style={[theme.typography.bodyMedium, { color: theme.colors.textSecondary, marginTop: 6 }]}>Your latest requests and plans will appear here after you analyze them.</Text>}
      </View>}
  </BottomSheet>;
}
