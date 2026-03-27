'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  COLOR_THEME_STORAGE_KEY,
  type ColorTheme,
  isColorTheme,
} from '@/lib/color-themes';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorTheme: ColorTheme;
  setColorTheme: (colorTheme: ColorTheme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  colorTheme: 'neutral',
  setColorTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function applyColorThemeToDocument(colorTheme: ColorTheme) {
  const root = document.documentElement;
  if (colorTheme === 'neutral') {
    root.removeAttribute('data-color-theme');
  } else {
    root.setAttribute('data-color-theme', colorTheme);
  }
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'efiling-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>('neutral');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMounted(true);
      const stored = localStorage.getItem(storageKey) as Theme | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored);
      }
      const storedColor = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
      if (isColorTheme(storedColor)) {
        setColorThemeState(storedColor);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [storageKey]);

  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    applyColorThemeToDocument(colorTheme);
  }, [colorTheme, mounted]);

  const setTheme = useCallback(
    (next: Theme) => {
      localStorage.setItem(storageKey, next);
      setThemeState(next);
    },
    [storageKey]
  );

  const setColorTheme = useCallback((next: ColorTheme) => {
    if (next === 'neutral') {
      localStorage.removeItem(COLOR_THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(COLOR_THEME_STORAGE_KEY, next);
    }
    setColorThemeState(next);
    applyColorThemeToDocument(next);
  }, []);

  const value = {
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
  };

  // Always render children. Returning null here caused blank screens when ThemeProvider
  // remounted (e.g. login → dashboard), blocking navigation. Theme applies after mount via effects.
  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
