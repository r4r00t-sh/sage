'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, BarChart3, Menu, X } from 'lucide-react';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const navigation = {
  INWARD_DESK: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Inbox', href: '/files/inbox', icon: FileText },
  ],
  SECTION_OFFICER: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Files', href: '/files', icon: FileText },
  ],
  DEPT_ADMIN: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Department', href: '/admin/department', icon: FileText },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  ],
  DEVELOPER: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Global Analytics', href: '/admin/global', icon: BarChart3 },
    { name: 'Recall Protocol', href: '/admin/recall', icon: FileText },
  ],
  SUPER_ADMIN: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Global Analytics', href: '/admin/global', icon: BarChart3 },
    { name: 'Recall Protocol', href: '/admin/recall', icon: FileText },
  ],
};

export function MobileNav() {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const primaryRole = (user as { roles?: string[]; role?: string }).roles?.[0] ?? (user as { role?: string }).role ?? 'SECTION_OFFICER';
  const userNav = navigation[primaryRole as keyof typeof navigation] || navigation.SECTION_OFFICER;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-2 mt-6">
          {userNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Button
                key={item.name}
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn('justify-start', isActive && 'bg-secondary')}
                onClick={() => {
                  router.push(item.href);
                  setOpen(false);
                }}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </Button>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

