'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore, useChatStore } from '@/lib/store';
import { hasAnyRole } from '@/lib/auth-utils';
import { CHAT_ENABLED } from '@/lib/feature-flags';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { MessageSquare, User } from 'lucide-react';

/** Clickable user name → user profile (or own profile). Right-click for "Message" → open DM. */
export function UserProfileLink({
  userId,
  name,
  className,
  fallback = true,
}: {
  userId: string;
  name: string;
  className?: string;
  /** If true, render as span when no link (e.g. no id). Default true. */
  fallback?: boolean;
}) {
  const { user } = useAuthStore();
  const { openChatWith } = useChatStore();
  const router = useRouter();
  const href = userId === user?.id ? '/profile' : `/admin/users/${userId}`;
  const isSelf = userId === user?.id;

  if (!userId && fallback) return <span className={cn('font-medium', className)}>{name}</span>;
  if (!userId) return null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={href}
          className={cn(
            'font-medium underline-offset-2 hover:underline hover:text-primary transition-colors cursor-context-menu',
            className
          )}
        >
          {name}
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={() => router.push(href)}>
          <User className="size-4" />
          View profile
        </ContextMenuItem>
        {!isSelf && CHAT_ENABLED && (
          <ContextMenuItem
            onSelect={() => openChatWith(userId)}
          >
            <MessageSquare className="size-4" />
            Message
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Clickable department name → department profile. Visible to admins; others see plain text. */
export function DepartmentProfileLink({
  departmentId,
  name,
  code,
  className,
}: {
  departmentId: string;
  name: string;
  code?: string;
  className?: string;
}) {
  const { user } = useAuthStore();
  const isAdmin = hasAnyRole(user, ['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN']);
  if (!departmentId) return <span className={className}>{name}</span>;
  if (!isAdmin) return <span className={cn('font-medium', className)}>{name}</span>;
  return (
    <Link
      href={`/admin/departments/${departmentId}`}
      className={cn(
        'font-medium underline-offset-2 hover:underline hover:text-primary transition-colors',
        className
      )}
    >
      {name}
      {code && <span className="text-muted-foreground font-normal ml-1">({code})</span>}
    </Link>
  );
}

/** Clickable division name → division profile. Requires departmentId + divisionId. */
export function DivisionProfileLink({
  departmentId,
  divisionId,
  name,
  className,
}: {
  departmentId: string;
  divisionId: string;
  name: string;
  className?: string;
}) {
  const { user } = useAuthStore();
  const isAdmin = hasAnyRole(user, ['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN']);
  if (!departmentId || !divisionId) return <span className={className}>{name}</span>;
  if (!isAdmin) return <span className={cn('font-medium', className)}>{name}</span>;
  return (
    <Link
      href={`/admin/departments/${departmentId}/divisions/${divisionId}`}
      className={cn(
        'font-medium underline-offset-2 hover:underline hover:text-primary transition-colors',
        className
      )}
    >
      {name}
    </Link>
  );
}
