import { createContext, useContext, ComponentProps } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { InboxScreen } from './screens/InboxScreen';
import { ActivityHistoryScreen } from './screens/ActivityHistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export interface AppScreens {
  home: ComponentProps<typeof HomeScreen>;
  inbox: ComponentProps<typeof InboxScreen>;
  activity: ComponentProps<typeof ActivityHistoryScreen>;
  settings: ComponentProps<typeof SettingsScreen>;
}
export const AppScreenContext = createContext<AppScreens | null>(null);
export function useAppScreens() {
  const context = useContext(AppScreenContext);
  if (!context) throw new Error('Screens must be inside the app layout');
  return context;
}
