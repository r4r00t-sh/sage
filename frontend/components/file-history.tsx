'use client';

import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  RotateCcw,
  AlertTriangle,
  FileText,
  Play,
  Pause,
  TrendingUp,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuthStore, useChatStore } from '@/lib/store';
import { UserProfileLink } from '@/components/profile-links';

interface RoutingEntry {
  id: string;
  action: string;
  actionString?: string;
  remarks?: string;
  createdAt: string;
  fromUserId?: string;
  toUserId?: string;
  toDivisionId?: string;
  fromUser?: { id: string; name: string };
  toUser?: { id: string; name: string };
  toDivision?: { id: string; name: string };
}

interface FileHistoryProps {
  routingHistory: RoutingEntry[];
  createdAt?: string;
  createdBy?: { id: string; name: string };
}

const actionConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; label: string }> = {
  CREATED: { icon: FileText, color: 'text-primary', bgColor: 'bg-primary/10', label: 'Created' },
  FORWARDED: { icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-500/10', label: 'Forwarded' },
  APPROVED: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-500/10', label: 'Approved' },
  REJECTED: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-500/10', label: 'Rejected' },
  RETURNED_TO_HOST: { icon: RotateCcw, color: 'text-orange-600', bgColor: 'bg-orange-500/10', label: 'Returned to Host' },
  RETURNED_TO_PREVIOUS: { icon: ArrowRight, color: 'text-orange-600', bgColor: 'bg-orange-500/10', label: 'Returned' },
  ON_HOLD: { icon: Pause, color: 'text-amber-600', bgColor: 'bg-amber-500/10', label: 'Put on Hold' },
  RELEASED_FROM_HOLD: { icon: Play, color: 'text-green-600', bgColor: 'bg-green-500/10', label: 'Released' },
  RECALLED: { icon: AlertTriangle, color: 'text-purple-600', bgColor: 'bg-purple-500/10', label: 'Recalled' },
  CONSULTATION_SENT: { icon: TrendingUp, color: 'text-indigo-600', bgColor: 'bg-indigo-500/10', label: 'Sent for Consultation' },
  CONSULTATION_RETURNED: { icon: RotateCcw, color: 'text-indigo-600', bgColor: 'bg-indigo-500/10', label: 'Consultation Returned' },
  DISPATCHED: { icon: Send, color: 'text-teal-600', bgColor: 'bg-teal-500/10', label: 'Dispatched' },
  CLOSED: { icon: CheckCircle, color: 'text-gray-600', bgColor: 'bg-gray-500/10', label: 'Closed' },
  // Legacy string actions
  forward: { icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-500/10', label: 'Forwarded' },
  approve: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-500/10', label: 'Approved' },
  reject: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-500/10', label: 'Rejected' },
  return: { icon: RotateCcw, color: 'text-orange-600', bgColor: 'bg-orange-500/10', label: 'Returned' },
  hold: { icon: Pause, color: 'text-amber-600', bgColor: 'bg-amber-500/10', label: 'Put on Hold' },
  recall: { icon: AlertTriangle, color: 'text-purple-600', bgColor: 'bg-purple-500/10', label: 'Recalled' },
};

function UserNameLink({ userId, name }: { userId: string; name: string }) {
  const { user } = useAuthStore();
  const openChatWith = useChatStore((s) => s.openChatWith);
  if (!user || user.id === userId) {
    return <span className="font-medium text-foreground">{name}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => openChatWith(userId)}
      className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors duration-200 cursor-pointer"
    >
      {name}
    </button>
  );
}

export function FileHistory({ routingHistory, createdAt, createdBy }: FileHistoryProps) {
  // Build timeline including file creation
  const createdEntry: RoutingEntry | null = createdAt && createdBy ? {
    id: 'created',
    action: 'CREATED',
    remarks: `File created by ${createdBy.name}`,
    createdAt,
  } : null;

  const timelineEntries: RoutingEntry[] = [
    // Add file creation as first entry
    ...(createdEntry ? [createdEntry] : []),
    // Add all routing history
    ...routingHistory,
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (timelineEntries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No history yet</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Timeline line */}
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

      <div className="space-y-6">
        {timelineEntries.map((entry, index) => {
          const actionKey = entry.action || entry.actionString || 'forward';
          const config = actionConfig[actionKey] || actionConfig.forward;
          const Icon = config.icon;

          return (
            <div key={entry.id} className="relative">
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute -left-4 flex h-5 w-5 items-center justify-center rounded-full',
                  config.bgColor
                )}
              >
                <Icon className={cn('h-3 w-3', config.color)} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge 
                    variant="outline" 
                    className={cn('gap-1', config.bgColor, config.color, 'border-0')}
                  >
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                  </span>
                </div>

                {/* Show from/to info */}
                {(entry.fromUser || entry.toUser || entry.toDivision) && (
                  <p className="text-sm">
                    {entry.fromUser && (
                      <span className="text-muted-foreground">
                        From <UserNameLink userId={entry.fromUser.id} name={entry.fromUser.name} />
                      </span>
                    )}
                    {entry.toUser && (
                      <span className="text-muted-foreground">
                        {entry.fromUser && ' → '}
                        To <UserNameLink userId={entry.toUser.id} name={entry.toUser.name} />
                      </span>
                    )}
                    {entry.toDivision && !entry.toUser && (
                      <span className="text-muted-foreground">
                        {entry.fromUser && ' → '}
                        To <span className="font-medium text-foreground">{entry.toDivision.name}</span>
                      </span>
                    )}
                  </p>
                )}

                {entry.remarks && (
                  <p className="text-sm text-muted-foreground italic">
                    {entry.id === 'created' && createdBy ? (
                      <>{"\u0022"}File created by <UserProfileLink userId={createdBy.id} name={createdBy.name} />{"\u0022"}</>
                    ) : (
                      <>{'\u0022'}{entry.remarks}{'\u0022'}</>
                    )}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  {format(new Date(entry.createdAt), 'EEEE, MMM d, yyyy \'at\' h:mm a')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
