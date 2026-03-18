'use client';

import { useEffect, useState } from 'react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  getCachedDepartments,
  setCachedDepartments,
  getCachedDivisions,
  setCachedDivisions,
} from '@/lib/departments-cache';
import {
  Loader2,
  Send,
  FileText,
  Building2,
  Users,
  ArrowRightLeft,
  Home,
  MessageSquare,
} from 'lucide-react';
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
}

interface RequestOpinionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileNumber: string;
  departmentId: string;
  onSuccess?: () => void;
}

export function RequestOpinionModal({
  open,
  onOpenChange,
  fileId,
  fileNumber,
  departmentId,
  onSuccess,
}: RequestOpinionModalProps) {
  const { user } = useAuthStore();

  const [mode, setMode] = useState<'internal' | 'external'>('internal');
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
  const [reason, setReason] = useState('');

  const effectiveDepartmentId =
    mode === 'internal' ? departmentId : selectedDepartmentId;

  const selectedDepartment = departments.find(
    (d) => d.id === effectiveDepartmentId,
  );
  const selectedDivision = divisions.find((d) => d.id === divisionId);
  const selectedUser = users.find((u) => u.id === userId);

  useEffect(() => {
    if (!open) return;
    // reset
    setMode('internal');
    setSelectedDepartmentId('');
    setDivisionId('');
    setUserId('');
    setUsers([]);
    setReason('');

    // for internal, use current file department; load its divisions and users
    if (departmentId) {
      fetchDivisions(departmentId);
    }
  }, [open, departmentId]);

  useEffect(() => {
    if (!open) return;
    if (mode === 'external') {
      if (departments.length === 0 && !loadingDepartments) {
        fetchDepartments();
      }
      // clear divisions/users when switching to external
      setDivisions([]);
      setDivisionId('');
      setUsers([]);
      setUserId('');
    } else if (mode === 'internal') {
      // internal: always use file's department
      if (departmentId) {
        fetchDivisions(departmentId);
      }
    }
  }, [mode, open, departmentId, departments.length, loadingDepartments]);

  useEffect(() => {
    if (!open) return;
    if (mode === 'external' && selectedDepartmentId) {
      fetchDivisions(selectedDepartmentId);
    }
  }, [selectedDepartmentId, mode, open]);

  useEffect(() => {
    if (!open) return;
    if (effectiveDepartmentId && divisionId) {
      fetchUsers(effectiveDepartmentId, divisionId);
    } else {
      setUsers([]);
      setUserId('');
    }
  }, [effectiveDepartmentId, divisionId, open]);

  const fetchDepartments = async () => {
    const cached = getCachedDepartments();
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setDepartments(cached as Department[]);
      return;
    }
    setLoadingDepartments(true);
    try {
      const response = await api.get('/departments');
      const data = Array.isArray(response.data) ? response.data : [];
      setDepartments(data);
      setCachedDepartments(data);
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
      setUsers([]);
      setUserId('');
      return;
    }

    const cached = getCachedDivisions(deptId);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setDivisions(cached as Division[]);
      setDivisionId('');
      setUsers([]);
      setUserId('');
      return;
    }

    setLoadingDivisions(true);
    setDivisionId('');
    setUsers([]);
    setUserId('');
    try {
      const response = await api.get(`/departments/${deptId}/divisions`);
      const data = response.data ?? [];
      setDivisions(data);
      setCachedDivisions(deptId, data);
    } catch (error: any) {
      toast.error('Failed to load divisions', {
        description:
          error?.response?.data?.message || 'An error occurred loading divisions',
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
      setUsers(response.data ?? []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async () => {
    if (!effectiveDepartmentId) {
      toast.error(
        mode === 'internal'
          ? 'File does not have a host department'
          : 'Please select a department',
      );
      return;
    }
    if (!divisionId) {
      toast.error('Please select a division');
      return;
    }
    if (!userId) {
      toast.error('Please select the exact user for opinion');
      return;
    }

    setLoading(true);
    try {
      await api.post('/opinions/request', {
        fileId,
        requestedToDepartmentId: effectiveDepartmentId,
        requestedToDivisionId: divisionId || undefined,
        requestedToUserId: userId,
        requestReason: reason || undefined,
      });

      const targetText = selectedUser
        ? `${selectedUser.name} (${selectedDivision?.name || 'Division'})`
        : 'selected user';

      toast.success('Opinion request sent', {
        description: `File sent for opinion to ${targetText}`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error('Failed to send opinion request', {
        description:
          error?.response?.data?.message || 'An error occurred while requesting opinion',
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const canShowDepartment = mode === 'external';
  const canShowDivision = !!effectiveDepartmentId;
  const canShowUser = !!divisionId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg">
                  Send for Opinion
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
            <div className="flex items-center">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-indigo-600">
                  <span className="text-sm font-medium">1</span>
                </div>
                <span className="text-xs mt-1.5 opacity-80">Target</span>
              </div>
              <div className="h-0.5 w-8 mx-1 rounded-full bg-white/40" />
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white">
                  <span className="text-sm font-medium">2</span>
                </div>
                <span className="text-xs mt-1.5 opacity-80">Reason</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Inside vs Outside department */}
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as 'internal' | 'external')}
          >
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

          {/* Department */}
          {canShowDepartment && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4" />
                Target Department
              </Label>
              <Select
                value={selectedDepartmentId}
                onValueChange={(value) => setSelectedDepartmentId(value)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingDepartments ? 'Loading departments…' : 'Select department'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{dept.name}</span>
                        {dept.code && (
                          <Badge variant="outline" className="text-[10px]">
                            {dept.code}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Division */}
          {canShowDivision && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4" />
                Target Division
              </Label>
              <Select
                value={divisionId}
                onValueChange={(value) => setDivisionId(value)}
                disabled={loadingDivisions || !effectiveDepartmentId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !effectiveDepartmentId
                        ? 'Select department first'
                        : loadingDivisions
                        ? 'Loading divisions…'
                        : 'Select division'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((div) => (
                    <SelectItem key={div.id} value={div.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{div.name}</span>
                        {div.code && (
                          <Badge variant="outline" className="text-[10px]">
                            {div.code}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* User (mandatory) */}
          {canShowUser && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Target Officer (required)
              </Label>
              <Select
                value={userId}
                onValueChange={(value) => setUserId(value)}
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingUsers ? 'Loading users…' : 'Select exact officer'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                          {getInitials(u.name || u.username)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{u.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {u.username}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Reason (optional) */}
          <div className="space-y-2">
            <Label htmlFor="opinion-reason" className="text-sm font-medium">
              Reason / Instructions (optional)
            </Label>
            <Textarea
              id="opinion-reason"
              placeholder="Provide any context or specific questions for the opinion…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              The file will not be moved; only an opinion request will appear in the
              target officer&apos;s Opinion Inbox.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send for Opinion
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

