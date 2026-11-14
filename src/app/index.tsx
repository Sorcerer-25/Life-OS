import React from 'react';
import { useAppScreens } from '../ui/AppScreenContext';
import { HomeScreen } from '../ui/screens/HomeScreen';
export default function HomeRoute() { return <HomeScreen {...useAppScreens().home} />; }
