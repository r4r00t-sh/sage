'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/store';
import { hasAnyRole } from '@/lib/auth-utils';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Users, Send, Loader2 } from 'lucide-react';
import { API_BASE_URL as WS_BASE } from '@/lib/api';

type Message = {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; username: string };
};

type Conversation = {
  id: string;
  type: 'DM' | 'GROUP';
  name: string | null;
  description: string | null;
  members: Array<{
    id: string;
    role: string;
    user: { id: string; name: string; username: string };
  }>;
  myRole: string;
};

const GROUP_CREATOR_ROLES = ['SUPER_ADMIN', 'DEPT_ADMIN', 'CHAT_MANAGER'];

export default function ChatConversationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user, token } = useAuthStore();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; username: string }>>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canManageGroup = user && hasAnyRole(user, GROUP_CREATOR_ROLES);
  const isGroup = conversation?.type === 'GROUP';
  const displayName =
    conversation?.type === 'GROUP' && conversation.name
      ? conversation.name
      : conversation?.members?.find((m) => m.user.id !== user?.id)?.user?.name ||
        conversation?.members?.find((m) => m.user.id !== user?.id)?.user?.username ||
        'Chat';

  const loadConversation = useCallback(async () => {
    if (!id || !user) return;
    try {
      const res = await api.get<Conversation>(`/chat/conversations/${id}`);
      setConversation(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number } };
      if (err.response?.status === 403 || err.response?.status === 404) {
        router.replace('/chat');
        return;
      }
      setConversation(null);
    }
  }, [id, user, router]);

  const loadMessages = useCallback(
    async (cursor?: string) => {
      if (!id) return;
      try {
        const url = cursor
          ? `/chat/conversations/${id}/messages?cursor=${cursor}&limit=50`
          : `/chat/conversations/${id}/messages?limit=50`;
        const res = await api.get<{ messages: Message[]; nextCursor: string | null }>(url);
        const list = res.data.messages || [];
        setMessages((prev) => (cursor ? [...list.reverse(), ...prev] : list));
        setNextCursor(res.data.nextCursor ?? null);
      } catch {
        setMessages([]);
        setNextCursor(null);
      }
    },
    [id],
  );

  useEffect(() => {
    if (!user || !token) {
      router.push('/login');
      return;
    }
    if (!id) return;
    (async () => {
      setLoading(true);
      await loadConversation();
      await loadMessages();
      setLoading(false);
    })();
  }, [id, user, token, router, loadConversation, loadMessages]);

  useEffect(() => {
    if (!id || !token || !user) return;
    const sock = io(`${WS_BASE}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });
    sock.on('connect', () => {
      sock.emit('join_conversation', { conversationId: id });
    });
    sock.on('new_message', (msg: Message & { conversationId?: string }) => {
      if (!msg?.id) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    setSocket(sock);
    return () => {
      sock.emit('leave_conversation', { conversationId: id });
      sock.disconnect();
    };
  }, [id, token, user]);

  useEffect(() => {
    if (conversation?.id) {
      api.post(`/chat/conversations/${id}/read`).catch(() => {});
    }
  }, [conversation?.id, id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !id) return;
    setSending(true);
    try {
      const res = await api.post<Message>(`/chat/conversations/${id}/messages`, { content: text });
      setMessages((prev) => [...prev, res.data]);
      setInput('');
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const openAddMembers = async () => {
    setAddMembersOpen(true);
    setSelectedUserIds([]);
    try {
      const res = await api.get<typeof users>('/chat/users');
      const list = Array.isArray(res.data) ? res.data : [];
      const memberIds = new Set(conversation?.members?.map((m) => m.user.id) ?? []);
      setUsers(list.filter((u) => !memberIds.has(u.id)));
    } catch {
      setUsers([]);
    }
  };

  const addMembers = async () => {
    if (selectedUserIds.length === 0) return;
    try {
      await api.post(`/chat/conversations/${id}/members`, { userIds: selectedUserIds });
      await loadConversation();
      setAddMembersOpen(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Failed to add members');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Conversation not found.</p>
        <Button variant="outline" onClick={() => router.push('/chat')}>
          Back to Chat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col rounded-lg border bg-card">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/chat')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback>
            {isGroup ? <Users className="h-4 w-4" /> : (displayName.charAt(0) || '?').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {isGroup ? `${conversation.members.length} members` : conversation.members.find((m) => m.user.id !== user?.id)?.user?.username}
          </p>
        </div>
        {isGroup && canManageGroup && (
          <Button variant="outline" size="sm" onClick={openAddMembers}>
            <Users className="mr-1 h-4 w-4" />
            Add members
          </Button>
        )}
      </header>

      <ScrollArea className="flex-1 p-4">
        {nextCursor && (
          <div className="mb-2 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadMessages(nextCursor)}
            >
              Load older
            </Button>
          </div>
        )}
        <ul className="space-y-3">
          {messages.map((msg) => (
            <li
              key={msg.id}
              className={`flex gap-2 ${msg.sender.id === user?.id ? 'flex-row-reverse' : ''}`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs">
                  {msg.sender.name?.charAt(0) || msg.sender.username?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  msg.sender.id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                {!isGroup && msg.sender.id !== user?.id && (
                  <p className="text-xs font-medium opacity-90">{msg.sender.name}</p>
                )}
                <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                <p className="mt-1 text-xs opacity-70">
                  {new Date(msg.createdAt).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div ref={scrollRef} />
      </ScrollArea>

      <div className="border-t p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <Textarea
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={1}
            className="min-h-[44px] resize-none"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      <Dialog open={addMembersOpen} onOpenChange={setAddMembersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add members to group</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Select users</Label>
            <Select
              value={selectedUserIds[0] ?? ''}
              onValueChange={(v) =>
                setSelectedUserIds((prev) => (v ? [...new Set([...prev, v])] : prev))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose users" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedUserIds.map((uid) => {
                  const u = users.find((x) => x.id === uid);
                  return (
                    <span
                      key={uid}
                      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-sm"
                    >
                      {u?.name ?? uid}
                      <button
                        type="button"
                        className="ml-1 rounded hover:bg-muted-foreground/20"
                        onClick={() => setSelectedUserIds((prev) => prev.filter((x) => x !== uid))}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMembersOpen(false)}>Cancel</Button>
            <Button onClick={addMembers} disabled={selectedUserIds.length === 0}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
