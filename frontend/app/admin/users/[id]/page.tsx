'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  User,
  Shield,
  Building2,
  MapPin,
  Trophy,
  Activity,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import api from '@/lib/api';
import { hasAnyRole, hasGodRole, getRoles } from '@/lib/auth-utils';
import { DepartmentProfileLink, DivisionProfileLink } from '@/components/profile-links';
import { format } from 'date-fns';

interface UserDetail {
  id: string;
  username: string;
  name: string;
  email?: string;
  designation?: string;
  staffId?: string;
  phone?: string;
  profileApprovalStatus?: string;
  approvedAt?: string;
  roles: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  department?: { id: string; name: string; code: string };
  division?: { id: string; name: string };
  points?: {
    id: string;
    currentPoints: number;
    basePoints: number;
    redListCount: number;
    monthlyBonus: number;
    streakMonths: number;
  };
  _count?: { filesCreated: number; filesAssigned: number; notes: number };
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  file?: { id: string; fileNumber: string; subject: string };
}

interface FileRouting {
  id: string;
  action: string;
  remarks?: string;
  timeSpentAtDesk?: number;
  wasOverdue: boolean;
  createdAt: string;
  file?: { id: string; fileNumber: string; subject: string; status: string };
}

interface PointsTransaction {
  id: string;
  amount: number;
  reason: string;
  description?: string;
  fileId?: string;
  createdAt: string;
}

