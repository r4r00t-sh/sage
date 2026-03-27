'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Settings2,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  History,
  User,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { hasRole } from '@/lib/auth-utils';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Department {
  id: string;
  name: string;
  code?: string;
}

interface SystemSetting {
  key: string;
  value: string;
  departmentId?: string | null;
  description?: string | null;
  updatedAt?: string;
  department?: { id: string; name: string; code: string } | null;
  updatedBy?: { id: string; name: string; username: string } | null;
}

interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  user?: { id: string; name: string; username: string } | null;
  metadata?: { key?: string; departmentId?: string | null; value?: string; previousValue?: string } | null;
}

export default function FeaturesPage() {
  const { user } = useAuthStore();
  const isTechPanel = hasRole(user, 'DEVELOPER');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const [enableDefaultDueTime, setEnableDefaultDueTime] = useState(true);
  const [defaultDueHours, setDefaultDueHours] = useState('48');
  const [applyScope, setApplyScope] = useState<'all' | 'selected'>('all');
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);

  const myDepartmentId = (user as { departmentId?: string })?.departmentId ?? null;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [settingsRes, activityRes] = await Promise.all([
          api.get<SystemSetting[]>('/admin/settings'),
          api.get<ActivityEntry[]>('/admin/settings/activity').catch(() => ({ data: [] })),
        ]);
        const rawSettings = Array.isArray(settingsRes.data) ? settingsRes.data : [];
        setSettings(rawSettings);
        setActivity(Array.isArray(activityRes.data) ? activityRes.data : []);

        if (isTechPanel) {
          const deptRes = await api.get<Department[]>('/departments').catch(() => ({ data: [] }));
          setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
        }

        const slaKey = 'defaultSlaNormHours';
        const enableKey = 'ENABLE_DEFAULT_DUE_TIME';

        if (isTechPanel) {
          const globalSla = rawSettings.find((s) => s.key === slaKey && s.departmentId == null);
          const globalEnable = rawSettings.find((s) => s.key === enableKey && s.departmentId == null);
          if (globalSla?.value) setDefaultDueHours(globalSla.value);
          if (globalEnable?.value !== undefined) {
            const raw = String(globalEnable.value).toLowerCase();
            setEnableDefaultDueTime(raw === 'true' || raw === '1' || raw === 'yes');
          }
          const perDept = rawSettings.filter((s) => s.key === slaKey && s.departmentId != null);
          if (perDept.length > 0) {
            setApplyScope('selected');
            setSelectedDepartmentIds(perDept.map((s) => s.departmentId!).filter(Boolean));
          }
        } else {
          const mySla = rawSettings.find((s) => s.key === slaKey && s.departmentId === myDepartmentId);
          const globalSla = rawSettings.find((s) => s.key === slaKey && s.departmentId == null);
          const myEnable = rawSettings.find((s) => s.key === enableKey && s.departmentId === myDepartmentId);
          const globalEnable = rawSettings.find((s) => s.key === enableKey && s.departmentId == null);
          const slaRow = mySla ?? globalSla;
          const enableRow = myEnable ?? globalEnable;
          if (slaRow?.value) setDefaultDueHours(slaRow.value);
          if (enableRow?.value !== undefined) {
            const raw = String(enableRow.value).toLowerCase();
            setEnableDefaultDueTime(raw === 'true' || raw === '1' || raw === 'yes');
          }
        }
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } } };
        toast.error('Failed to load feature settings', {
          description: err.response?.data?.message || 'An error occurred',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isTechPanel, myDepartmentId]);

  const handleSave = async (options?: { skipToast?: boolean }) => {
    const hours = parseFloat(defaultDueHours);
    if (!hours || hours <= 0) {
      toast.error('Default due time must be greater than 0 hours');
      return;
    }

    setSaving(true);
    try {
      const enablePayload = {
        value: enableDefaultDueTime ? 'true' : 'false',
        ...(isTechPanel && applyScope === 'all' ? { departmentId: null } : {}),
        ...(isTechPanel && applyScope === 'selected' ? {} : {}),
        ...(!isTechPanel && myDepartmentId ? { departmentId: myDepartmentId } : {}),
      };
      if (isTechPanel && applyScope === 'all') {
        await Promise.all([
          api.put('/admin/settings/ENABLE_DEFAULT_DUE_TIME', { value: enablePayload.value, departmentId: null }),
          api.put('/admin/settings/defaultSlaNormHours', { value: String(hours), departmentId: null }),
        ]);
      } else if (isTechPanel && applyScope === 'selected' && selectedDepartmentIds.length > 0) {
        await api.put('/admin/settings/ENABLE_DEFAULT_DUE_TIME', { value: enablePayload.value, departmentId: null });
        await Promise.all(
          selectedDepartmentIds.map((deptId) =>
            api.put('/admin/settings/defaultSlaNormHours', { value: String(hours), departmentId: deptId }),
          ),
        );
      } else if (!isTechPanel && myDepartmentId) {
        await Promise.all([
          api.put('/admin/settings/ENABLE_DEFAULT_DUE_TIME', {
            value: enablePayload.value,
            departmentId: myDepartmentId,
          }),
          api.put('/admin/settings/defaultSlaNormHours', {
            value: String(hours),
            departmentId: myDepartmentId,
          }),
        ]);
      } else {
        if (isTechPanel && applyScope === 'selected' && selectedDepartmentIds.length === 0) {
          toast.error('Select at least one department');
          return;
        }
        await Promise.all([
          api.put('/admin/settings/ENABLE_DEFAULT_DUE_TIME', { value: enablePayload.value }),
          api.put('/admin/settings/defaultSlaNormHours', { value: String(hours) }),
        ]);
      }

      if (!options?.skipToast) {
        toast.success('Feature settings updated', { description: 'Default due time has been saved' });
      }
      const [settingsRes, activityRes] = await Promise.all([
        api.get<SystemSetting[]>('/admin/settings'),
        api.get<ActivityEntry[]>('/admin/settings/activity').catch(() => ({ data: [] })),
      ]);
      setSettings(Array.isArray(settingsRes.data) ? settingsRes.data : []);
      setActivity(Array.isArray(activityRes.data) ? activityRes.data : []);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to save feature settings', {
        description: err.response?.data?.message || 'An error occurred',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBackfill = async () => {
    const hours = parseFloat(defaultDueHours);
    if (!hours || hours <= 0) {
      toast.error('Default due time must be greater than 0 hours');
      return;
    }
    setBackfilling(true);
    try {
      // Save current default due time first so it applies to the backfill
      await handleSave({ skipToast: true });
      const res = await api.post<{ updated: number }>('/files/backfill-due-times');
      const count = res.data?.updated ?? 0;
      toast.success(
        count === 0
          ? 'Settings saved. No files needed updating (all files already have a due time).'
          : `Settings saved and default due time applied to ${count} existing file(s).`,
      );
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to apply due time to existing files', {
        description: err.response?.data?.message || 'An error occurred',
      });
    } finally {
      setBackfilling(false);
    }
  };

  const toggleDepartment = (id: string) => {
    setSelectedDepartmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const slaSettings = settings.filter((s) => s.key === 'defaultSlaNormHours' || s.key === 'ENABLE_DEFAULT_DUE_TIME');
  const deptIdToName: Record<string, string> = {};
  settings.forEach((s) => {
    if (s.departmentId && s.department?.name) deptIdToName[s.departmentId] = s.department.name;
  });
  departments.forEach((d) => {
    deptIdToName[d.id] = d.name;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings2 className="h-8 w-8 text-primary" />
            Features & Default Due Time
          </h1>
          <p className="text-muted-foreground mt-2">
            {isTechPanel
              ? 'Set default due time for all departments or selected ones. Department admins can set their own; you see all here.'
              : 'View-only. Global parameter updates are restricted to Tech Panel.'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Default file due time
          </CardTitle>
          <CardDescription>
            {isTechPanel
              ? 'Choose to apply to all departments or only selected ones. Department-specific values override the global default.'
              : 'This value is view-only unless you are in Tech Panel.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Automatic default due time</Label>
              <p className="text-xs text-muted-foreground max-w-md">
                When enabled, the system applies this default due time (in hours) as the SLA baseline
                wherever a more specific setting is not present.
              </p>
            </div>
            <Toggle
              pressed={enableDefaultDueTime}
              onPressedChange={isTechPanel ? setEnableDefaultDueTime : undefined}
              variant="outline"
              className="min-w-[130px] justify-between px-3"
              aria-label="Toggle automatic default due time"
            >
              <span className="text-xs font-medium uppercase tracking-wide">
                {enableDefaultDueTime ? 'ENABLED' : 'DISABLED'}
              </span>
              {enableDefaultDueTime ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </Toggle>
          </div>

          {isTechPanel && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Apply to</Label>
              <RadioGroup
                value={applyScope}
                onValueChange={isTechPanel ? (v) => setApplyScope(v as 'all' | 'selected') : undefined}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label htmlFor="scope-all" className="font-normal cursor-pointer">
                    All departments (global default)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="scope-selected" />
                  <Label htmlFor="scope-selected" className="font-normal cursor-pointer">
                    Selected departments only
                  </Label>
                </div>
              </RadioGroup>
              {applyScope === 'selected' && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {departments.map((d) => (
                    <Badge
                      key={d.id}
                      variant={selectedDepartmentIds.includes(d.id) ? 'default' : 'outline'}
                      className={cn(
                        'cursor-pointer transition-all',
                        selectedDepartmentIds.includes(d.id) && 'ring-2 ring-primary ring-offset-2'
                      )}
                      onClick={() => toggleDepartment(d.id)}
                    >
                      {d.name} {d.code && `(${d.code})`}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="default-due-hours">Default due time (hours)</Label>
            <div className="flex items-center gap-2 max-w-sm">
              <Input
                id="default-due-hours"
                type="number"
                min="1"
                step="0.5"
                value={defaultDueHours}
                onChange={(e) => setDefaultDueHours(e.target.value)}
                disabled={loading || !isTechPanel}
                placeholder="e.g., 24, 48, 72"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">hours</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Common values: 24 (1 day), 48 (2 days), 72 (3 days), 168 (1 week).
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => handleSave()}
              disabled={
                loading ||
                saving ||
                !isTechPanel ||
                (isTechPanel && applyScope === 'selected' && selectedDepartmentIds.length === 0)
              }
              className="min-w-[140px]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </Button>
            {isTechPanel && (
              <Button
                variant="outline"
                onClick={handleBackfill}
                disabled={loading || backfilling}
                className="min-w-[200px]"
              >
                {backfilling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply to existing files'
                )}
              </Button>
            )}
          </div>
          {isTechPanel && (
            <p className="text-xs text-muted-foreground pt-1">
              Use &quot;Apply to existing files&quot; to set the default due time on all files that
              currently have no timer. Each file gets the default hours from now.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Current settings
          </CardTitle>
          <CardDescription>
            {isTechPanel
              ? 'Global and per-department default due time. Department admin changes appear here.'
              : 'Your department’s setting and the global default (for reference).'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {slaSettings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No settings loaded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Updated by</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slaSettings.map((s) => (
                  <TableRow key={`${s.key}-${s.departmentId ?? 'global'}`}>
                    <TableCell className="font-mono text-xs">{s.key}</TableCell>
                    <TableCell>
                      {s.departmentId == null ? (
                        <Badge variant="secondary">Global</Badge>
                      ) : (
                        <span>{s.department?.name ?? s.departmentId}</span>
                      )}
                    </TableCell>
                    <TableCell>{s.value}</TableCell>
                    <TableCell>
                      {s.updatedBy ? (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {s.updatedBy.name} ({s.updatedBy.username})
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.updatedAt ? formatDistanceToNow(new Date(s.updatedAt), { addSuffix: true }) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Activity
          </CardTitle>
          <CardDescription>
            Recent changes to default due time and feature settings. Department admin changes are
            visible here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-2 text-sm border-b pb-2 last:border-0 last:pb-0"
                >
                  <span className="font-medium">{a.metadata?.key ?? a.entityId}</span>
                  <Badge variant="outline" className="text-xs">
                    {a.metadata?.departmentId == null
                      ? 'Global'
                      : deptIdToName[a.metadata.departmentId] ?? a.metadata.departmentId}
                  </Badge>
                  <span className="text-muted-foreground">
                    → {a.metadata?.value ?? ''}
                    {a.metadata?.previousValue != null && (
                      <span> (was {a.metadata.previousValue})</span>
                    )}
                  </span>
                  {a.user && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {a.user.name}
                    </span>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
