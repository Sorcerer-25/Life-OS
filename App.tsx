import React from 'react';
import { ThemeProvider } from './src/ui/theme';
import { MainScreen } from './src/ui/screens/MainScreen';

export default function App() {
  return (
    <ThemeProvider>
      <MainScreen />
    </ThemeProvider>
  );
}
