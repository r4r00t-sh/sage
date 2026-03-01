'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { hasAnyRole } from '@/lib/auth-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Clock,
  AlertTriangle,
  ArrowRight,
  Plus,
  Inbox,
  Users,
  Search,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Timer,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { RecentFiles } from '@/components/recent-files';
import { DepartmentProfileLink } from '@/components/profile-links';

interface RecentFile {
  id: string;
  status: string;
  priority?: string;
  subject?: string;
  isRedListed?: boolean;
  fileNumber?: string;
  department?: { id?: string; name: string };
  createdAt?: string;
}

interface DashboardStats {
  totalFiles: number;
  pendingFiles: number;
  inProgressFiles: number;
  approvedFiles: number;
  rejectedFiles: number;
  redListedFiles: number;
  recentFiles: RecentFile[];
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/files');
      const files = response.data.data || response.data || [];

      const stats: DashboardStats = {
        totalFiles: files.length,
        pendingFiles: files.filter((f: Record<string, unknown>) => f.status === 'PENDING').length,
        inProgressFiles: files.filter((f: Record<string, unknown>) => f.status === 'IN_PROGRESS').length,
        approvedFiles: files.filter((f: Record<string, unknown>) => f.status === 'APPROVED').length,
        rejectedFiles: files.filter((f: Record<string, unknown>) => f.status === 'REJECTED').length,
        redListedFiles: files.filter((f: Record<string, unknown>) => f.isRedListed).length,
        recentFiles: files.slice(0, 6),
      };

