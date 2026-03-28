'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AiTextarea } from '@/components/ai-textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { hasRole, hasGodRole } from '@/lib/auth-utils';
import {
  getCachedDepartments,
  setCachedDepartments,
  getCachedDivisions,
  setCachedDivisions,
} from '@/lib/departments-cache';
import {
  Loader2,
  Send,
  Building2,
  User,
  ArrowRight,
  FileText,
  CheckCircle2,
  MessageSquare,
  Users,
  ArrowRightLeft,
  Home,
  ListTodo,
  Plus,
  Trash2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Department {
  id: string;
  name: string;
  code?: string;
}

interface Division {
  id: string;
  name: string;
  code?: string;
}

interface UserOption {
  id: string;
  name: string;
  username: string;
  role?: string;
}

interface ForwardFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileNumber: string;
  departmentId: string;
  onSuccess?: () => void;
}

export function ForwardFileModal({
  open,
  onOpenChange,
  fileId,
  fileNumber,
  onSuccess,
}: ForwardFileModalProps) {
  const { user } = useAuthStore();
  const isInwardDesk = hasRole(user, 'INWARD_DESK');
  const isDispatcher = hasRole(user, 'DISPATCHER');
  const isSectionOfficer = hasRole(user, 'SECTION_OFFICER');
  const isDeptAdmin = hasRole(user, 'DEPT_ADMIN');
  const isSuperAdmin = hasGodRole(user);
  // Dispatchers can only forward to other departments (external only)
  // Other restricted roles (INWARD_DESK, SECTION_OFFICER) can only forward internally (within their department)
  const isRestrictedRole = (isInwardDesk || isSectionOfficer) && !isDeptAdmin;
  // Admins can forward both internally and externally
  const canForwardExternally = isDeptAdmin || isSuperAdmin;

  const [forwardType, setForwardType] = useState<'internal' | 'external'>('internal');
  const [loading, setLoading] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingDivisions, setLoadingDivisions] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [userId, setUserId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [receiverCapacity, setReceiverCapacity] = useState<{
    currentFileCount: number;
    maxFilesPerDay: number;
    utilizationPercent: number;
  } | null>(null);
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  // Multi-department forward: each entry has department + task (task shown as note only to that dept)
  const [forwardMode, setForwardMode] = useState<'single' | 'multiple'>('single');
  const [multiRecipients, setMultiRecipients] = useState<Array<{ departmentId: string; departmentName: string; task: string }>>([]);

  // For internal forwarding, use user's department; for external, use selected department
  const effectiveDepartmentId = 
    forwardType === 'internal' || isRestrictedRole
      ? (user?.departmentId ?? '')
      : selectedDepartmentId;
  const selectedDepartment = departments.find((d) => d.id === effectiveDepartmentId);
  const selectedDivision = divisions.find((d) => d.id === divisionId);
  const selectedUser = users.find((u) => u.id === userId);

  // Steps vary based on forward type and role
  const steps = 
    isDispatcher
      ? [
          { id: 1, label: 'Department', completed: !!selectedDepartmentId },
          { id: 2, label: 'Note', completed: true },
        ]
      : forwardType === 'internal' || isRestrictedRole
      ? [
          { id: 1, label: 'Division', completed: !!divisionId },
          { id: 2, label: 'Note', completed: true },
        ]
      : [
          { id: 1, label: 'Department', completed: !!selectedDepartmentId },
          { id: 2, label: 'Division', completed: !!divisionId },
          { id: 3, label: 'Recipient', completed: !!userId },
          { id: 4, label: 'Note', completed: true },
        ];

  // When modal opens: reset, load divisions/departments, then pre-fill from file intended if any
  useEffect(() => {
    if (!open) return;
    setRemarks('');
    setForwardType('internal');
    setForwardMode('single');
    setMultiRecipients([]);
    setSelectedDepartmentId('');
    setDivisionId('');
    setUserId('');
    setUsers([]);

    if (isDispatcher) {
      setDivisions([]);
      fetchDepartments();
    } else if (user?.departmentId) {
      fetchDivisions(user.departmentId);
    } else {
      setDivisions([]);
    }
  }, [open, isDispatcher, user?.departmentId]);

  // Pre-fill division and user from file's intended recipient (inward desk one-click forward)
  useEffect(() => {
    if (!open || !fileId) return;
    let cancelled = false;
    api.get(`/files/${fileId}`)
      .then((res) => {
        if (cancelled) return;
        const file = res.data as { intendedDivisionId?: string; intendedUserId?: string; intendedDivision?: { id: string }; intendedUser?: { id: string }; departmentId?: string };
        const intendedDivId = file.intendedDivision?.id ?? file.intendedDivisionId ?? '';
        const intendedUId = file.intendedUser?.id ?? file.intendedUserId ?? '';
        if (intendedDivId) setDivisionId(intendedDivId);
        if (intendedUId) setUserId(intendedUId);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, fileId]);

  // Fetch departments when switching to external forwarding
  useEffect(() => {
    if (!open) return;
    if (forwardType === 'external' && !isDispatcher && !isRestrictedRole) {
      // When switching to external, fetch departments if not already loaded or loading
      if (departments.length === 0 && !loadingDepartments) {
        fetchDepartments();
      }
    }
  }, [forwardType, open, isDispatcher, isRestrictedRole, departments.length, loadingDepartments]);

  useEffect(() => {
    // Dispatchers don't need divisions (file goes to department's inward desk)
    if (isDispatcher) {
      setDivisions([]);
      setDivisionId('');
    } else if (forwardType === 'internal' || isRestrictedRole) {
      // For internal, fetch divisions from user's department
      if (user?.departmentId) {
        fetchDivisions(user.departmentId);
      }
    } else if (forwardType === 'external' && selectedDepartmentId) {
      // For external, fetch divisions from selected department
      fetchDivisions(selectedDepartmentId);
    } else {
      setDivisions([]);
    }
  }, [selectedDepartmentId, forwardType, isRestrictedRole, isDispatcher, user?.departmentId]);

  useEffect(() => {
    if (isDispatcher) {
      setUsers([]);
      setUserId('');
      setReceiverCapacity(null);
    } else if (divisionId && effectiveDepartmentId) {
      fetchUsers(effectiveDepartmentId, divisionId);
    } else {
      setUsers([]);
      setUserId('');
      setReceiverCapacity(null);
    }
  }, [divisionId, effectiveDepartmentId, forwardType, isRestrictedRole, isDispatcher]);

  useEffect(() => {
    if (userId) {
      fetchReceiverCapacity(userId);
    } else {
      setReceiverCapacity(null);
    }
  }, [userId]);

  const fetchReceiverCapacity = async (targetUserId: string) => {
    setLoadingCapacity(true);
    setReceiverCapacity(null);
    try {
      const res = await api.get(`/capacity/user/${targetUserId}`);
      setReceiverCapacity({
        currentFileCount: res.data.currentFileCount ?? 0,
        maxFilesPerDay: res.data.maxFilesPerDay ?? 10,
        utilizationPercent: res.data.utilizationPercent ?? 0,
      });
    } catch {
      setReceiverCapacity(null);
    } finally {
      setLoadingCapacity(false);
    }
  };

  const fetchDepartments = async () => {
    const cached = getCachedDepartments();
    if (cached && Array.isArray(cached) && cached.length > 0) {
      // For dispatchers, filter out their own department
      const filtered = isDispatcher && user?.departmentId
        ? (cached as Department[]).filter((d) => d.id !== user.departmentId)
        : (cached as Department[]);
      setDepartments(filtered);
      return;
    }
    setLoadingDepartments(true);
    try {
      const response = await api.get('/departments');
      const data = Array.isArray(response.data) ? response.data : [];
      // For dispatchers, show all departments (including their own);
      // behaviour is controlled on the backend.
      const filtered = data as Department[];
      setDepartments(filtered);
      setCachedDepartments(data); // Cache all departments
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoadingDepartments(false);
    }
  };

  const fetchDivisions = async (deptId: string) => {
    if (!deptId) {
      setDivisions([]);
      setDivisionId('');
      setUserId('');
      setUsers([]);
      setLoadingDivisions(false);
      return;
    }
    
    const cached = getCachedDivisions(deptId);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setDivisions(cached as Division[]);
      setDivisionId('');
      setUserId('');
      setUsers([]);
      setLoadingDivisions(false);
      return;
    }
    
    setLoadingDivisions(true);
    setDivisionId('');
    setUserId('');
    setUsers([]);
    try {
      const response = await api.get(`/departments/${deptId}/divisions`);
      const data = response.data ?? [];
      setDivisions(data);
      setCachedDivisions(deptId, data);
    } catch (error: any) {
      toast.error('Failed to load divisions', {
        description: error.response?.data?.message || 'An error occurred',
      });
      setDivisions([]);
    } finally {
      setLoadingDivisions(false);
    }
  };

  const fetchUsers = async (deptId: string, divId: string) => {
    setLoadingUsers(true);
    setUserId('');
    try {
      const response = await api.get(
        `/departments/${deptId}/divisions/${divId}/users`,
      );
      let data: UserOption[] = response.data ?? [];

      // Inward Desk: can only forward to internal Section Officer or Dept Admin
      if (isInwardDesk) {
        data = data.filter(
          (u) => u.role === 'SECTION_OFFICER' || u.role === 'DEPT_ADMIN',
        );
      }

      setUsers(data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async () => {
    if (forwardType === 'external' && canForwardExternally && forwardMode === 'multiple') {
      if (multiRecipients.length === 0) {
        toast.error('Add at least one department to forward to');
        return;
      }
    } else if (isDispatcher) {
      if (!selectedDepartmentId) {
        toast.error('Please select a department to forward the file');
        return;
      }
    } else if (forwardType === 'external' && canForwardExternally) {
      if (!selectedDepartmentId) {
        toast.error('Please select a department to forward the file');
        return;
      }
    } else {
      // Inside department: division mandatory
      if (!divisionId) {
        toast.error('Please select a division to forward the file');
        return;
      }
      if ((forwardType === 'internal' || isRestrictedRole) && !user?.departmentId) {
        toast.error('You must be assigned to a department to forward files');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: {
        toDivisionId?: string;
        toDepartmentId?: string;
        toUserId?: string | null;
        remarks?: string;
        recipients?: Array<{ toDepartmentId?: string; toDivisionId?: string; toUserId?: string | null; remarks?: string }>;
      } = { remarks };

      if (forwardType === 'external' && canForwardExternally && forwardMode === 'multiple' && multiRecipients.length > 0) {
        payload.recipients = multiRecipients.map((r) => ({
          toDepartmentId: r.departmentId,
          remarks: r.task.trim() || undefined,
        }));
      } else if (isDispatcher) {
        payload.toDepartmentId = selectedDepartmentId;
        payload.toUserId = null;
      } else if (forwardType === 'external' && canForwardExternally) {
        payload.toDepartmentId = selectedDepartmentId;
        payload.toDivisionId = divisionId || undefined;
        payload.toUserId = userId || null;
      } else {
        payload.toDivisionId = divisionId;
        payload.toUserId = userId || null;
      }

      await api.post(`/files/${fileId}/forward`, payload);

      const dispatcherDeptName =
        selectedDepartmentId && departments.find((d) => d.id === selectedDepartmentId)?.name;
      const recipientText =
        forwardMode === 'multiple' && multiRecipients.length > 0
          ? `${multiRecipients.length} department(s): ${multiRecipients.map((r) => r.departmentName).join(', ')}`
          : isDispatcher
          ? dispatcherDeptName
            ? `${dispatcherDeptName} (inward desk)`
            : 'selected department (inward desk)'
          : forwardType === 'internal' || isRestrictedRole
          ? selectedUser
            ? `to ${selectedUser.name} (via ${selectedDivision?.name} inward desk)`
            : `${selectedDivision?.name} (inward desk)`
          : selectedUser
          ? `${selectedDivision?.name} → ${selectedUser.name}`
          : selectedDivision
          ? `${selectedDepartment?.name} → ${selectedDivision.name} (inward desk)`
          : `${selectedDepartment?.name} (inward desk)`;

      toast.success('File forwarded successfully', {
        description: `Sent to ${recipientText}`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to forward file', {
        description: err.response?.data?.message || 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const canShowDivision =
    isDispatcher
      ? false
      : forwardType === 'internal' || isRestrictedRole
      ? !!user?.departmentId
      : !!selectedDepartmentId;
  // Show user (optional) for both internal and external when division is selected
  const canShowUser = !isDispatcher && !!divisionId;
  const canShowDepartment = isDispatcher || (forwardType === 'external' && !isRestrictedRole);
  const divisionRequired = forwardType === 'internal' || isRestrictedRole;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg">
                  Forward File
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <FileText className="h-3.5 w-3.5 opacity-80" />
                  <span className="text-sm font-mono opacity-90">
                    {fileNumber}
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex items-center justify-between mt-6">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-all',
                      step.completed
                        ? 'bg-white text-blue-600'
                        : 'bg-white/20 text-white',
                    )}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </div>
                  <span className="text-xs mt-1.5 opacity-80">{step.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-8 mx-1 rounded-full transition-all',
                      step.completed ? 'bg-white' : 'bg-white/30',
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[min(70vh,560px)] overflow-y-auto">
          {(isRestrictedRole || isDispatcher) && !user?.departmentId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
              You must be assigned to a department to forward files. Contact your administrator.
            </div>
          )}

          {/* Forward Type Selection for Admins */}
          {canForwardExternally && (
            <Tabs value={forwardType} onValueChange={(v) => setForwardType(v as 'internal' | 'external')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="internal" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Inside Department
                </TabsTrigger>
                <TabsTrigger value="external" className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Outside Department
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* External: Single vs Multiple departments (with task per department) */}
          {canForwardExternally && forwardType === 'external' && (
            <Tabs value={forwardMode} onValueChange={(v) => setForwardMode(v as 'single' | 'multiple')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  One department
                </TabsTrigger>
                <TabsTrigger value="multiple" className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Multiple departments (tasks)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Multiple departments: add departments + task per department (each task visible only to that dept; host sees all) */}
          {canForwardExternally && forwardType === 'external' && forwardMode === 'multiple' && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <ListTodo className="h-4 w-4" />
                Departments and tasks
              </Label>
              <p className="text-xs text-muted-foreground">
                Add departments to forward to. Each task is shown as a note only to that department. Host department sees all.
              </p>
              {multiRecipients.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Add at least one department below.</p>
              )}
              <div className="max-h-[min(40vh,320px)] overflow-y-auto space-y-3 pr-1">
                {multiRecipients.map((r, idx) => (
                  <div key={r.departmentId} className="flex flex-col gap-2 rounded border bg-background p-3 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {r.departmentName}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setMultiRecipients((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <AiTextarea
                      placeholder={`Task for ${r.departmentName} (@Ai + Ctrl+Enter)`}
                      value={r.task}
                      onChange={(e) =>
                        setMultiRecipients((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, task: e.target.value } : x))
                        )
                      }
                      className="min-h-[72px] resize-none"
                      disabled={loading}
                      fileId={fileId}
                      fieldHint={`Forward task note for ${r.departmentName}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (!value) return;
                    const dept = departments.find((d) => d.id === value);
                    if (!dept || multiRecipients.some((r) => r.departmentId === value)) return;
                    setMultiRecipients((prev) => [...prev, { departmentId: dept.id, departmentName: dept.name, task: '' }]);
                  }}
                  disabled={loading || loadingDepartments}
                >
                  <SelectTrigger className="w-[220px] h-9">
                    <SelectValue placeholder="Add department..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departments
                      .filter(
                        (d) =>
                          !multiRecipients.some((r) => r.departmentId === d.id) &&
                          d.id !== user?.departmentId,
                      )
                      .map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    {departments.filter((d) => !multiRecipients.some((r) => r.departmentId === d.id) && d.id !== user?.departmentId).length === 0 && (
                      <div className="p-2 text-xs text-muted-foreground">All departments added</div>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    if (departments.length === 0 && !loadingDepartments) fetchDepartments();
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add department
                </Button>
              </div>
            </div>
          )}

          {/* Department Selection - For Dispatchers or External Single (hidden when External + Multiple) */}
          {canShowDepartment && (forwardType !== 'external' || forwardMode === 'single') && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {isDispatcher 
                  ? 'Select Department (file will go to department\'s inward desk)'
                  : 'Select Department'}
                <Badge variant="secondary" className="ml-auto text-xs">
                  Required
                </Badge>
              </Label>
              <Select
                key={`dept-select-${departments.length}`}
                value={selectedDepartmentId || undefined}
                onValueChange={(value) => {
                  if (value === '__none__') {
                    setSelectedDepartmentId('');
                    setDivisionId('');
                    setUserId('');
                    return;
                  }
                  setSelectedDepartmentId(value || '');
                  setDivisionId('');
                  setUserId('');
                }}
                disabled={loading || loadingDepartments}
              >
                <SelectTrigger className="h-11 w-full">
                  {loadingDepartments ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading departments...
                    </div>
                  ) : (
                    <SelectValue placeholder={isDispatcher ? "Choose a department to forward to" : "Choose a department to forward to"} />
                  )}
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60 min-w-[var(--radix-select-trigger-width)]" position="popper" sideOffset={4}>
                  <SelectItem value="__none__" className="py-2.5 text-muted-foreground">
                    Clear selection
                  </SelectItem>
                  {departments.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No departments available
                    </div>
                  ) : (
                    departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id} className="py-2.5">
                        <span className="truncate">{dept.name}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {isDispatcher && selectedDepartmentId && (
                <p className="text-xs text-muted-foreground">
                  File will be assigned to the inward desk of the selected department.
                </p>
              )}
              {!isDispatcher && forwardType === 'external' && canForwardExternally && (
                <p className="text-xs text-muted-foreground">
                  Division and user are optional; file will enter the department inward desk. Inward can then forward to division/user in one click.
                </p>
              )}
            </div>
          )}

          {canShowDivision && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="min-w-0 truncate">
                  {forwardType === 'internal' || isRestrictedRole
                    ? 'Select Division (file will go to division inward desk)'
                    : 'Select Division'}
                </span>
                <Badge variant={divisionRequired ? 'secondary' : 'outline'} className="ml-auto text-xs shrink-0">
                  {divisionRequired ? 'Required' : 'Optional'}
                </Badge>
              </Label>
              <Select
                value={divisionId}
                onValueChange={(value) => {
                  if (value === '__none__') {
                    setDivisionId('');
                    setUserId('');
                    return;
                  }
                  setDivisionId(value);
                  setUserId('');
                }}
                disabled={loading || loadingDivisions || (forwardType === 'external' && !selectedDepartmentId)}
              >
                <SelectTrigger className="h-11 w-full min-w-0">
                  {loadingDivisions ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>Loading divisions...</span>
                    </div>
                  ) : selectedDivision ? (
                    <div className="flex items-center gap-2 min-w-0 w-full">
                      <span className="shrink-0 w-7 text-center rounded bg-blue-100 text-blue-600 text-xs font-medium py-0.5">
                        {selectedDivision.code || selectedDivision.name.charAt(0)}
                      </span>
                      <span className="truncate min-w-0">{selectedDivision.name}</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Choose a division to forward to" />
                  )}
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60 min-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)]" position="popper" sideOffset={4}>
                  <SelectItem value="__none__" className="py-2.5 text-muted-foreground">
                    Clear selection
                  </SelectItem>
                  {divisions.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No divisions available
                    </div>
                  ) : (
                    divisions.map((division) => (
                      <SelectItem key={division.id} value={division.id} className="py-2.5 focus:bg-muted">
                        <span className="truncate min-w-0 flex-1">{division.name}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {divisionRequired && (
                <p className="text-xs text-muted-foreground">
                  User is optional; file will go to division inward desk. If user is selected, inward will see it and can forward in one click.
                </p>
              )}
            </div>
          )}

          {canShowUser && (
            <div className="space-y-2 relative z-10">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                Select Recipient
                <Badge variant="outline" className="ml-auto text-xs shrink-0">
                  Optional
                </Badge>
              </Label>
              <Select
                value={userId}
                onValueChange={(value) => setUserId(value === '__none__' ? '' : value)}
                disabled={loading || loadingUsers}
              >
                <SelectTrigger className={cn('h-11 w-full', !divisionId && 'opacity-60')}>
                  {loadingUsers ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading users...
                    </div>
                  ) : (
                    <SelectValue placeholder="Choose who will receive this file" />
                  )}
                </SelectTrigger>
                <SelectContent className="z-[100] max-h-60" position="popper" sideOffset={4}>
                  <SelectItem value="__none__" className="text-muted-foreground">
                    Clear selection
                  </SelectItem>
                  {users.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No users in this division
                    </div>
                  ) : (
                    users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{u.name}</span>
                          <span className="text-xs text-muted-foreground">
                            @{u.username}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {canShowUser && userId && (loadingCapacity || receiverCapacity) && (
            <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">
                Receiver desk capacity
              </p>
              {loadingCapacity ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : receiverCapacity ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums">
                      {receiverCapacity.currentFileCount}/{receiverCapacity.maxFilesPerDay}
                    </span>
                    <span className="text-sm text-muted-foreground">files</span>
                  </div>
                  {receiverCapacity.utilizationPercent >= 100 && (
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      File will be queued — desk is at or over capacity. It will enter the receiver&apos;s inbox when space is free.
                    </p>
                  )}
                  {receiverCapacity.utilizationPercent >= 90 && receiverCapacity.utilizationPercent < 100 && (
                    <p className="text-sm text-amber-600/90 dark:text-amber-400/90">
                      Desk is near capacity — processing may be delayed.
                    </p>
                  )}
                  {receiverCapacity.utilizationPercent < 90 && (
                    <p className="text-xs text-muted-foreground">
                      Desk has capacity; file will go to receiver&apos;s inbox.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* Global note (single recipient flows). External multi uses per-department task notes instead. */}
          {!(canForwardExternally && forwardType === 'external' && forwardMode === 'multiple') && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Note
                <Badge variant="outline" className="ml-auto text-xs">
                  Optional
                </Badge>
              </Label>
              <AiTextarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Note for recipient… (@Ai + Ctrl+Enter)"
                rows={3}
                disabled={loading}
                className="resize-none"
                fileId={fileId}
                fieldHint="Forward remarks / instruction for recipient"
              />
            </div>
          )}

          {selectedDivision && selectedUser && (
            <>
              <Separator />
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  FORWARDING SUMMARY
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-medium">
                    {getInitials(selectedUser.name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{selectedUser.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedDepartment?.name && !isInwardDesk
                        ? `${selectedDepartment.name} · ${selectedDivision.name}`
                        : selectedDivision.name}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t bg-muted/30 p-4 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              (isDispatcher && !selectedDepartmentId) ||
              (forwardType === 'external' && canForwardExternally && forwardMode === 'multiple' && multiRecipients.length === 0) ||
              (!isDispatcher &&
                forwardMode === 'single' &&
                (forwardType === 'external' && canForwardExternally ? !selectedDepartmentId : !divisionId)) ||
              (isInwardDesk && !user?.departmentId)
            }
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 min-w-[120px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending… This may take a moment
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Forward File
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
