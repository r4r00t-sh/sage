/** Persisted on `document.documentElement` as `data-color-theme` (neutral = attribute removed). */
export const COLOR_THEMES = [
  'neutral',
  'blue',
  'green',
  'orange',
  'red',
  'rose',
  'violet',
  'yellow',
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number];

export const COLOR_THEME_STORAGE_KEY = 'efiling-color-theme';

export function isColorTheme(value: string | null): value is ColorTheme {
  return value != null && (COLOR_THEMES as readonly string[]).includes(value);
}
