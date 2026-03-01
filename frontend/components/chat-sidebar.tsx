'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { hasAnyRole } from '@/lib/auth-utils';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Users,
  Plus,
  Search,
  ArrowLeft,
  Send,
  Loader2,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
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
  myRole?: string;
};

type Message = {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; username: string };
};

type ConversationDetail = Conversation & {
  myRole: string;
};

const GROUP_CREATOR_ROLES = ['SUPER_ADMIN', 'DEPT_ADMIN', 'CHAT_MANAGER'];

type ChatSidebarProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openWithUserId?: string | null;
  clearOpenWithUserId?: () => void;
};

export function ChatSidebar({ open, onOpenChange, openWithUserId, clearOpenWithUserId }: ChatSidebarProps) {
  const { user, token } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [dmModal, setDmModal] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string; username: string; department?: { name: string } }>>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [groupDepartmentId, setGroupDepartmentId] = useState<string>('');
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canCreateGroup = user && hasAnyRole(user, GROUP_CREATOR_ROLES);
  const canManageGroup = user && hasAnyRole(user, GROUP_CREATOR_ROLES);
  const isGroup = conversation?.type === 'GROUP';
  const displayName =
    conversation?.type === 'GROUP' && conversation.name
      ? conversation.name
      : conversation?.members?.find((m) => m.user.id !== user?.id)?.user?.name ||
        conversation?.members?.find((m) => m.user.id !== user?.id)?.user?.username ||
        'Chat';

  const listDisplayName = (c: Conversation) => {
    if (c.type === 'GROUP' && c.name) return c.name;
    const other = c.members.find((m) => m.user.id !== user?.id);
    return other?.user?.name || other?.user?.username || 'Chat';
  };

  const loadConversations = useCallback(async () => {
    if (!user || !token) return;
    try {
      const res = await api.get<Conversation[]>('/chat/conversations');
      setConversations(Array.isArray(res.data) ? res.data : []);
    } catch {
      setConversations([]);
    } finally {
      setListLoading(false);
    }
  }, [user, token]);

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await api.get<ConversationDetail>(`/chat/conversations/${id}`);
        setConversation(res.data);
      } catch {
        setConversation(null);
      }
    },
    [],
  );

  const loadMessages = useCallback(
    async (id: string, cursor?: string) => {
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
    [],
  );

  useEffect(() => {
    if (!open || !user || !token) return;
    setListLoading(true);
    loadConversations();
  }, [open, user, token, loadConversations]);

  // SAGE Req 4: Open DM when openWithUserId is set (clickable username elsewhere)
  useEffect(() => {
    if (!open || !openWithUserId || openWithUserId === user?.id || !token) return;
    (async () => {
      try {
        const res = await api.post<{ id: string }>(`/chat/dm/${openWithUserId}`);
        if (res.data?.id) {
          setSelectedId(res.data.id);
          loadConversations();
        }
      } finally {
        clearOpenWithUserId?.();
      }
    })();
  }, [open, openWithUserId, user?.id, token, clearOpenWithUserId, loadConversations]);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setConversation(null);
      setMessages([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!selectedId || !open) return;
    setThreadLoading(true);
    (async () => {
      await loadConversation(selectedId);
      await loadMessages(selectedId);
      setThreadLoading(false);
    })();
  }, [selectedId, open, loadConversation, loadMessages]);

  useEffect(() => {
    if (!selectedId || !token || !user) return;
    const sock = io(`${WS_BASE}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });
    sock.on('connect', () => {
      sock.emit('join_conversation', { conversationId: selectedId });
    });
    sock.on('new_message', (msg: Message & { conversationId?: string }) => {
      if (!msg?.id) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    setSocket(sock);
    return () => {
      sock.emit('leave_conversation', { conversationId: selectedId });
      sock.disconnect();
    };
  }, [selectedId, token, user]);

  useEffect(() => {
    if (conversation?.id && selectedId) {
      api.post(`/chat/conversations/${selectedId}/read`).catch(() => {});
    }
  }, [conversation?.id, selectedId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setConversations((prev) => [res.data, ...prev]);
      setSelectedId(res.data.id);
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
      setSelectedId(res.data.id);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Failed to create group');
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !selectedId) return;
    setSending(true);
    try {
      const res = await api.post<Message>(`/chat/conversations/${selectedId}/messages`, { content: text });
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
    if (selectedUserIds.length === 0 || !selectedId) return;
    try {
      await api.post(`/chat/conversations/${selectedId}/members`, { userIds: selectedUserIds });
      await loadConversation(selectedId);
      setAddMembersOpen(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Failed to add members');
    }
  };

  const filtered = conversations.filter((c) => {
    const name = listDisplayName(c).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const showList = selectedId === null;
  const showThread = selectedId !== null;

  if (!user) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-l p-0 sm:max-w-md"
          showCloseButton={true}
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              {showThread ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      setSelectedId(null);
                      setConversation(null);
                      setMessages([]);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  Chat
                </>
              ) : (
                'Chat'
              )}
            </SheetTitle>
          </SheetHeader>

          {showList && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex gap-2 border-b px-4 py-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={openDmModal}>
                  <MessageSquare className="mr-1 h-4 w-4" />
                  New DM
                </Button>
                {canCreateGroup && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={openGroupModal}>
                    <Users className="mr-1 h-4 w-4" />
                    New Group
                  </Button>
                )}
              </div>
              <div className="border-b px-4 py-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1 px-2">
                {listLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No conversations yet. Start a DM or create a group.
                  </p>
                ) : (
                  <ul className="space-y-1 py-2">
                    {filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/50"
                          onClick={() => setSelectedId(c.id)}
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="text-sm">
                              {c.type === 'GROUP' ? (
                                <Users className="h-4 w-4" />
                              ) : (
                                (listDisplayName(c).charAt(0) || '?').toUpperCase()
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{listDisplayName(c)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {c.type === 'GROUP' ? `${c.members.length} members` : ''}
                              {c.lastMessageAt && ` · ${new Date(c.lastMessageAt).toLocaleDateString()}`}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </div>
          )}

          {showThread && (
            <div className="flex flex-1 flex-col overflow-hidden">
              {threadLoading || !conversation ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">
                        {isGroup ? <Users className="h-4 w-4" /> : (displayName.charAt(0) || '?').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {isGroup ? `${conversation.members.length} members` : ''}
                      </p>
                    </div>
                    {isGroup && canManageGroup && (
                      <Button variant="outline" size="sm" onClick={openAddMembers}>
                        <Users className="h-4 w-4" />
                      </Button>
                    )}
                  </header>
                  <ScrollArea className="flex-1 px-3 py-2">
                    {nextCursor && (
                      <div className="mb-2 flex justify-center">
                        <Button variant="ghost" size="sm" onClick={() => selectedId && loadMessages(selectedId, nextCursor)}>
                          Load older
                        </Button>
                      </div>
                    )}
                    <ul className="space-y-2">
                      {messages.map((msg) => (
                        <li
                          key={msg.id}
                          className={`flex gap-2 ${msg.sender.id === user?.id ? 'flex-row-reverse' : ''}`}
                        >
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="text-xs">
                              {msg.sender.name?.charAt(0) || msg.sender.username?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm ${
                              msg.sender.id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}
                          >
                            {!isGroup && msg.sender.id !== user?.id && (
                              <p className="text-xs font-medium opacity-90">{msg.sender.name}</p>
                            )}
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className="mt-0.5 text-xs opacity-70">
                              {new Date(msg.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div ref={scrollRef} />
                  </ScrollArea>
                  <div className="shrink-0 border-t p-2">
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
                        className="min-h-[40px] resize-none text-sm"
                      />
                      <Button type="submit" size="icon" className="shrink-0" disabled={!input.trim() || sending}>
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

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
    </>
  );
}
