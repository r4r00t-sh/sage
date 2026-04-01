'use client';

import { useState, useEffect } from 'react';
import { Bell, Check, X, FileText, MessageSquare, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

type NotificationType = 'file' | 'chat' | 'system' | 'user';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
  fileId?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
}

const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'file',
  'chat',
  'system',
  'user',
];

function parseNotificationType(raw: unknown): NotificationType {
  const s = typeof raw === 'string' ? raw : '';
  return NOTIFICATION_TYPES.includes(s as NotificationType)
    ? (s as NotificationType)
    : 'system';
}

export function NotificationCenter() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await api.get('/notifications');
      const data = Array.isArray(response.data) ? response.data : [];
      setNotifications(
        data.map((raw: unknown) => {
          const n = raw as Record<string, unknown>;
          const meta =
            n.metadata && typeof n.metadata === 'object' && n.metadata !== null
              ? (n.metadata as Record<string, unknown>)
              : undefined;
          return {
            id: String(n.id ?? ''),
            type: parseNotificationType(n.type),
            title: (typeof n.title === 'string' ? n.title : null) || 'Notification',
            message: (typeof n.message === 'string' ? n.message : '') || '',
            read: Boolean(n.read ?? n.isRead),
            createdAt:
              (typeof n.createdAt === 'string' ? n.createdAt : null) || new Date().toISOString(),
            link:
              (typeof n.link === 'string' ? n.link : undefined) ??
              (meta && typeof meta.link === 'string' ? meta.link : undefined),
            fileId: typeof n.fileId === 'string' ? n.fileId : undefined,
            priority: typeof n.priority === 'string' ? n.priority : undefined,
            metadata:
              n.metadata && typeof n.metadata === 'object' && n.metadata !== null
                ? (n.metadata as Record<string, unknown>)
                : undefined,
          };
        }),
      );
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/dismiss`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasUrgentUnread = notifications.some((n) => !n.read && (n.priority === 'urgent' || n.priority === 'high'));

  const getIcon = (type: string) => {
    switch (type) {
      case 'file': return <FileText className="h-4 w-4" />;
      case 'chat': return <MessageSquare className="h-4 w-4" />;
      case 'user': return <UserPlus className="h-4 w-4" />;
      case 'system': return <AlertCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const openNotification = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
      setOpen(false);
      return;
    }
    // backend-backed notifications: metadata.link or fileId are used for deep-linking
    try {
      const raw = notifications.find((n) => n.id === notification.id);
      const meta = raw?.metadata;
      const metadataLink =
        meta && typeof meta === 'object' && meta !== null && 'link' in meta && typeof (meta as { link: unknown }).link === 'string'
          ? (meta as { link: string }).link
          : undefined;
      const fileId = raw?.fileId;
      if (typeof metadataLink === 'string' && metadataLink) {
        router.push(metadataLink);
      } else if (typeof fileId === 'string' && fileId) {
        router.push(`/files/${fileId}`);
      }
    } finally {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="secondary"
              className={`absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs text-white ${hasUrgentUnread ? 'bg-red-600' : 'bg-green-600'}`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 transition-colors ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => openNotification(notification)}
                >
                  <div className="flex gap-3">
                    <div className={`mt-1 ${!notification.read ? 'text-primary' : 'text-muted-foreground'}`}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => markAsRead(notification.id)}
                          >
                            Mark read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
