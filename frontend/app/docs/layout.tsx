'use client';

import Link from 'next/link';
import {
  BookOpen,
  LayoutDashboard,
  FileText,
  MapPin,
  Users,
  MessageSquare,
  Settings,
  Shield,
  Send,
  Activity,
  Globe,
  ListOrdered,
  ExternalLink,
} from 'lucide-react';

const sections = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'files', label: 'Files & Inbox', icon: FileText },
  { id: 'forward-queue', label: 'Forward & Queue', icon: ListOrdered },
  { id: 'track-file', label: 'Track File', icon: MapPin },
  { id: 'opinions', label: 'Opinion Inbox', icon: Send },
  { id: 'admin', label: 'Admin', icon: Shield },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'profile-settings', label: 'Profile & Settings', icon: Settings },
  { id: 'language', label: 'Language (Malayalam)', icon: Globe },
  { id: 'roles', label: 'Roles & Access', icon: Users },
  { id: 'api', label: 'API Overview', icon: Activity },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Docs-only sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed left-0 top-0 bottom-0 border-r bg-card z-10">
        <div className="p-4 border-b">
          <Link href="/docs" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="EFMP" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <span className="font-semibold text-sm block">EFMP Docs</span>
              <span className="text-xs text-muted-foreground">Documentation</span>
            </div>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-3">
            Contents
          </p>
          <ul className="space-y-0.5">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t">
          <a
            href="/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open EFMP app
          </a>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 lg:pl-64 min-h-screen flex flex-col">
        {/* Docs top bar */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur px-4 md:px-8">
          <div className="flex-1 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold">EFMP Documentation</span>
          </div>
          <a
            href="/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            Open app
            <ExternalLink className="h-4 w-4" />
          </a>
        </header>

        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
