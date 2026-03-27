'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/components/theme-provider';
import { isColorTheme, type ColorTheme } from '@/lib/color-themes';

/**
 * Applies theme preferences from the logged-in user (server) after auth hydration / login.
 */
export function AuthUserThemeSync() {
  const user = useAuthStore((s) => s.user);
  const { setTheme, setColorTheme } = useTheme();

  const applyFromUser = (u: typeof user) => {
    if (!u?.id) return;

    if (
      u.uiAppearanceTheme === 'light' ||
      u.uiAppearanceTheme === 'dark' ||
      u.uiAppearanceTheme === 'system'
    ) {
      setTheme(u.uiAppearanceTheme);
    }

    const colorRaw = u.uiColorTheme;
    const color: ColorTheme =
      colorRaw && isColorTheme(colorRaw) ? colorRaw : 'neutral';
    setColorTheme(color);
  };

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      applyFromUser(useAuthStore.getState().user);
    });
    if (useAuthStore.persist.hasHydrated()) {
      applyFromUser(useAuthStore.getState().user);
    }
    return unsub;
  }, [setTheme, setColorTheme]);

  useEffect(() => {
    if (!useAuthStore.persist.hasHydrated()) return;
    applyFromUser(useAuthStore.getState().user);
  }, [
    user?.id,
    user?.uiAppearanceTheme,
    user?.uiColorTheme,
    setTheme,
    setColorTheme,
  ]);

  return null;
}
