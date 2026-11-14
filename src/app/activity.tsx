import React from 'react';
import { useAppScreens } from '../ui/AppScreenContext';
import { ActivityHistoryScreen } from '../ui/screens/ActivityHistoryScreen';
export default function ActivityRoute() { return <ActivityHistoryScreen {...useAppScreens().activity} />; }