      setStats(stats);
    } catch (error) {
      console.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
      PENDING: { color: 'text-amber-600', bgColor: 'bg-amber-500/10', icon: Clock, label: 'Pending' },
      IN_PROGRESS: { color: 'text-blue-600', bgColor: 'bg-blue-500/10', icon: TrendingUp, label: 'In Progress' },
      APPROVED: { color: 'text-green-600', bgColor: 'bg-green-500/10', icon: CheckCircle2, label: 'Approved' },
      REJECTED: { color: 'text-red-600', bgColor: 'bg-red-500/10', icon: XCircle, label: 'Rejected' },
      ON_HOLD: { color: 'text-gray-600', bgColor: 'bg-gray-500/10', icon: Timer, label: 'On Hold' },
    };
    return config[status] || config.PENDING;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'bg-slate-400',
      NORMAL: 'bg-blue-500',
      HIGH: 'bg-orange-500',
      URGENT: 'bg-red-500',
    };
    return colors[priority] || 'bg-slate-400';
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          <Skeleton className="h-[500px] lg:col-span-2" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {user?.name?.split(' ')[0]}!
            </h1>
            <Sparkles className="h-6 w-6 text-amber-500" />
          </div>
          <p className="text-muted-foreground text-lg">
            Here&apos;s an overview of your file activity for today, {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="lg" onClick={() => router.push('/files/track')}>
            <Search className="mr-2 h-5 w-5" />
            Track File
          </Button>
          {hasAnyRole(user, ['INWARD_DESK', 'SECTION_OFFICER', 'DEPT_ADMIN', 'SUPER_ADMIN']) && (
            <Button size="lg" onClick={() => router.push('/files/new')}>
              <Plus className="mr-2 h-5 w-5" />
              Create New File
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 transition-all duration-300 group" onClick={() => router.push('/files/inbox')}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-primary transition-colors">Total Files</p>
                <p className="text-4xl font-bold group-hover:scale-105 transition-transform inline-block">{stats?.totalFiles || 0}</p>
                <p className="text-sm text-muted-foreground mt-2">All files in system</p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <FileText className="h-7 w-7 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-amber-500/50 transition-all duration-300 group" onClick={() => router.push('/files/inbox?status=PENDING')}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-amber-600 transition-colors">Pending</p>
                <p className="text-4xl font-bold text-amber-600 group-hover:scale-105 transition-transform inline-block">{stats?.pendingFiles || 0}</p>
                <p className="text-sm text-muted-foreground mt-2">Awaiting your action</p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <Clock className="h-7 w-7 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-blue-500/50 transition-all duration-300 group" onClick={() => router.push('/files/inbox?status=IN_PROGRESS')}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-blue-600 transition-colors">In Progress</p>
                <p className="text-4xl font-bold text-blue-600 group-hover:scale-105 transition-transform inline-block">{stats?.inProgressFiles || 0}</p>
                <p className="text-sm text-muted-foreground mt-2">Being processed</p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <TrendingUp className="h-7 w-7 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-red-500/50 transition-all duration-300 group ${stats?.redListedFiles ? 'ring-2 ring-red-500/50 animate-pulse-slow' : ''}`}
          onClick={() => router.push('/files/inbox?redlisted=true')}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-red-600 transition-colors">Red Listed</p>
                <p className="text-4xl font-bold text-red-600 group-hover:scale-105 transition-transform inline-block">{stats?.redListedFiles || 0}</p>
                <p className="text-sm text-muted-foreground mt-2">Overdue files</p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-red-500/10 group-hover:bg-red-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Recent Files */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Recent Files</CardTitle>
                <CardDescription className="mt-1">
                  Latest files that need your attention
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => router.push('/files/inbox')}>
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.recentFiles?.length === 0 ? (
              <div className="text-center py-16">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                  <Inbox className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No files yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first file to get started
                </p>
                {hasAnyRole(user, ['INWARD_DESK', 'DEPT_ADMIN', 'SUPER_ADMIN']) && (
                  <Button onClick={() => router.push('/files/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create File
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.recentFiles?.map((file) => {
                  const statusConfig = getStatusConfig(file.status);
                  const StatusIcon = statusConfig.icon;
                  return (
                    <div
                      key={file.id}
                      className="flex items-center gap-4 p-4 rounded-xl border hover:bg-muted/50 cursor-pointer transition-all duration-200 group"
                      onClick={() => router.push(`/files/${file.id}`)}
                    >
                      <div className="flex-shrink-0">
                        <div className={`h-3 w-3 rounded-full ${getPriorityColor(file.priority ?? 'NORMAL')}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate group-hover:text-primary transition-colors">
                            {file.subject}
                          </p>
                          {file.isRedListed && (
                            <Badge variant="destructive" className="text-xs">RED</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                            {file.fileNumber}
                          </code>
                          <span>•</span>
                          {file.department ? (
                            file.department.id ? (
                              <DepartmentProfileLink departmentId={file.department.id} name={file.department.name} />
                            ) : (
                              <span>{file.department.name}</span>
                            )
                          ) : null}
                          {file.createdAt && (
                            <>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`gap-1.5 ${statusConfig.color} ${statusConfig.bgColor} border-0`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusConfig.label}
                      </Badge>
                      <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-12 text-base"
                onClick={() => router.push('/files/inbox')}
              >
                <Inbox className="mr-3 h-5 w-5" />
                View Inbox
                {stats?.pendingFiles ? (
                  <Badge className="ml-auto">{stats.pendingFiles}</Badge>
                ) : null}
              </Button>
              
              {hasAnyRole(user, ['INWARD_DESK', 'SECTION_OFFICER', 'DEPT_ADMIN', 'SUPER_ADMIN']) && (
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-base"
                  onClick={() => router.push('/files/new')}
                >
                  <Plus className="mr-3 h-5 w-5" />
                  Create New File
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start h-12 text-base"
                onClick={() => router.push('/files/track')}
              >
                <Search className="mr-3 h-5 w-5" />
                Track File
              </Button>
              
              {hasAnyRole(user, ['DEPT_ADMIN', 'SUPER_ADMIN']) && (
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 text-base"
                  onClick={() => router.push('/admin/users')}
                >
                  <Users className="mr-3 h-5 w-5" />
                  Manage Users
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Recent Files Widget */}
          <RecentFiles />
        </div>
      </div>
    </div>
  );
}
