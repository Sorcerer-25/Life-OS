import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, ThemeColors } from './colors';
import {
  getCurrentThemeMode,
  loadPersistedThemeMode,
  persistThemeMode,
  ThemeMode,
} from './themeStorage';
import { radii, shadows, Shadows, spacing } from './tokens';
import { typography, TypographyScale } from './typography';

export interface Theme {
  colors: ThemeColors;
  typography: TypographyScale;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: Shadows;
  isDark: boolean;
  mode: ThemeMode;
}

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(getCurrentThemeMode());

  useEffect(() => {
    loadPersistedThemeMode().then((persisted) => {
      setModeState(persisted);
    });
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    persistThemeMode(newMode);
  };

  const isDark = useMemo(() => {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return systemColorScheme !== 'light';
  }, [mode, systemColorScheme]);

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  const theme: Theme = useMemo(() => {
    const colors = isDark ? darkColors : lightColors;
    return {
      colors,
      typography,
      spacing,
      radii,
      shadows,
      isDark,
      mode,
    };
  }, [isDark, mode]);

  const value: ThemeContextValue = useMemo(
    () => ({
      theme,
      mode,
      isDark,
      setMode,
      toggleTheme,
    }),
    [theme, mode, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

