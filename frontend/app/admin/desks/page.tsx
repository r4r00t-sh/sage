'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  FileText,
  Plus,
  Settings,
  TrendingUp,
  Clock,
  Box,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Edit,
  Trash2,
  User,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { DepartmentProfileLink } from '@/components/profile-links';
import { useAuthStore } from '@/lib/store';
import { hasRole } from '@/lib/auth-utils';

interface Desk {
  id: string;
  name: string;
  code: string;
  description?: string;
  type?: 'department' | 'division' | 'user' | 'desk';
  department: { id?: string; name: string; code: string } | null;
  division?: { id?: string; name: string } | null;
  maxFilesPerDay: number;
  currentFileCount: number;
  capacityUtilizationPercent: number;
  optimumCapacity: number;
  isActive: boolean;
  isAutoCreated: boolean;
  iconType: string;
  slaNorm?: number | null; // SLA norm in hours
  files?: Array<{
    id: string;
    fileNumber: string;
    subject: string;
    assignedTo?: { name: string };
  }>;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface WorkloadSummary {
  totalDesks: number;
  activeDesks: number;
  totalFiles: number;
  overallUtilization: number;
}

export default function DesksPage() {
  const { user } = useAuthStore();
  const canManageDesks = hasRole(user, 'DEVELOPER');
  const [desks, setDesks] = useState<Desk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedDesk, setSelectedDesk] = useState<Desk | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [divisions, setDivisions] = useState<Department[]>([]);
  const [workloadSummary, setWorkloadSummary] = useState<WorkloadSummary | null>(null);
  const [confirmDeleteDeskId, setConfirmDeleteDeskId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    departmentId: '',
    divisionId: '',
    maxFilesPerDay: 10,
    iconType: 'desk',
    slaNorm: '' as string | number, // SLA norm in hours
  });

  useEffect(() => {
    fetchDesks();
    fetchDepartments();
    fetchWorkloadSummary();
  }, []);

  const fetchDesks = async () => {
    try {
      const response = await api.get('/desks');
      setDesks(response.data);
    } catch (error: unknown) {
      toast.error('Failed to load desks');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data);
    } catch (error) {
      console.error('Failed to load departments');
    }
  };

  const fetchWorkloadSummary = async () => {
    try {
      const response = await api.get('/desks/workload/summary');
      setWorkloadSummary(response.data);
    } catch (error) {
      console.error('Failed to load workload summary');
    }
  };

  const handleCreateDesk = async () => {
    try {
      const payload = {
        ...formData,
        slaNorm: formData.slaNorm ? parseFloat(formData.slaNorm.toString()) : undefined,
      };
      await api.post('/desks', payload);
      toast.success('Desk created successfully');
      setShowCreateDialog(false);
      resetForm();
      fetchDesks();
      fetchWorkloadSummary();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create desk');
    }
  };

  const handleUpdateDesk = async () => {
    if (!selectedDesk) return;
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        maxFilesPerDay: formData.maxFilesPerDay,
        iconType: formData.iconType,
        slaNorm: formData.slaNorm ? parseFloat(formData.slaNorm.toString()) : undefined,
      };
      await api.patch(`/desks/${selectedDesk.id}`, payload);
      toast.success('Desk updated successfully');
      setShowEditDialog(false);
      resetForm();
      fetchDesks();
      fetchWorkloadSummary();
    } catch (error: unknown) {
      toast.error('Failed to update desk');
    }
  };

  const handleDeleteDesk = async (deskId: string) => {
    try {
      await api.delete(`/desks/${deskId}`);
      toast.success('Desk deleted successfully');
      setConfirmDeleteDeskId(null);
      fetchDesks();
      fetchWorkloadSummary();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to delete desk');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      departmentId: '',
      divisionId: '',
      maxFilesPerDay: 10,
      iconType: 'desk',
      slaNorm: '',
    });
    setSelectedDesk(null);
  };

  const openEditDialog = (desk: Desk) => {
    setSelectedDesk(desk);
    setFormData({
      name: desk.name,
      code: desk.code,
      description: desk.description || '',
      departmentId: desk.department?.code || '',
      divisionId: desk.division?.name || '',
      maxFilesPerDay: desk.maxFilesPerDay,
      iconType: desk.iconType || 'desk',
      slaNorm: desk.slaNorm || '',
    });
    setShowEditDialog(true);
  };

  const getCapacityColor = (utilization: number) => {
    if (utilization >= 100) return 'text-red-600 bg-red-500/10';
    if (utilization >= 80) return 'text-amber-600 bg-amber-500/10';
    if (utilization >= 50) return 'text-yellow-600 bg-yellow-500/10';
    return 'text-green-600 bg-green-500/10';
  };

  const getDockIcons = (desk: Desk) => {
    const activeDocks = Math.ceil(desk.currentFileCount / desk.maxFilesPerDay) || 1;
    const totalDocks = Math.ceil(desk.optimumCapacity / desk.maxFilesPerDay) || 1;
    return { activeDocks, totalDocks };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            Desk Workload & Capacity
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor desk capacity, utilization, and auto-create docks when needed
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchDesks(); fetchWorkloadSummary(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            {canManageDesks && (
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Desk
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Desk</DialogTitle>
                <DialogDescription>
                  Create a new desk with capacity settings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Desk Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Desk A"
                  />
                </div>
                <div>
                  <Label>Desk Code</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., DESK-A"
                  />
                </div>
                <div>
                  <Label>Department</Label>
                  <Select
                    value={formData.departmentId}
                    onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.code} - {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max Files Per Day</Label>
                  <Input
                    type="number"
                    value={formData.maxFilesPerDay}
                    onChange={(e) => setFormData({ ...formData, maxFilesPerDay: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div>
                  <Label>Icon Type</Label>
                  <Select
                    value={formData.iconType}
                    onValueChange={(value) => setFormData({ ...formData, iconType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desk">Desk</SelectItem>
                      <SelectItem value="cabinet">Cabinet</SelectItem>
                      <SelectItem value="folder">Folder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sla-norm-create">SLA Norm (Hours)</Label>
                  <Input
                    id="sla-norm-create"
                    type="number"
                    min="1"
                    step="0.5"
                    value={formData.slaNorm}
                    onChange={(e) => setFormData({ ...formData, slaNorm: e.target.value || '' })}
                    placeholder="e.g., 24, 48, 72"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Standard time (in hours) for files at this desk. Files will be redlisted if not processed within this time.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateDesk}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      {workloadSummary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Desks</p>
                  <p className="text-3xl font-bold">{workloadSummary.totalDesks}</p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Desks</p>
                  <p className="text-3xl font-bold text-green-600">{workloadSummary.activeDesks}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Files</p>
                  <p className="text-3xl font-bold">{workloadSummary.totalFiles}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Utilization</p>
                  <p className={cn(
                    "text-3xl font-bold",
                    workloadSummary.overallUtilization >= 100 ? 'text-red-600' :
                    workloadSummary.overallUtilization >= 80 ? 'text-amber-600' :
                    'text-green-600'
                  )}>
                    {workloadSummary.overallUtilization.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Desks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Desk Capacity Overview</CardTitle>
          <CardDescription>
            Monitor capacity utilization and auto-create docks when needed
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desk</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Current Files</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>SLA Norm</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Active Docks</TableHead>
                <TableHead>Status</TableHead>
                {canManageDesks && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {desks.map((desk) => {
                const { activeDocks, totalDocks } = getDockIcons(desk);
                const isFull = desk.capacityUtilizationPercent >= 100;
                const estimatedTime = desk.currentFileCount > 0
                  ? `${Math.ceil(desk.currentFileCount / desk.maxFilesPerDay)} days`
                  : 'Available';

                return (
                  <TableRow key={desk.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center",
                          desk.type === 'department' ? 'bg-blue-500/10' :
                          desk.type === 'division' ? 'bg-purple-500/10' :
                          desk.type === 'user' ? 'bg-green-500/10' :
                          desk.iconType === 'cabinet' ? 'bg-blue-500/10' :
                          desk.iconType === 'folder' ? 'bg-purple-500/10' :
                          'bg-primary/10'
                        )}>
                          {desk.type === 'department' ? (
                            <Building2 className="h-5 w-5 text-blue-600" />
                          ) : desk.type === 'division' ? (
                            <Box className="h-5 w-5 text-purple-600" />
                          ) : desk.type === 'user' ? (
                            <User className="h-5 w-5 text-green-600" />
                          ) : (
                            <Box className={cn(
                              "h-5 w-5",
                              desk.iconType === 'cabinet' ? 'text-blue-600' :
                              desk.iconType === 'folder' ? 'text-purple-600' :
                              'text-primary'
                            )} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{desk.name}</p>
                            {desk.type && (
                              <Badge variant="outline" className="text-xs">
                                {desk.type}
                              </Badge>
                            )}
                          </div>
                          <code className="text-xs text-muted-foreground">{desk.code}</code>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {desk.department ? (
                        <div>
                          <p className="text-sm font-medium">{desk.department.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {desk.department.id ? (
                              <DepartmentProfileLink departmentId={desk.department.id} name={desk.department.name} />
                            ) : (
                              desk.department.name
                            )}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{desk.currentFileCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">
                          {desk.currentFileCount} / {desk.maxFilesPerDay}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Optimum: {desk.optimumCapacity || desk.maxFilesPerDay}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {desk.type === 'desk' && desk.slaNorm ? (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{desk.slaNorm}h</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              desk.capacityUtilizationPercent >= 100 ? 'bg-red-500' :
                              desk.capacityUtilizationPercent >= 80 ? 'bg-amber-500' :
                              desk.capacityUtilizationPercent >= 50 ? 'bg-yellow-500' :
                              'bg-green-500'
                            )}
                            style={{ width: `${Math.min(desk.capacityUtilizationPercent, 100)}%` }}
                          />
                        </div>
                        <Badge variant="outline" className={getCapacityColor(desk.capacityUtilizationPercent)}>
                          {desk.capacityUtilizationPercent.toFixed(1)}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalDocks }).map((_, i) => (
                          <Box
                            key={i}
                            className={cn(
                              "h-4 w-4",
                              i < activeDocks
                                ? isFull ? 'text-red-600 fill-red-600' : 'text-green-600 fill-green-600'
                                : 'text-muted-foreground'
                            )}
                          />
                        ))}
                        <span className="text-xs text-muted-foreground ml-2">
                          {activeDocks}/{totalDocks}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline" className={cn(
                          desk.isActive ? 'bg-green-500/10 text-green-600' : 'bg-slate-500/10 text-slate-600'
                        )}>
                          {desk.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {desk.isAutoCreated && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 text-xs">
                            Auto
                          </Badge>
                        )}
                        {isFull && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 text-xs">
                            Full
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {canManageDesks && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(desk)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteDeskId(desk.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Desk</DialogTitle>
            <DialogDescription>
              Update desk configuration and capacity settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Desk Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Max Files Per Day</Label>
              <Input
                type="number"
                value={formData.maxFilesPerDay}
                onChange={(e) => setFormData({ ...formData, maxFilesPerDay: parseInt(e.target.value) || 10 })}
              />
            </div>
            <div>
              <Label>Icon Type</Label>
              <Select
                value={formData.iconType}
                onValueChange={(value) => setFormData({ ...formData, iconType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desk">Desk</SelectItem>
                  <SelectItem value="cabinet">Cabinet</SelectItem>
                  <SelectItem value="folder">Folder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sla-norm-edit">SLA Norm (Hours)</Label>
              <Input
                id="sla-norm-edit"
                type="number"
                min="1"
                step="0.5"
                value={formData.slaNorm}
                onChange={(e) => setFormData({ ...formData, slaNorm: e.target.value || '' })}
                placeholder="e.g., 24, 48, 72"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Standard time (in hours) for files at this desk. Files will be redlisted if not processed within this time.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateDesk}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDeleteDeskId} onOpenChange={(open) => !open && setConfirmDeleteDeskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete desk?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The desk will be permanently removed. Files assigned to it may need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeleteDeskId && handleDeleteDesk(confirmDeleteDeskId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

