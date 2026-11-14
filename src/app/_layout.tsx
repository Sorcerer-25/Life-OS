import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../ui/theme';
import { MainScreen } from '../ui/screens/MainScreen';
import { MotionProvider } from '../ui/components/core/Motion';
export default function RootLayout() {
  return <SafeAreaProvider><MotionProvider><ThemeProvider><MainScreen /></ThemeProvider></MotionProvider></SafeAreaProvider>;
}
