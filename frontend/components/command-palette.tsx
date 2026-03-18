'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  FileText,
  Home,
  Settings,
  Users,
  MessageSquare,
  Plus,
  MapPin,
  BarChart,
  Shield,
  Inbox,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { hasAnyRole, canCreateFiles } from '@/lib/auth-utils';
import api from '@/lib/api';

interface Command {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileResults, setFileResults] = useState<Record<string, unknown>[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
        if (!open) setSearchQuery('');
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  const navigate = useCallback((path: string) => {
    setOpen(false);
    router.push(path);
  }, [router]);

  // Global search: fetch files when user types (min 2 chars)
  useEffect(() => {
    if (!open) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      const id = requestAnimationFrame(() => setFileResults([]));
      return () => cancelAnimationFrame(id);
    }
    const t = setTimeout(() => {
      setLoadingFiles(true);
      api.get('/files', { params: { search: q } })
        .then((res) => {
          const data = res.data?.data ?? res.data ?? [];
          setFileResults(Array.isArray(data) ? data : []);
        })
        .catch(() => setFileResults([]))
        .finally(() => setLoadingFiles(false));
    }, 200);
    return () => clearTimeout(t);
  }, [open, searchQuery]);

  const commands: Command[] = [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      icon: Home,
      action: () => navigate('/dashboard'),
      keywords: ['home', 'overview'],
    },
    {
      id: 'nav-inbox',
      label: 'File Inbox',
      icon: Inbox,
      action: () => navigate('/files/inbox'),
      keywords: ['files', 'pending'],
    },
    {
      id: 'nav-files',
      label: 'All Files',
      icon: FileText,
      action: () => navigate('/files'),
      keywords: ['documents'],
    },
    {
      id: 'nav-track',
      label: 'Track File',
      icon: MapPin,
      action: () => navigate('/files/track'),
      keywords: ['find', 'locate', 'status'],
    },
    {
      id: 'nav-chat',
      label: 'Chat',
      icon: MessageSquare,
      action: () => navigate('/chat'),
      keywords: ['messages', 'conversation'],
    },
    {
      id: 'nav-profile',
      label: 'Profile',
      icon: Users,
      action: () => navigate('/profile'),
      keywords: ['account', 'user', 'me'],
    },
    {
      id: 'nav-settings',
      label: 'Settings',
      icon: Settings,
      action: () => navigate('/settings'),
      keywords: ['preferences', 'configuration'],
    },
  ];

  if (canCreateFiles(user)) {
    commands.push({
      id: 'action-new-file',
      label: 'Create New File',
      icon: Plus,
      action: () => navigate('/files/new'),
      keywords: ['add', 'create', 'new document'],
    });
  }

  if (hasAnyRole(user, ['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN'])) {
    commands.push(
      { id: 'nav-users', label: 'Manage Users', icon: Users, action: () => navigate('/admin/users'), keywords: ['admin', 'staff'] },
      { id: 'nav-analytics', label: 'Analytics', icon: BarChart, action: () => navigate('/admin/analytics'), keywords: ['reports', 'stats'] },
      { id: 'nav-workflows', label: 'Workflows', icon: Shield, action: () => navigate('/admin/workflows'), keywords: ['automation', 'rules'] }
    );
  }

  const navigationCommands = commands.filter(c => c.id.startsWith('nav-'));
  const actionCommands = commands.filter(c => c.id.startsWith('action-'));

  return (
    <CommandDialog open={open} onOpenChange={setOpen} value={searchQuery} onValueChange={setSearchQuery}>
      <CommandInput placeholder="Search pages or files..." />
      <CommandList className="max-h-[min(70vh,400px)]">
        <CommandEmpty>
          {loadingFiles ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching files...</span>
            </div>
          ) : (
            'No results found.'
          )}
        </CommandEmpty>

        {fileResults.length > 0 && (
          <>
            <CommandGroup heading="Files">
              {fileResults.map((f) => (
                <CommandItem
                  key={String(f.id ?? '')}
                  onSelect={() => navigate(`/files/${String(f.id ?? '')}`)}
                  className="cursor-pointer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="truncate">{String(f.fileNumber ?? f.subject ?? 'File')}{f.subject && f.fileNumber ? ` · ${String(f.subject)}` : ''}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Pages">
          {navigationCommands.map((command) => (
            <CommandItem key={command.id} onSelect={command.action} className="cursor-pointer">
              <command.icon className="mr-2 h-4 w-4" />
              <span>{command.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {actionCommands.map((command) => (
            <CommandItem key={command.id} onSelect={command.action} className="cursor-pointer">
              <command.icon className="mr-2 h-4 w-4" />
              <span>{command.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
