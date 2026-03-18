'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Building2,
  Users,
  MapPin,
  FileText,
  User,
  ChevronRight,
  FolderTree,
  GitBranch,
} from 'lucide-react';
import api from '@/lib/api';
import { hasAnyRole, getRoles } from '@/lib/auth-utils';
import { toast } from 'sonner';

interface DepartmentProfile {
  id: string;
  name: string;
  code: string;
  organisation?: { id: string; name: string };
  defaultWorkflow?: { id: string; name: string; code: string; isActive: boolean } | null;
  _count?: { users: number; files: number };
  divisions: {
    id: string;
    name: string;
    code?: string;
    _count?: { users: number };
  }[];
  users: {
    id: string;
    name: string;
    username: string;
    roles: string[];
    designation?: string;
    staffId?: string;
    isActive: boolean;
    division?: { id: string; name: string; code: string };
  }[];
}

interface DepartmentAnalyticsSummary {
  id: string;
  totalFiles: number;
  pendingFiles: number;
  completedFiles: number;
  redListedFiles: number;
  avgProcessingTimeHours: number | null;
  efficiency: number;
}

export default function DepartmentProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuthStore();
  const departmentId = params.deptId as string;

  const [department, setDepartment] = useState<DepartmentProfile | null>(null);
  const [workflows, setWorkflows] = useState<{ id: string; name: string; code: string; isActive: boolean; departmentId?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const isSuperAdmin = hasAnyRole(currentUser, ['SUPER_ADMIN', 'DEVELOPER']);
  const [analytics, setAnalytics] = useState<DepartmentAnalyticsSummary | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'1d' | '7d' | '30d' | '90d' | '180d' | '365d'>('30d');

  useEffect(() => {
    if (!hasAnyRole(currentUser, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
      router.replace('/dashboard');
      return;
    }
    fetchDepartment();
  }, [currentUser, departmentId]);

  useEffect(() => {
    if (!department || !currentUser) return;
    if (hasAnyRole(currentUser, ['DEPT_ADMIN']) && !hasAnyRole(currentUser, ['SUPER_ADMIN'])) {
      if (department.id !== (currentUser as { departmentId?: string }).departmentId) {
        router.replace('/admin/departments');
      }
    }
  }, [department, currentUser, router]);

  const fetchDepartment = async () => {
    try {
      const res = await api.get(`/departments/${departmentId}`);
      setDepartment(res.data);
    } catch {
      router.replace('/admin/departments');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      if (isSuperAdmin) {
        const res = await api.get('/analytics/departments');
        const list = res.data as any[];
        const found = list.find((d) => d.id === departmentId);
        if (found) {
          setAnalytics({
            id: found.id,
            totalFiles: found.totalFiles ?? 0,
            pendingFiles: found.pendingFiles ?? 0,
            completedFiles: found.completedFiles ?? 0,
            redListedFiles: found.redListedFiles ?? 0,
            avgProcessingTimeHours: found.avgProcessingTimeHours ?? null,
            efficiency: found.efficiency ?? 0,
          });
        } else {
          setAnalytics(null);
        }
      } else {
        // Dept Admin: use dashboard analytics, already scoped to their department
        const res = await api.get('/analytics/dashboard');
        const summary = res.data.summary as {
          totalFiles: number;
          pendingFiles: number;
          completedFiles: number;
          redListedFiles: number;
          avgProcessingTimeHours: number | null;
          completionRate?: number;
        };
        setAnalytics({
          id: departmentId,
          totalFiles: summary.totalFiles ?? 0,
          pendingFiles: summary.pendingFiles ?? 0,
          completedFiles: summary.completedFiles ?? 0,
          redListedFiles: summary.redListedFiles ?? 0,
          avgProcessingTimeHours: summary.avgProcessingTimeHours ?? null,
          efficiency: summary.completionRate ?? 0,
        });
      }
    } catch {
      setAnalytics(null);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && departmentId) {
      api.get('/workflows').then((res) => setWorkflows(res.data)).catch(() => {});
    }
  }, [isSuperAdmin, departmentId]);

  useEffect(() => {
    if (departmentId) {
      fetchAnalytics();
    }
  }, [departmentId, isSuperAdmin]);

  const setDefaultWorkflow = async (workflowId: string | null) => {
    if (!department) return;
    setSavingWorkflow(true);
    try {
      await api.put(`/departments/${department.id}`, {
        name: department.name,
        code: department.code,
        defaultWorkflowId: workflowId || null,
      });
      toast.success(workflowId ? 'Default workflow updated' : 'Default workflow cleared');
      fetchDepartment();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update default workflow');
    } finally {
      setSavingWorkflow(false);
    }
  };

  const formatRole = (r: string) => r.replace(/_/g, ' ');

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!department) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/departments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{department.name}</h1>
          <p className="text-muted-foreground">
            {department.code}
            {department.organisation && ` · ${department.organisation.name}`}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Users</p>
                <p className="text-2xl font-bold">{department._count?.users ?? department.users?.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FolderTree className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Divisions</p>
                <p className="text-2xl font-bold">{department.divisions?.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Files</p>
                <p className="text-2xl font-bold">{department._count?.files ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Performance analytics
              </CardTitle>
              <CardDescription>
                Speed, efficiency, and workload indicators for this department.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Range</span>
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={analyticsPeriod}
                onChange={(e) =>
                  setAnalyticsPeriod(e.target.value as typeof analyticsPeriod)
                }
              >
                <option value="1d">1 day</option>
                <option value="7d">1 week</option>
                <option value="30d">1 month</option>
                <option value="90d">3 months</option>
                <option value="180d">6 months</option>
                <option value="365d">1 year</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {analytics ? (
            (() => {
              const volume = analytics.pendingFiles;
              const speed =
                analytics.avgProcessingTimeHours && analytics.avgProcessingTimeHours > 0
                  ? Math.max(
                      0,
                      Math.min(10, (8 / analytics.avgProcessingTimeHours) * 5),
                    )
                  : 0;
              const efficiency = Math.max(
                0,
                Math.min(10, (analytics.efficiency / 100) * 10),
              );
              const workloadBase = Math.max(
                0,
                Math.min(10, (volume / Math.max(analytics.totalFiles || 1, 1)) * 10),
              );
              const workload = workloadBase;
              const overload = workload > 5 ? workload - 5 : 0;
              const underload = workload < 5 ? 5 - workload : 0;
              const cards = [
                {
                  key: 'speed',
                  label: 'Speed',
                  value: speed,
                  note:
                    analytics.avgProcessingTimeHours != null
                      ? `Avg processing: ${analytics.avgProcessingTimeHours}h`
                      : 'Avg processing: N/A',
                },
                {
                  key: 'efficiency',
                  label: 'Efficiency',
                  value: efficiency,
                  note: `Completion rate: ${analytics.efficiency}%`,
                },
                {
                  key: 'workload',
                  label: 'Workload',
                  value: workload,
                  note: `Pending files: ${analytics.pendingFiles}`,
                },
                {
                  key: 'overload',
                  label: 'Overload',
                  value: overload,
                  note:
                    overload > 0
                      ? 'High backlog against total volume'
                      : 'Within nominal load range',
                },
                {
                  key: 'underload',
                  label: 'Underload',
                  value: underload,
                  note:
                    underload > 0
                      ? 'Below nominal backlog, potential underutilisation'
                      : 'Adequate utilisation',
                },
              ];
              const toStars = (val: number) => {
                const clamped = Math.max(0, Math.min(10, val));
                return Math.round((clamped / 10) * 5);
              };
              return (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {cards.map((card) => {
                    const stars = toStars(card.value);
                    return (
                      <div
                        key={card.key}
                        className="rounded-lg border bg-card p-4 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {card.label}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {card.value.toFixed(1)}/10
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className={
                                i < stars
                                  ? 'text-amber-400 text-sm'
                                  : 'text-muted-foreground/30 text-sm'
                              }
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {card.note}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <p className="text-sm text-muted-foreground">
              No analytics available for this department.
            </p>
          )}
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Default workflow
            </CardTitle>
            <CardDescription>
              Assign an active workflow to this department. New files will follow this workflow for approve/forward routing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={department.defaultWorkflow?.id ?? 'none'}
              onValueChange={(v) => setDefaultWorkflow(v === 'none' ? null : v)}
              disabled={savingWorkflow}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="No default workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No default workflow</SelectItem>
                {workflows
                  .filter((w) => w.isActive && (w.departmentId == null || w.departmentId === department.id))
                  .map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {department.defaultWorkflow && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-muted-foreground">
                  Current: {department.defaultWorkflow.name}
                </p>
                {!department.defaultWorkflow.isActive && (
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    This workflow is inactive. Files will get &quot;workflow not configured&quot; until you activate it in Admin → Workflows or choose another default.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Divisions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Divisions
            </CardTitle>
            <CardDescription>Divisions in this department</CardDescription>
          </CardHeader>
          <CardContent>
            {department.divisions?.length ? (
              <ul className="space-y-2">
                {department.divisions.map((div) => (
                  <li key={div.id}>
                    <Link
                      href={`/admin/departments/${departmentId}/divisions/${div.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{div.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {div._count?.users ?? 0} user(s)
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No divisions</p>
            )}
          </CardContent>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Users
            </CardTitle>
            <CardDescription>Users in this department</CardDescription>
          </CardHeader>
          <CardContent>
            {department.users?.length ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {department.users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.username}</TableCell>
                        <TableCell>{u.division?.name ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(getRoles(u) || u.roles || []).slice(0, 2).map((r) => (
                              <Badge key={r} variant="secondary" className="text-xs">
                                {formatRole(r)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/users/${u.id}`}>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No users</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
