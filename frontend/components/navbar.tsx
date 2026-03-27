'use client';

import { useAuthStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationCenter } from '@/components/notification-center';
import { HelpCenter } from '@/components/help-center';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import api from '@/lib/api';
import { Trophy, Search, Ticket, Star } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const goToGlobalSearch = () => {
    router.push('/search');
  };

  if (!user) return null;

  const getRoleBadgeStyle = () => {
    const roleStyles: Record<string, string> = {
      DEVELOPER: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      SUPER_ADMIN: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      DEPT_ADMIN: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      SECTION_OFFICER: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
      INWARD_DESK: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    };
    const primaryRole = (user as { roles?: string[]; role?: string }).roles?.[0] ?? (user as { role?: string }).role ?? '';
    return roleStyles[primaryRole] || 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800';
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="h-8 w-8 transition-all hover:bg-accent hover:text-accent-foreground" />
      <Separator orientation="vertical" className="h-5" />
      
      {/* Global Search – pages + files (not just Track File) */}
      <Button
        variant="outline"
        onClick={goToGlobalSearch}
        className={cn(
          "relative h-9 w-full max-w-[280px] justify-start rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground",
          "transition-transform active:scale-[0.98] sm:max-w-[320px] md:max-w-[400px]"
        )}
      >
        <Search className="mr-2 h-4 w-4 shrink-0" />
        <span className="hidden sm:inline-flex">Search pages or files...</span>
        <span className="inline-flex sm:hidden">Search</span>
        <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      
      <div className="flex flex-1 items-center justify-end gap-2">
        {/* Rating badge removed (points system deprecated) */}
        
        {/* Role Badge */}
        <Badge 
          variant="outline" 
          className={cn(
            "hidden md:flex px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border transition-all",
            getRoleBadgeStyle()
          )}
        >
          {((((user as { roles?: string[]; role?: string }).roles?.[0] ?? (user as { role?: string }).role ?? '') === 'SUPER_ADMIN'
            ? 'TECH_PANEL'
            : ((user as { roles?: string[]; role?: string }).roles?.[0] ?? (user as { role?: string }).role ?? '')
          )).replace('_', ' ')}
        </Badge>
        
        <Separator orientation="vertical" className="hidden sm:block h-5 mx-1" />
        
        {/* Action Buttons */}
        <Button variant="outline" size="sm" className="hidden sm:flex gap-1.5 h-9" asChild>
          <Link href="/support/new">
            <Ticket className="h-4 w-4" />
            Raise a ticket
          </Link>
        </Button>
        <Button variant="outline" size="icon" className="sm:hidden h-9 w-9" asChild>
          <Link href="/support/new" title="Raise a ticket">
            <Ticket className="h-4 w-4" />
          </Link>
        </Button>
        <NotificationCenter />
        <HelpCenter />
        <ThemeToggle />
      </div>
    </header>
  );
}
