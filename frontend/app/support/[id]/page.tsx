'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageSquare, User, Headphones } from 'lucide-react';
import api from '@/lib/api';
import { hasAnyRole } from '@/lib/auth-utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'];
const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  IN_PROGRESS: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  WAITING_USER: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  RESOLVED: 'bg-green-500/10 text-green-700 border-green-500/20',
  CLOSED: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
};

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuthStore();
  const [ticket, setTicket] = useState<any>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isSupport = hasAnyRole(user, ['DEVELOPER', 'SUPPORT', 'SUPER_ADMIN']);

  const loadTicket = async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      setTicket(res.data);
    } catch {
      toast.error('Ticket not found');
      router.replace('/support');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !id) return;
    loadTicket();
  }, [user, id]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/tickets/${id}/replies`, { content: replyContent.trim() });
      setReplyContent('');
      await loadTicket();
      toast.success('Reply sent');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!isSupport) return;
    try {
      await api.post(`/tickets/${id}/status`, { status });
      await loadTicket();
      toast.success('Status updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  if (!user) return null;
  if (loading || !ticket) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/support">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{ticket.ticketNumber}</h1>
            <p className="text-muted-foreground">{ticket.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={STATUS_COLOR[ticket.status] || ''}>
            {ticket.status.replace('_', ' ')}
          </Badge>
          {isSupport && (
            <Select value={ticket.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {ticket.createdBy?.name} ({ticket.createdBy?.username})
            </span>
            <span>·</span>
            <span>{new Date(ticket.createdAt).toLocaleString()}</span>
            {ticket.assignedTo && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Headphones className="h-4 w-4" />
                  Assigned to {ticket.assignedTo.name}
                </span>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Replies ({ticket.replies?.length ?? 0})
        </h2>
        {ticket.replies?.length ? (
          <div className="space-y-3">
            {ticket.replies.map((r: any) => (
              <Card key={r.id} className={r.isSupportReply ? 'border-l-4 border-l-primary' : ''}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <span className="font-medium text-foreground">{r.repliedBy?.name}</span>
                    {r.isSupportReply && (
                      <Badge variant="secondary" className="text-xs">Support</Badge>
                    )}
                    <span>{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{r.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No replies yet.</p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add reply</CardTitle>
            <CardDescription>Your message will be visible to support and linked to this ticket.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReply} className="space-y-3">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Type your reply..."
                rows={4}
              />
              <Button type="submit" disabled={submitting || !replyContent.trim()}>
                {submitting ? 'Sending...' : 'Send reply'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
