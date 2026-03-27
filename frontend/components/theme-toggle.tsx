'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/theme-provider';
import { useAuthStore } from '@/lib/store';
import { persistUserUiThemes } from '@/lib/persist-user-theme';

export function ThemeToggle() {
  const { setTheme, colorTheme } = useTheme();
  const { user, token, setAuth } = useAuthStore();

  const apply = async (mode: 'light' | 'dark' | 'system') => {
    setTheme(mode);
    if (!user?.id || !token) return;
    try {
      await persistUserUiThemes(user.id, mode, colorTheme);
      setAuth(
        {
          ...user,
          uiAppearanceTheme: mode,
          uiColorTheme: colorTheme === 'neutral' ? null : colorTheme,
        },
        token
      );
    } catch {
      // Navbar: keep UI change; account sync can retry from Settings
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void apply('light')}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void apply('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void apply('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

