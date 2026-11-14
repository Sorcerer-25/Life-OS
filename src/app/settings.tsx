import React from 'react';
import { useAppScreens } from '../ui/AppScreenContext';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
export default function SettingsRoute() { return <SettingsScreen {...useAppScreens().settings} />; }
