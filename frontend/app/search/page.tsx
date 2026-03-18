'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { hasAnyRole, canCreateFiles } from '@/lib/auth-utils';
import {
  Search,
  Home,
  Inbox,
  MapPin,
  MessageSquare,
  FileText,
  Plus,
  Users,
  BarChart,
  Shield,
  Settings,
  User,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PageItem = { label: string; path: string; icon: React.ElementType; keywords: string[] };

function getPagesForUser(user: Record<string, unknown> | null): PageItem[] {
  const u = user ?? {};
  const pages: PageItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: Home, keywords: ['home', 'overview'] },
    { label: 'File Inbox', path: '/files/inbox', icon: Inbox, keywords: ['inbox', 'files', 'pending'] },
    { label: 'Track File', path: '/files/track', icon: MapPin, keywords: ['track', 'find', 'locate', 'status'] },
    { label: 'My Files', path: '/files', icon: FileText, keywords: ['files', 'my files', 'documents'] },
    { label: 'Chat', path: '/chat', icon: MessageSquare, keywords: ['chat', 'messages'] },
    { label: 'Profile', path: '/profile', icon: User, keywords: ['profile', 'account', 'me'] },
    { label: 'Settings', path: '/settings', icon: Settings, keywords: ['settings', 'preferences'] },
  ];
  if (canCreateFiles(u)) {
    pages.push({ label: 'New File', path: '/files/new', icon: Plus, keywords: ['new', 'create', 'add file'] });
  }
  if (hasAnyRole(u, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
    pages.push(
      { label: 'Manage Users', path: '/admin/users', icon: Users, keywords: ['users', 'admin'] },
      { label: 'Analytics', path: '/admin/analytics', icon: BarChart, keywords: ['analytics', 'reports'] },
      { label: 'Workflows', path: '/admin/workflows', icon: Shield, keywords: ['workflows', 'automation'] }
    );
  }
  return pages;
}

export default function SearchPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [fileResults, setFileResults] = useState<Record<string, unknown>[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const minQueryLength = 2;

  const pages = getPagesForUser(user as Record<string, unknown> | null);

  const filterPages = useCallback(
    (q: string): PageItem[] => {
      if (!q.trim()) return pages;
      const lower = q.toLowerCase().trim();
      return pages.filter(
        (p) =>
          p.label.toLowerCase().includes(lower) ||
          p.keywords.some((k) => k.includes(lower) || lower.includes(k))
      );
    },
    [pages]
  );

  const searchFiles = useCallback(async (q: string) => {
    if (q.length < minQueryLength) {
      setFileResults([]);
      return;
    }
    setLoadingFiles(true);
    try {
      const res = await api.get('/files', { params: { search: q } });
      const data = res.data?.data ?? res.data ?? [];
      setFileResults(Array.isArray(data) ? data : []);
    } catch {
      setFileResults([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      searchFiles(query);
    }, 200);
    return () => clearTimeout(t);
  }, [query, searchFiles]);

  const filteredPages = filterPages(query);
  const showFiles = query.length >= minQueryLength;
  const hasResults = filteredPages.length > 0 || fileResults.length > 0 || loadingFiles;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <p className="text-muted-foreground mt-1">
          Search pages and files you have access to
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search pages or files..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-12 text-base"
          autoFocus
        />
      </div>

      {!hasResults && query.trim() && !loadingFiles && (
        <p className="text-muted-foreground text-sm">No pages or files match your search.</p>
      )}

      {filteredPages.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Pages
          </h2>
          <ul className="space-y-1">
            {filteredPages.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.path}>
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full justify-start gap-3 h-12 px-3 rounded-lg transition-colors'
                    )}
                    onClick={() => router.push(p.path)}
                  >
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-left">{p.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {showFiles && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            Files
            {loadingFiles && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </h2>
          {!loadingFiles && fileResults.length === 0 && query.length >= minQueryLength && (
            <p className="text-muted-foreground text-sm py-2">No files found.</p>
          )}
          {!loadingFiles && fileResults.length > 0 && (
            <ul className="space-y-1">
              {fileResults.map((f) => (
                <li key={String(f.id ?? '')}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-12 px-3 rounded-lg"
                    onClick={() => router.push(`/files/${String(f.id ?? '')}`)}
                  >
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-left truncate">
                      {String(f.fileNumber ?? f.subject ?? 'File')}
                      {f.subject && f.fileNumber ? ` · ${String(f.subject)}` : ''}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
