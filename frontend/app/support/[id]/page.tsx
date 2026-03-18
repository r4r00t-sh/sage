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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageSquare, User, Headphones, Shield, Key } from 'lucide-react';
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
  const [creatingUser, setCreatingUser] = useState(false);
  const [departments, setDepartments] = useState<
    { id: string; name: string; code: string; divisions: { id: string; name: string }[] }[]
  >([]);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    roles: ['USER'] as string[],
    departmentId: '',
    divisionId: '',
  });

  const isUserRequest =
    ticket?.category === 'user_new' ||
    ticket?.category === 'user_delete' ||
    ticket?.category === 'user_transfer';

  const selectedDepartment = departments.find((d) => d.id === userForm.departmentId);

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

  useEffect(() => {
    if (!isSupport) return;
    api
      .get('/departments')
      .then((res) => setDepartments(res.data))
      .catch(() => setDepartments([]));
  }, [isSupport]);

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

  const handleCreateUserFromTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username || !userForm.password || !userForm.confirmPassword) {
      toast.error('Username and password are required');
      return;
    }
    if (userForm.password !== userForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!userForm.departmentId) {
      toast.error('Department is required');
      return;
    }
    setCreatingUser(true);
    try {
      await api.post('/users', {
        username: userForm.username,
        password: userForm.password,
        name: userForm.username,
        roles: userForm.roles,
        departmentId: userForm.departmentId,
        divisionId: userForm.divisionId || undefined,
      });
      // Auto-reply on ticket with created credentials (as per workflow)
      await api.post(`/tickets/${id}/replies`, {
        content: `User account created from this request.\n\nUsername: ${userForm.username}\nPassword: ${userForm.password}`,
      });
      toast.success('User created and reply posted to ticket.');
      setUserForm({
        username: '',
        password: '',
        confirmPassword: '',
        roles: ['USER'],
        departmentId: '',
        divisionId: '',
      });
      await loadTicket();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
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

      {isSupport && isUserRequest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              User request tools
            </CardTitle>
            <CardDescription>
              Create a user account in response to this ticket. Credentials will be posted back to
              the ticket automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUserFromTicket} className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="Login username"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Temporary password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm password</Label>
                  <Input
                    type="password"
                    value={userForm.confirmPassword}
                    onChange={(e) =>
                      setUserForm({ ...userForm, confirmPassword: e.target.value })
                    }
                    placeholder="Confirm password"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={userForm.departmentId}
                    onValueChange={(val) =>
                      setUserForm({ ...userForm, departmentId: val, divisionId: '' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Division</Label>
                  <Select
                    value={userForm.divisionId}
                    onValueChange={(val) =>
                      setUserForm({ ...userForm, divisionId: val })
                    }
                    disabled={!userForm.departmentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedDepartment?.divisions.map((div) => (
                        <SelectItem key={div.id} value={div.id}>
                          {div.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={userForm.roles[0]}
                  onValueChange={(val) =>
                    setUserForm({ ...userForm, roles: [val] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEPT_ADMIN">Department Admin</SelectItem>
                    <SelectItem value="APPROVAL_AUTHORITY">Approval Authority</SelectItem>
                    <SelectItem value="SECTION_OFFICER">Section Officer</SelectItem>
                    <SelectItem value="INWARD_DESK">Inward Desk</SelectItem>
                    <SelectItem value="DISPATCHER">Dispatcher</SelectItem>
                    <SelectItem value="USER">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={creatingUser}>
                {creatingUser ? (
                  <>
                    <Key className="mr-2 h-4 w-4 animate-spin" />
                    Creating user...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Create user & reply
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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
