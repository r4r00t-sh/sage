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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { hasRole } from '@/lib/auth-utils';
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
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');
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
          { id: 2, label: 'Remarks', completed: true },
        ]
      : forwardType === 'internal' || isRestrictedRole
      ? [
          { id: 1, label: 'Division', completed: !!divisionId },
          { id: 2, label: 'Remarks', completed: true },
        ]
      : [
          { id: 1, label: 'Department', completed: !!selectedDepartmentId },
          { id: 2, label: 'Division', completed: !!divisionId },
          { id: 3, label: 'Recipient', completed: !!userId },
          { id: 4, label: 'Remarks', completed: true },
        ];

  useEffect(() => {
    if (!open) return;
    setDivisionId('');
    setUserId('');
    setRemarks('');
    setUsers([]);
    setForwardType('internal'); // Reset to internal by default
    
    // For dispatchers, always show department selection (external only, excluding their own department)
    if (isDispatcher) {
      setSelectedDepartmentId('');
      setDivisions([]);
      fetchDepartments();
    } else if (forwardType === 'internal' || isRestrictedRole) {
      setSelectedDepartmentId('');
      if (user?.departmentId) {
        fetchDivisions(user.departmentId);
      } else {
        setDivisions([]);
      }
    } else {
      setSelectedDepartmentId('');
      setDivisions([]);
      fetchDepartments();
    }
  }, [open, isDispatcher, user?.departmentId]);

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
    if (isDispatcher || (forwardType === 'internal' || isRestrictedRole)) {
      setUsers([]);
      setUserId('');
      setReceiverCapacity(null);
    } else if (forwardType === 'external' && divisionId && effectiveDepartmentId) {
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
      // For dispatchers, filter out their own department
      const filtered = isDispatcher && user?.departmentId
        ? data.filter((d: Department) => d.id !== user.departmentId)
        : data;
      setDepartments(filtered);
      setCachedDepartments(data); // Cache all departments, but display filtered
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoadingDepartments(false);
    }
  };

  const fetchDivisions = async (deptId: string) => {
    const cached = getCachedDivisions(deptId);
    if (cached && Array.isArray(cached)) {
      setDivisions(cached as Division[]);
      setDivisionId('');
      setUserId('');
      setUsers([]);
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
    } catch {
      toast.error('Failed to load divisions');
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
      setUsers(response.data ?? []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async () => {
    // For dispatchers, only department is required
    if (isDispatcher) {
      if (!selectedDepartmentId) {
        toast.error('Please select a department to forward the file');
        return;
      }
    } else {
      if (!divisionId) {
        toast.error('Please select a division');
        return;
      }
      // For external forwarding, userId is required; for internal, it's optional (auto-assigns to inward desk)
      if (forwardType === 'external' && !userId) {
        toast.error('Please select a recipient');
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
      } = {
        remarks,
      };

      if (isDispatcher) {
        // Dispatcher forwarding: only send department ID
        payload.toDepartmentId = selectedDepartmentId;
        payload.toUserId = null; // Will be auto-assigned to department's inward desk
      } else {
        // Other roles: send division ID and user ID
        payload.toDivisionId = divisionId;
        payload.toUserId = forwardType === 'internal' || isRestrictedRole ? null : userId;
      }

      await api.post(`/files/${fileId}/forward`, payload);

      const recipientText = isDispatcher
        ? `${selectedDepartment?.name} (inward desk)`
        : forwardType === 'internal' || isRestrictedRole
        ? `${selectedDivision?.name} (inward desk)`
        : `${selectedUser?.name} in ${selectedDivision?.name}`;

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

  // Dispatchers only show department selection (file goes to department's inward desk)
  const canShowDivision = 
    isDispatcher
      ? false // Dispatchers don't select division
      : forwardType === 'internal' || isRestrictedRole
      ? !!user?.departmentId
      : !!selectedDepartmentId;
  // For dispatchers, internal forwarding, or restricted roles, don't show user selection (will auto-assign to inward desk)
  const canShowUser = !isDispatcher && forwardType === 'external' && !!divisionId;
  // Show department selection for dispatchers or external forwarding
  const canShowDepartment = isDispatcher || (forwardType === 'external' && !isRestrictedRole);

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

        <div className="p-6 space-y-5">
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

          {/* Department Selection - For Dispatchers (external only) or External Forwarding */}
          {canShowDepartment && (
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
                value={selectedDepartmentId}
                onValueChange={(value) => {
                  setSelectedDepartmentId(value);
                  setDivisionId('');
                  setUserId('');
                }}
                disabled={loading || loadingDepartments}
              >
                <SelectTrigger className="h-11">
                  {loadingDepartments ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading departments...
                    </div>
                  ) : (
                    <SelectValue placeholder={isDispatcher ? "Choose a department to forward to" : "Choose a department to forward to"} />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {departments.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No departments available
                    </div>
                  ) : (
                    departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-blue-600 text-xs font-medium">
                            {dept.code || dept.name.charAt(0)}
                          </div>
                          {dept.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {isDispatcher && selectedDepartmentId && (
                <p className="text-xs text-muted-foreground">
                  File will be automatically assigned to the inward desk of the selected department.
                </p>
              )}
            </div>
          )}

          {canShowDivision && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {forwardType === 'internal' || isRestrictedRole
                  ? 'Select Division (within your department) - File will go to division\'s inward desk'
                  : 'Select Division'}
                <Badge variant="secondary" className="ml-auto text-xs">
                  Required
                </Badge>
              </Label>
              <Select
                value={divisionId}
                onValueChange={(value) => {
                  setDivisionId(value);
                  setUserId('');
                }}
                disabled={loading || loadingDivisions}
              >
                <SelectTrigger className="h-11">
                  {loadingDivisions ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading divisions...
                    </div>
                  ) : (
                    <SelectValue placeholder="Choose a division to forward to" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {divisions.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No divisions available
                    </div>
                  ) : (
                    divisions.map((division) => (
                      <SelectItem key={division.id} value={division.id}>
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-blue-600 text-xs font-medium">
                            {division.code || division.name.charAt(0)}
                          </div>
                          {division.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {canShowUser && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-muted-foreground" />
                Select Recipient
                <Badge variant="secondary" className="ml-auto text-xs">
                  Required
                </Badge>
              </Label>
              <Select
                value={userId}
                onValueChange={setUserId}
                disabled={loading || loadingUsers}
              >
                <SelectTrigger className={cn('h-11', !divisionId && 'opacity-60')}>
                  {loadingUsers ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading users...
                    </div>
                  ) : (
                    <SelectValue placeholder="Choose who will receive this file" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {users.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No users in this division
                    </div>
                  ) : (
                    users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-medium">
                            {getInitials(u.name)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">{u.name}</span>
                            <span className="text-xs text-muted-foreground">
                              @{u.username}
                            </span>
                          </div>
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

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Remarks
              <Badge variant="outline" className="ml-auto text-xs">
                Optional
              </Badge>
            </Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add instructions, context, or notes for the recipient..."
              rows={3}
              disabled={loading}
              className="resize-none"
            />
          </div>

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
              // For dispatchers, only department is required
              (isDispatcher && !selectedDepartmentId) ||
              // For others, division is required
              (!isDispatcher && !divisionId) ||
              // For external forwarding (non-dispatcher), userId is required
              // For internal forwarding or restricted roles, userId is optional (auto-assigned to inward desk)
              (!isDispatcher && canForwardExternally && forwardType === 'external' && !userId) ||
              (isInwardDesk && !user?.departmentId)
            }
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 min-w-[120px]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
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
