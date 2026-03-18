'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import api from '@/lib/api';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeUuid(segment: string): boolean {
  return UUID_REGEX.test(segment);
}

const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  dashboard: 'Dashboard',
  files: 'Files',
  inbox: 'Inbox',
  new: 'New',
  departments: 'Departments',
  users: 'User Management',
  workflows: 'Workflows',
  analytics: 'Analytics',
  desks: 'Desks',
  features: 'Features',
  support: 'Support',
  profile: 'Profile',
  search: 'Search',
  track: 'Track',
  opinions: 'Opinions',
};

export function BreadcrumbNav() {
  const pathname = usePathname();
  const [resolvedLabels, setResolvedLabels] = useState<Record<string, string>>({});

  const segments = pathname.split('/').filter(Boolean);

  useEffect(() => {
    if (segments.length === 0) return;

    const toResolve: { key: string; segment: string; prev: string; pathPrefix: string }[] = [];
    segments.forEach((segment, index) => {
      if (!looksLikeUuid(segment)) return;
      const prev = index > 0 ? segments[index - 1] : '';
      const pathPrefix = '/' + segments.slice(0, index).join('/');
      toResolve.push({ key: `${pathPrefix}/${segment}`, segment, prev, pathPrefix });
    });

    let cancelled = false;
    const resolve = async () => {
      const next: Record<string, string> = {};
      for (const { key, segment, prev } of toResolve) {
        if (cancelled) return;
        try {
          if (prev === 'files') {
            const res = await api.get(`/files/${segment}`);
            const file = res.data;
            next[key] = file?.fileNumber || file?.subject || segment.slice(0, 8);
          } else if (prev === 'departments' && segments[0] === 'admin') {
            const res = await api.get(`/departments/${segment}`);
            next[key] = res.data?.name || segment.slice(0, 8);
          } else if (prev === 'users' && segments[0] === 'admin') {
            const res = await api.get(`/users/${segment}`);
            next[key] = res.data?.name || res.data?.username || segment.slice(0, 8);
          } else if ((prev === 'workflows' || prev === 'id') && segments[0] === 'admin') {
            const res = await api.get(`/workflows/${segment}`).catch(() => null);
            const payload = res && typeof res === 'object' && 'data' in res ? (res as { data?: { name?: string; title?: string } }).data : null;
            next[key] = payload?.name || payload?.title || segment.slice(0, 8);
          }
        } catch {
          next[key] = segment.slice(0, 8) + '…';
        }
      }
      if (!cancelled) setResolvedLabels((prev) => ({ ...prev, ...next }));
    };
    resolve();
    return () => { cancelled = true; };
  }, [pathname]);

  if (pathname === '/login' || pathname === '/') return null;

  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const resolved = resolvedLabels[href];
    const label =
      resolved ||
      SEGMENT_LABELS[segment] ||
      (looksLikeUuid(segment) ? (segment.slice(0, 8) + '…') : segment.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    return { href, label, isLast: index === segments.length - 1 };
  });

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground py-1.5 px-1">
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 hover:text-foreground transition-colors rounded-md px-1.5 py-0.5 hover:bg-accent"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-xs font-medium">Home</span>
      </Link>

      {breadcrumbs.map((crumb) => (
        <Fragment key={crumb.href}>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground text-xs px-1.5 py-0.5 truncate max-w-[180px]">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors text-xs rounded-md px-1.5 py-0.5 hover:bg-accent truncate max-w-[180px] inline-block"
            >
              {crumb.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
