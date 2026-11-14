import React from 'react';
import { useAppScreens } from '../ui/AppScreenContext';
import { InboxScreen } from '../ui/screens/InboxScreen';
export default function InboxRoute() { return <InboxScreen {...useAppScreens().inbox} />; }
