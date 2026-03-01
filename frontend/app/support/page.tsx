'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LifeBuoy, Plus, MessageSquare, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { hasAnyRole } from '@/lib/auth-utils';

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  WAITING_USER: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  RESOLVED: 'bg-green-500/10 text-green-700 border-green-500/20',
  CLOSED: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
};

export default function SupportTicketsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supportView = searchParams.get('supportView') === 'true';
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isSupport = hasAnyRole(user, ['DEVELOPER', 'SUPPORT', 'SUPER_ADMIN']);

  useEffect(() => {
    if (!user) return;
    const fetchTickets = async () => {
      try {
        const params = new URLSearchParams();
        if (supportView && isSupport) params.set('supportView', 'true');
        const res = await api.get(`/tickets?${params.toString()}`);
        setTickets(res.data || []);
      } catch {
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, [user, supportView, isSupport]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {supportView && isSupport ? 'Support Panel' : 'My Tickets'}
          </h1>
          <p className="text-muted-foreground">
            {supportView && isSupport
              ? 'View and respond to all support tickets.'
              : 'Track your support requests and replies.'}
          </p>
        </div>
        <div className="flex gap-2">
          {isSupport && (
            <Button
              variant={supportView ? 'default' : 'outline'}
              size="sm"
              onClick={() => router.push('/support?supportView=true')}
            >
              All tickets
            </Button>
          )}
          {isSupport && !supportView && (
            <Button variant="outline" size="sm" onClick={() => router.push('/support')}>
              My tickets
            </Button>
          )}
          <Button asChild>
            <Link href="/support/new">
              <Plus className="h-4 w-4 mr-2" />
              New ticket
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LifeBuoy className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              {supportView && isSupport ? 'No tickets yet.' : "You haven't created any tickets yet."}
            </p>
            <Button asChild>
              <Link href="/support/new">
                <Plus className="h-4 w-4 mr-2" />
                Create a ticket
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Link key={t.id} href={`/support/${t.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{t.ticketNumber} — {t.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.createdBy?.name} · {new Date(t.createdAt).toLocaleDateString()}
                        {t._count?.replies != null && (
                          <> · <MessageSquare className="inline h-3 w-3 mr-0.5" /> {t._count.replies} replies</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={STATUS_COLOR[t.status] || ''}>
                        {t.status.replace('_', ' ')}
                      </Badge>
                      {supportView && t.assignedTo && (
                        <span className="text-xs text-muted-foreground">→ {t.assignedTo.name}</span>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
