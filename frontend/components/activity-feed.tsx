'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/user-avatar';
import {
  FileText,
  MessageSquare,
  UserPlus,
  CheckCircle,
  XCircle,
  ArrowRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { UserProfileLink } from '@/components/profile-links';

interface Activity {
  id: string;
  type: 'file_created' | 'file_forwarded' | 'file_approved' | 'file_rejected' | 'comment_added' | 'user_assigned';
  user: {
    id: string;
    name: string;
    email?: string;
  };
  message: string;
  timestamp: string;
  link?: string;
  metadata?: unknown;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    
    // Poll for new activities every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchActivities = async () => {
    try {
      const response = await api.get('/activity/feed');
      setActivities(response.data);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'file_created':
        return <FileText className="h-4 w-4" />;
      case 'file_forwarded':
        return <ArrowRight className="h-4 w-4" />;
      case 'file_approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'file_rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'comment_added':
        return <MessageSquare className="h-4 w-4" />;
      case 'user_assigned':
        return <UserPlus className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
          <CardDescription>Real-time updates from your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activity Feed
        </CardTitle>
        <CardDescription>Real-time updates from your team</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <UserAvatar
                    name={activity.user.name}
                    email={activity.user.email}
                    size="md"
                    showOnlineStatus
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="text-sm">
                          <UserProfileLink userId={activity.user.id} name={activity.user.name} />{' '}
                          <span className="text-muted-foreground">{activity.message}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </span>
                          {activity.link && (
                            <Link
                              href={activity.link}
                              className="text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              View →
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="text-muted-foreground">
                        {getActivityIcon(activity.type)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
