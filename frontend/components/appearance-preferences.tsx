'use client';

import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  ChevronDown,
  Check,
} from 'lucide-react';
import { COLOR_THEMES, type ColorTheme } from '@/lib/color-themes';
import { useLocaleStore, useAuthStore } from '@/lib/store';
import { getTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { persistUserUiThemes } from '@/lib/persist-user-theme';

type AppearanceTheme = 'light' | 'dark' | 'system';

export function AppearancePreferences({
  variant = 'card',
}: {
  /** `card` = full Card wrapper; `plain` = inner content only (e.g. inside profile tab) */
  variant?: 'card' | 'plain';
}) {
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const { locale } = useLocaleStore();
  const { user, token, setAuth } = useAuthStore();
  const t = (key: string) => getTranslation(locale, key);

  const themePresetLabel = (id: ColorTheme) => {
    const map: Record<ColorTheme, string> = {
      neutral: t('themeNeutral'),
      blue: t('themeBlue'),
      green: t('themeGreen'),
      orange: t('themeOrange'),
      red: t('themeRed'),
      rose: t('themeRose'),
      violet: t('themeViolet'),
      yellow: t('themeYellow'),
    };
    return map[id];
  };

  const persistToAccount = async (
    appearance: AppearanceTheme,
    color: ColorTheme
  ) => {
    if (!user?.id || !token) return;
    try {
      await persistUserUiThemes(user.id, appearance, color);
      setAuth(
        {
          ...user,
          uiAppearanceTheme: appearance,
          uiColorTheme: color === 'neutral' ? null : color,
        },
        token
      );
    } catch {
      toast.error(t('themeSaveError'));
    }
  };

  const handleAppearance = (next: AppearanceTheme) => {
    setTheme(next);
    void persistToAccount(next, colorTheme);
  };

  const handleColor = (next: ColorTheme) => {
    setColorTheme(next);
    void persistToAccount(theme as AppearanceTheme, next);
  };

  const inner = (
    <div className="space-y-8">
      <div className="space-y-4">
        <Label className="text-base font-medium">{t('appearanceMode')}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <button
            type="button"
            className={`flex flex-row items-center gap-5 p-6 rounded-xl border-2 cursor-pointer transition-all text-left ${
              theme === 'light'
                ? 'border-primary bg-primary/5'
                : 'border-transparent hover:border-muted-foreground/20'
            }`}
            onClick={() => handleAppearance('light')}
          >
            <div className="h-14 w-14 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Sun className="h-7 w-7 text-amber-600" />
            </div>
            <div>
              <span className="font-semibold text-base block">{t('light')}</span>
              <span className="text-sm text-muted-foreground">
                Bright, clean interface
              </span>
            </div>
          </button>
          <button
            type="button"
            className={`flex flex-row items-center gap-5 p-6 rounded-xl border-2 cursor-pointer transition-all text-left ${
              theme === 'dark'
                ? 'border-primary bg-primary/5'
                : 'border-transparent hover:border-muted-foreground/20'
            }`}
            onClick={() => handleAppearance('dark')}
          >
            <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-800 flex items-center justify-center">
              <Moon className="h-7 w-7 text-slate-200" />
            </div>
            <div>
              <span className="font-semibold text-base block">{t('dark')}</span>
              <span className="text-sm text-muted-foreground">
                Easy on the eyes
              </span>
            </div>
          </button>
          <button
            type="button"
            className={`flex flex-row items-center gap-5 p-6 rounded-xl border-2 cursor-pointer transition-all text-left ${
              theme === 'system'
                ? 'border-primary bg-primary/5'
                : 'border-transparent hover:border-muted-foreground/20'
            }`}
            onClick={() => handleAppearance('system')}
          >
            <div className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-amber-100 to-slate-800 flex items-center justify-center">
              <Monitor className="h-7 w-7 text-slate-600" />
            </div>
            <div>
              <span className="font-semibold text-base block">{t('system')}</span>
              <span className="text-sm text-muted-foreground">
                Match your device
              </span>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">{t('themePreset')}</Label>
        <p className="text-sm text-muted-foreground">{t('themePresetHint')}</p>
        <p className="text-xs text-muted-foreground">{t('themeSavedPerUser')}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:max-w-md h-12 justify-between text-base font-normal rounded-xl"
            >
              <span>{themePresetLabel(colorTheme)}</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)] sm:w-56 rounded-xl"
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              {t('themeMenuLabel')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {COLOR_THEMES.map((preset) => (
              <DropdownMenuItem
                key={preset}
                className="rounded-lg cursor-pointer"
                onClick={() => handleColor(preset)}
              >
                <span className="flex-1">{themePresetLabel(preset)}</span>
                {colorTheme === preset ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  if (variant === 'plain') {
    return inner;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-6">
        <CardTitle className="text-xl flex items-center gap-3">
          <Palette className="h-6 w-6" />
          {t('appearance')}
        </CardTitle>
        <CardDescription className="text-base">
          {t('appearanceCardDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">{inner}</CardContent>
    </Card>
  );
}
