import api from '@/lib/api';
import type { ColorTheme } from '@/lib/color-themes';

export type UiAppearanceTheme = 'light' | 'dark' | 'system';

export async function persistUserUiThemes(
  userId: string,
  appearance: UiAppearanceTheme,
  color: ColorTheme
): Promise<void> {
  await api.put(`/users/${userId}`, {
    uiAppearanceTheme: appearance,
    uiColorTheme: color === 'neutral' ? null : color,
  });
}