interface Presence {
  status: string;
  statusLabel: string;
  lastPing?: string;
  loginTime?: string;
  logoutTime?: string;
  logoutType?: string;
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuthStore();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activity, setActivity] = useState<FileRouting[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([]);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [points, setPoints] = useState<{ currentPoints: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!hasAnyRole(currentUser, ['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN'])) {
      router.push('/dashboard');
      return;
    }
    fetchUser();
    fetchPresence();
    fetchPoints();
  }, [currentUser, userId]);

  const fetchUser = async () => {
    try {
      const response = await api.get(`/users/${userId}`);
      setUser(response.data);
    } catch {
      router.push('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const fetchPresence = async () => {
    try {
      const response = await api.get(`/users/${userId}/presence`);
      setPresence(response.data);
    } catch {
      setPresence({ status: 'ABSENT', statusLabel: 'Offline' });
    }
  };

  const fetchPoints = async () => {
    try {
      const response = await api.get(`/gamification/points/${userId}`);
      setPoints(response.data);
    } catch {
      setPoints(null);
    }
  };

  const fetchAuditLogs = async () => {
    setTabLoading((p) => ({ ...p, logs: true }));
    try {
      const response = await api.get(`/users/${userId}/audit-logs`, {
        params: { limit: 50 },
      });
      setAuditLogs(response.data);
    } catch {
      setAuditLogs([]);
    } finally {
      setTabLoading((p) => ({ ...p, logs: false }));
    }
  };

  const fetchActivity = async () => {
    setTabLoading((p) => ({ ...p, activity: true }));
    try {
      const response = await api.get(`/users/${userId}/activity`, {
        params: { limit: 50 },
      });
      setActivity(response.data);
    } catch {
      setActivity([]);
    } finally {
      setTabLoading((p) => ({ ...p, activity: false }));
    }
  };

  const fetchPointsHistory = async () => {
    setTabLoading((p) => ({ ...p, points: true }));
    try {
      const response = await api.get(`/gamification/points/${userId}/history`, {
        params: { limit: 50 },
      });
      setPointsHistory(response.data);
    } catch {
      setPointsHistory([]);
    } finally {
      setTabLoading((p) => ({ ...p, points: false }));
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      DEVELOPER: 'bg-amber-500/10 text-amber-600',
      SUPER_ADMIN: 'bg-purple-500/10 text-purple-600',
      DEPT_ADMIN: 'bg-blue-500/10 text-blue-600',
      SECTION_OFFICER: 'bg-green-500/10 text-green-600',
      INWARD_DESK: 'bg-orange-500/10 text-orange-600',
    };
    return colors[role] || 'bg-gray-500/10 text-gray-600';
  };

  const formatReason = (reason: string) => {
    return reason
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  if (loading || !user) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <Button variant="ghost" className="mb-4 -ml-2" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
              <p className="text-muted-foreground font-mono">@{user.username}</p>
              {user.email && (
                <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <div className="flex flex-wrap gap-1">
                  {getRoles(user).map((r) => (
                    <Badge key={r} className={getRoleBadge(r)}>
                      {r.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
                {user.isActive ? (
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-600">
                    <XCircle className="mr-1 h-3 w-3" />
                    Inactive
                  </Badge>
                )}
                {presence && (
                  <Badge
                    variant="outline"
                    className={
                      presence.status === 'ACTIVE'
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    }
                  >
                    {presence.statusLabel}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Card className="min-w-[100px]">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="text-xs">Points</span>
                </div>
                <p className="text-base font-semibold mt-0.5">
                  {points?.currentPoints ?? user.points?.currentPoints ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Files Created</p>
                <p className="text-xl font-bold">{user._count?.filesCreated ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Files Assigned</p>
                <p className="text-xl font-bold">{user._count?.filesAssigned ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium truncate">
                  {user.department ? (
                    <DepartmentProfileLink departmentId={user.department.id} name={user.department.name} />
                  ) : (
                    '—'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Division</p>
                <p className="font-medium truncate">
                  {user.division && user.department ? (
                    <DivisionProfileLink departmentId={user.department.id} divisionId={user.division.id} name={user.division.name} />
                  ) : user.division ? (
                    user.division.name
                  ) : (
                    '—'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs" onClick={fetchAuditLogs}>
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="activity" onClick={fetchActivity}>
            Activity
          </TabsTrigger>
          <TabsTrigger value="points" onClick={fetchPointsHistory}>
            Points History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Info
                </CardTitle>
                <CardDescription>User account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Joined</span>
                    <span>{format(new Date(user.createdAt), 'PPP')}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span>{format(new Date(user.updatedAt), 'PPP')}</span>
                  </div>
                  {user.designation != null && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Designation</span>
                      <span>{user.designation || '—'}</span>
                    </div>
                  )}
                  {user.staffId != null && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Staff ID</span>
                      <span>{user.staffId || '—'}</span>
                    </div>
                  )}
                  {user.phone != null && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Phone</span>
                      <span>{user.phone || '—'}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b items-center">
                    <span className="text-muted-foreground">Profile</span>
                    <span className="flex items-center gap-2">
                      {user.profileApprovalStatus === 'PENDING_APPROVAL' ? (
                        <Badge variant="secondary">Pending approval</Badge>
                      ) : user.profileApprovalStatus === 'APPROVED' ? (
                        <Badge variant="default">Approved</Badge>
                      ) : (
                        '—'
                      )}
                      {user.profileApprovalStatus === 'PENDING_APPROVAL' &&
                        hasGodRole(currentUser) && (
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await api.put(`/users/${user.id}/approve-profile`);
                                setUser((u) => (u ? { ...u, profileApprovalStatus: 'APPROVED', approvedAt: new Date().toISOString() } : null));
                              } catch (e: any) {
                                alert(e?.response?.data?.message || 'Failed to approve');
                              }
                            }}
                          >
                            Approve
                          </Button>
                        )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Session & Presence
                </CardTitle>
                <CardDescription>Current session status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {presence ? (
                  <div className="grid gap-3 text-sm">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Status</span>
                      <Badge
                        variant={
                          presence.status === 'ACTIVE' ? 'default' : 'secondary'
                        }
                      >
                        {presence.statusLabel}
                      </Badge>
                    </div>
                    {presence.lastPing && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Last Active</span>
                        <span>
                          {format(new Date(presence.lastPing), 'PPp')}
                        </span>
                      </div>
                    )}
                    {presence.loginTime && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Login Time</span>
                        <span>
                          {format(new Date(presence.loginTime), 'PPp')}
                        </span>
                      </div>
                    )}
                    {presence.logoutTime && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Logout Time</span>
                        <span>
                          {format(new Date(presence.logoutTime), 'PPp')}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No session data</p>
                )}
              </CardContent>
            </Card>
          </div>
          {user.points && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Points Summary
                </CardTitle>
                <CardDescription>Gamification and performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Points</p>
                    <p className="text-2xl font-bold">{user.points.currentPoints}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Base Points</p>
                    <p className="text-2xl font-bold">{user.points.basePoints}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Red List Count</p>
                    <p className="text-2xl font-bold">{user.points.redListCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Streak Months</p>
                    <p className="text-2xl font-bold">{user.points.streakMonths}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                System actions performed by this user
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tabLoading.logs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                  No audit logs found
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>File</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(log.createdAt), 'PPp')}
                        </TableCell>
                        <TableCell className="font-medium">{log.action}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {log.entityType} #{log.entityId.slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {log.file ? (
                            <Link
                              href={`/files/${log.file.id}`}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              {log.file.fileNumber}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>File Activity</CardTitle>
              <CardDescription>
                File routing and forwarding activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tabLoading.activity ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : activity.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                  No activity found
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Time at Desk</TableHead>
                      <TableHead>Overdue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(item.createdAt), 'PPp')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.action.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell>
                          {item.file ? (
                            <Link
                              href={`/files/${item.file.id}`}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              {item.file.fileNumber} - {item.file.subject?.slice(0, 30)}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </Link>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {item.timeSpentAtDesk != null
                            ? `${Math.round(item.timeSpentAtDesk / 3600)}h`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {item.wasOverdue ? (
                            <Badge variant="destructive">Yes</Badge>
                          ) : (
                            'No'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="points">
          <Card>
            <CardHeader>
              <CardTitle>Points History</CardTitle>
              <CardDescription>
                Points transactions and adjustments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tabLoading.points ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pointsHistory.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                  No points history found
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pointsHistory.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(tx.createdAt), 'PPp')}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              tx.amount >= 0
                                ? 'text-green-600 font-medium'
                                : 'text-red-600 font-medium'
                            }
                          >
                            {tx.amount >= 0 ? '+' : ''}
                            {tx.amount}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatReason(tx.reason)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {tx.description ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
