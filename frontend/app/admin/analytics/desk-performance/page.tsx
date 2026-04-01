'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Building2, Users, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { hasGodRole } from '@/lib/auth-utils';

interface DepartmentAnalytics {
  id: string;
  name: string;
  code: string;
  totalFiles: number;
  totalUsers: number;
  pendingFiles: number;
  inProgressFiles: number;
  completedFiles: number;
  redListedFiles: number;
  avgProcessingTimeHours: number | null;
  avgUserPoints: number;
  efficiency: number;
}

interface DashboardSummary {
  totalFiles: number;
  pendingFiles: number;
  inProgressFiles: number;
  completedFiles: number;
  redListedFiles: number;
  avgProcessingTimeHours: number | null;
  totalUsers: number;
  activeUsersToday: number;
}

interface DashboardAnalytics {
  summary: DashboardSummary;
}

interface UserPerformance {
  id: string;
  name: string;
  username: string;
  department?: string;
  division?: string;
  completedFiles: number;
  redListedFiles: number;
  performanceScore: number;
}

export default function DeskPerformancePage() {
  const { user } = useAuthStore();
  const isSuperAdmin = hasGodRole(user);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'department' | 'users'>('department');
  const [loading, setLoading] = useState(true);
  const [departmentAnalytics, setDepartmentAnalytics] = useState<DepartmentAnalytics[]>([]);
  const [dashboard, setDashboard] = useState<DashboardAnalytics | null>(null);
  const [users, setUsers] = useState<UserPerformance[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (isSuperAdmin) {
          const [deptRes, usersRes] = await Promise.all([
            api.get('/analytics/departments'),
            api.get('/analytics/users'),
          ]);
          setDepartmentAnalytics(deptRes.data);
          setUsers(usersRes.data);
        } else {
          const [dashRes, usersRes] = await Promise.all([
            api.get('/analytics/dashboard'),
            api.get('/analytics/users'),
          ]);
          setDashboard(dashRes.data);
          setUsers(usersRes.data);
        }
      } catch (err: unknown) {
        toast.error('Failed to load desk performance analytics', {
          description: apiErrorMessage(err, 'Please try again'),
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isSuperAdmin]);

  const renderDeptEfficiencyBadge = (efficiency: number) => {
    return (
      <Badge
        variant="outline"
        className={cn(
          efficiency >= 80 && 'bg-emerald-500/10 text-emerald-600',
          efficiency >= 50 && efficiency < 80 && 'bg-amber-500/10 text-amber-600',
          efficiency < 50 && 'bg-red-500/10 text-red-600',
        )}
      >
        {efficiency}% Efficiency
      </Badge>
    );
  };

  const renderUserStars = (score: number) => {
    const normalized = Math.max(0, Math.min(100, score));
    const stars = Math.round((normalized / 100) * 5);
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={cn('text-xs', i < stars ? 'text-amber-400' : 'text-muted-foreground/40')}>
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Desk Performance Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Department and user level desk analytics, with inputs auto-fetched from live data.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'department' | 'users')} className="space-y-4">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="department" className="gap-2">
            <Building2 className="h-4 w-4" />
            Department
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="department" className="space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading department analytics…</p>
          )}

          {!loading && isSuperAdmin && departmentAnalytics.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {departmentAnalytics.map((dept) => (
                <Card
                  key={dept.id}
                  className="cursor-pointer transition hover:border-primary/40 hover:shadow-md"
                  onClick={() => router.push(`/admin/departments/${dept.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span>{dept.name}</span>
                      </span>
                      {renderDeptEfficiencyBadge(dept.efficiency)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-md bg-muted/40 px-2 py-2 text-center">
                        <p className="font-mono text-[10px] text-muted-foreground">TOTAL FILES</p>
                        <p className="mt-1 text-base font-semibold">{dept.totalFiles}</p>
                      </div>
                      <div className="rounded-md bg-amber-500/10 px-2 py-2 text-center">
                        <p className="font-mono text-[10px] text-amber-700 dark:text-amber-300">PENDING</p>
                        <p className="mt-1 text-base font-semibold text-amber-600 dark:text-amber-300">
                          {dept.pendingFiles}
                        </p>
                      </div>
                      <div className="rounded-md bg-emerald-500/10 px-2 py-2 text-center">
                        <p className="font-mono text-[10px] text-emerald-700 dark:text-emerald-300">COMPLETED</p>
                        <p className="mt-1 text-base font-semibold text-emerald-600 dark:text-emerald-300">
                          {dept.completedFiles}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-md bg-red-500/10 px-2 py-2 text-center">
                        <p className="font-mono text-[10px] text-red-700 dark:text-red-300">RED LISTED</p>
                        <p className="mt-1 text-base font-semibold text-red-600 dark:text-red-300">
                          {dept.redListedFiles}
                        </p>
                      </div>
                      <div className="rounded-md bg-blue-500/10 px-2 py-2 text-center">
                        <p className="font-mono text-[10px] text-blue-700 dark:text-blue-300">USERS</p>
                        <p className="mt-1 text-base font-semibold text-blue-600 dark:text-blue-300">
                          {dept.totalUsers}
                        </p>
                      </div>
                  <div className="rounded-md bg-purple-500/10 px-2 py-2 text-center">
                    <p className="font-mono text-[10px] text-purple-700 dark:text-purple-300">RATING</p>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      {renderUserStars(Math.max(0, Math.min(100, (dept.avgUserPoints / 1000) * 100)))}
                    </div>
                  </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        Avg processing:{' '}
                        {dept.avgProcessingTimeHours != null ? `${dept.avgProcessingTimeHours}h` : 'N/A'}
                      </span>
                      <span className="font-mono text-[10px]">{dept.code}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && !isSuperAdmin && dashboard && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>My Department</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid gap-2 md:grid-cols-4">
                  <div className="rounded-md bg-muted/40 px-3 py-3 text-center">
                    <p className="font-mono text-[10px] text-muted-foreground">TOTAL FILES</p>
                    <p className="mt-1 text-xl font-semibold">
                      {dashboard.summary.totalFiles}
                    </p>
                  </div>
                  <div className="rounded-md bg-amber-500/10 px-3 py-3 text-center">
                    <p className="font-mono text-[10px] text-amber-700 dark:text-amber-300">PENDING</p>
                    <p className="mt-1 text-xl font-semibold text-amber-600 dark:text-amber-300">
                      {dashboard.summary.pendingFiles}
                    </p>
                  </div>
                  <div className="rounded-md bg-emerald-500/10 px-3 py-3 text-center">
                    <p className="font-mono text-[10px] text-emerald-700 dark:text-emerald-300">COMPLETED</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-300">
                      {dashboard.summary.completedFiles}
                    </p>
                  </div>
                  <div className="rounded-md bg-red-500/10 px-3 py-3 text-center">
                    <p className="font-mono text-[10px] text-red-700 dark:text-red-300">RED LISTED</p>
                    <p className="mt-1 text-xl font-semibold text-red-600 dark:text-red-300">
                      {dashboard.summary.redListedFiles}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-md bg-blue-500/10 px-3 py-3 text-center">
                    <p className="font-mono text-[10px] text-blue-700 dark:text-blue-300">USERS</p>
                    <p className="mt-1 text-lg font-semibold text-blue-600 dark:text-blue-300">
                      {dashboard.summary.totalUsers}
                    </p>
                  </div>
                  <div className="rounded-md bg-green-500/10 px-3 py-3 text-center">
                    <p className="font-mono text-[10px] text-green-700 dark:text-green-300">ACTIVE TODAY</p>
                    <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-300">
                      {dashboard.summary.activeUsersToday}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-3 text-center">
                    <p className="font-mono text-[10px] text-muted-foreground">AVG PROCESSING</p>
                    <p className="mt-1 text-lg font-semibold">
                      {dashboard.summary.avgProcessingTimeHours != null
                        ? `${dashboard.summary.avgProcessingTimeHours}h`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !dashboard && !departmentAnalytics.length && (
            <p className="text-sm text-muted-foreground">
              No department analytics available.
            </p>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading user analytics…</p>
          )}

          {!loading && users.length === 0 && (
            <p className="text-sm text-muted-foreground">No user analytics available.</p>
          )}

          {!loading && users.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-primary" />
                  <span>User desk performance (auto-calculated)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">#</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Red Listed</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u, idx) => (
                      <TableRow
                        key={u.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push(`/admin/users/${u.id}`)}
                      >
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{u.name}</span>
                            <span className="text-[11px] text-muted-foreground">@{u.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{u.department || '-'}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {u.division || ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
                            {u.completedFiles}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {u.redListedFiles > 0 ? (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600">
                              {u.redListedFiles}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted/40 text-muted-foreground">
                              0
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            {renderUserStars(u.performanceScore)}
                            <span className="text-[11px] text-muted-foreground">
                              {(u.performanceScore / 10).toFixed(1)}/10
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

