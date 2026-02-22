'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { hasAnyRole } from '@/lib/auth-utils';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Users, Plus, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { API_BASE_URL as WS_BASE } from '@/lib/api';

type Conversation = {
  id: string;
  type: 'DM' | 'GROUP';
  name: string | null;
  description: string | null;
  lastMessageAt: string | null;
  members: Array<{
    id: string;
    role: string;
    user: { id: string; name: string; username: string; email?: string };
  }>;
  createdBy: { id: string; name: string; username: string };
  _count: { messages: number };
};

const GROUP_CREATOR_ROLES = ['SUPER_ADMIN', 'DEPT_ADMIN', 'CHAT_MANAGER'];

export default function ChatPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dmModal, setDmModal] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; username: string; department?: { name: string } }>>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [groupDepartmentId, setGroupDepartmentId] = useState<string>('');
  const canCreateGroup = user && hasAnyRole(user, GROUP_CREATOR_ROLES);

  useEffect(() => {
    if (!user || !token) {
      router.push('/login');
      return;
    }
    (async () => {
      try {
        const res = await api.get<Conversation[]>('/chat/conversations');
        setConversations(Array.isArray(res.data) ? res.data : []);
      } catch {
        setConversations([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, token, router]);

  const openDmModal = async () => {
    setDmModal(true);
    setSelectedUser('');
    try {
      const [usersRes, deptRes] = await Promise.all([
        api.get<typeof users>('/chat/users'),
        api.get<{ id: string; name: string }[]>('/departments').catch(() => ({ data: [] })),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
    } catch {
      setUsers([]);
    }
  };

  const startDm = async () => {
    if (!selectedUser) return;
    try {
      const res = await api.post<Conversation>(`/chat/dm/${selectedUser}`);
      setDmModal(false);
      router.push(`/chat/${res.data.id}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Failed to start conversation');
    }
  };

  const openGroupModal = async () => {
    setGroupModal(true);
    setGroupName('');
    setGroupDescription('');
    setGroupMemberIds([]);
    setGroupDepartmentId('');
    try {
      const [usersRes, deptRes] = await Promise.all([
        api.get<typeof users>('/chat/users'),
        api.get<{ id: string; name: string }[]>('/departments').catch(() => ({ data: [] })),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
    } catch {
      setUsers([]);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    try {
      const res = await api.post<Conversation>('/chat/groups', {
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        departmentId: groupDepartmentId || undefined,
        memberIds: groupMemberIds.length ? groupMemberIds : undefined,
      });
      setGroupModal(false);
      setConversations((prev) => [res.data, ...prev]);
      router.push(`/chat/${res.data.id}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Failed to create group');
    }
  };

  const displayName = (c: Conversation) => {
    if (c.type === 'GROUP' && c.name) return c.name;
    const other = c.members.find((m) => m.user.id !== user?.id);
    return other?.user?.name || other?.user?.username || 'Chat';
  };

  const filtered = conversations.filter((c) => {
    const name = displayName(c).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Chat</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openDmModal}>
            <MessageSquare className="mr-1 h-4 w-4" />
            New DM
          </Button>
          {canCreateGroup && (
            <Button variant="outline" size="sm" onClick={openGroupModal}>
              <Users className="mr-1 h-4 w-4" />
              New Group
            </Button>
          )}
        </div>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <ScrollArea className="flex-1 pr-2">
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">No conversations yet. Start a DM or create a group.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                  onClick={() => router.push(`/chat/${c.id}`)}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback>
                      {c.type === 'GROUP' ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        (displayName(c).charAt(0) || '?').toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{displayName(c)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.type === 'GROUP' ? `${c.members.length} members` : displayName(c)}
                      {c.lastMessageAt && ` · ${new Date(c.lastMessageAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <Dialog open={dmModal} onOpenChange={setDmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New direct message</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Select user</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDmModal(false)}>Cancel</Button>
            <Button onClick={startDm} disabled={!selectedUser}>Start chat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={groupModal} onOpenChange={setGroupModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Group name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Section A - Official"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Brief description"
                rows={2}
              />
            </div>
            {departments.length > 0 && (
              <div>
                <Label>Department (optional)</Label>
                <Select value={groupDepartmentId} onValueChange={setGroupDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Add members (optional)</Label>
              <Select
                value={groupMemberIds[0] ?? ''}
                onValueChange={(v) => setGroupMemberIds((prev) => (v ? [...new Set([...prev, v])] : prev))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select users to add" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => !groupMemberIds.includes(u.id))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.username})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {groupMemberIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {groupMemberIds.map((id) => {
                    const u = users.find((x) => x.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-sm"
                      >
                        {u?.name ?? id}
                        <button
                          type="button"
                          className="ml-1 rounded-full hover:bg-muted-foreground/20"
                          onClick={() => setGroupMemberIds((prev) => prev.filter((x) => x !== id))}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupModal(false)}>Cancel</Button>
            <Button onClick={createGroup} disabled={!groupName.trim()}>Create group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
