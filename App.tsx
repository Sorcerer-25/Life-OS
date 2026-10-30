import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { MainScreen } from './src/ui/screens/MainScreen';

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <MainScreen />
    </>
  );
}
