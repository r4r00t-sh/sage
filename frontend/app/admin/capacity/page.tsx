'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Building2,
  Users,
  User,
  Settings,
  ChevronDown,
  ChevronRight,
  Edit,
  Save,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { Progress } from '@/components/ui/progress';

interface UserCapacity {
  userId: string;
  userName: string;
  maxFilesPerDay: number;
  currentFileCount: number;
  utilizationPercent: number;
}

interface DivisionCapacity {
  divisionId: string;
  divisionName: string;
  calculatedCapacity: number;
  currentFileCount: number;
  utilizationPercent: number;
  users: UserCapacity[];
}

interface DepartmentCapacity {
  departmentId: string;
  departmentName: string;
  calculatedCapacity: number;
  currentFileCount: number;
  utilizationPercent: number;
  divisions: DivisionCapacity[];
}

export default function CapacityManagementPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [capacityData, setCapacityData] = useState<DepartmentCapacity | null>(null);
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<{ userId: string; currentValue: number } | null>(null);
  const [editValue, setEditValue] = useState<number>(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartmentId) {
      fetchCapacityData(selectedDepartmentId);
    }
  }, [selectedDepartmentId]);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      setDepartments(response.data || []);
      // Auto-select user's department if available
      if (user?.departmentId && !selectedDepartmentId) {
        setSelectedDepartmentId(user.departmentId);
      }
    } catch (error) {
      toast.error('Failed to load departments');
    }
  };

  const fetchCapacityData = async (departmentId: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/capacity/department/${departmentId}/hierarchy`);
      setCapacityData(response.data);
      // Auto-expand all divisions
      if (response.data?.divisions) {
        setExpandedDivisions(new Set(response.data.divisions.map((d: DivisionCapacity) => d.divisionId)));
      }
    } catch (error) {
      toast.error('Failed to load capacity data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userCapacity: UserCapacity) => {
    setEditingUser({ userId: userCapacity.userId, currentValue: userCapacity.maxFilesPerDay });
    setEditValue(userCapacity.maxFilesPerDay);
  };

  const handleSaveUserCapacity = async () => {
    if (!editingUser || editValue < 1) {
      toast.error('Capacity must be at least 1');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/capacity/user/${editingUser.userId}`, {
        maxFilesPerDay: editValue,
      });
      toast.success('User capacity updated');
      setEditingUser(null);
      if (selectedDepartmentId) {
        fetchCapacityData(selectedDepartmentId);
      }
    } catch (error) {
      toast.error('Failed to update user capacity');
    } finally {
      setSaving(false);
    }
  };

  const toggleDivision = (divisionId: string) => {
    const newExpanded = new Set(expandedDivisions);
    if (newExpanded.has(divisionId)) {
      newExpanded.delete(divisionId);
    } else {
      newExpanded.add(divisionId);
    }
    setExpandedDivisions(newExpanded);
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 100) return 'text-red-600 bg-red-500/10';
    if (utilization >= 80) return 'text-amber-600 bg-amber-500/10';
    if (utilization >= 50) return 'text-yellow-600 bg-yellow-500/10';
    return 'text-green-600 bg-green-500/10';
  };

  if (loading && !capacityData) {
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Capacity Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage file capacity hierarchically: User → Division → Department
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
            <SelectTrigger className="w-[250px]">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDepartmentId && (
            <Button variant="outline" onClick={() => fetchCapacityData(selectedDepartmentId)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {!selectedDepartmentId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Select a Department</h3>
            <p className="text-muted-foreground">
              Choose a department to view and manage its capacity hierarchy
            </p>
          </CardContent>
        </Card>
      ) : capacityData ? (
        <div className="space-y-6">
          {/* Department Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {capacityData.departmentName}
              </CardTitle>
              <CardDescription>Department Capacity Overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Total Capacity</p>
                  <p className="text-2xl font-bold">{capacityData.calculatedCapacity}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sum of all division capacities
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Files</p>
                  <p className="text-2xl font-bold">{capacityData.currentFileCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Files in progress
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Utilization</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">
                      {capacityData.utilizationPercent.toFixed(1)}%
                    </p>
                    {capacityData.utilizationPercent >= 100 ? (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    ) : capacityData.utilizationPercent >= 80 ? (
                      <TrendingUp className="h-5 w-5 text-amber-600" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <Progress
                    value={Math.min(capacityData.utilizationPercent, 100)}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Divisions */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Divisions</h2>
            {capacityData.divisions.map((division) => (
              <Card key={division.divisionId}>
                <Collapsible
                  open={expandedDivisions.has(division.divisionId)}
                  onOpenChange={() => toggleDivision(division.divisionId)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedDivisions.has(division.divisionId) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            {division.divisionName}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Capacity</p>
                            <p className="font-semibold">{division.calculatedCapacity}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Files</p>
                            <p className="font-semibold">{division.currentFileCount}</p>
                          </div>
                          <Badge className={cn(getUtilizationColor(division.utilizationPercent))}>
                            {division.utilizationPercent.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Capacity</TableHead>
                            <TableHead>Current Files</TableHead>
                            <TableHead>Utilization</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {division.users.map((userCapacity) => (
                            <TableRow key={userCapacity.userId}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{userCapacity.userName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono">{userCapacity.maxFilesPerDay}</span>
                              </TableCell>
                              <TableCell>
                                <span>{userCapacity.currentFileCount}</span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={cn(
                                    getUtilizationColor(userCapacity.utilizationPercent),
                                  )}
                                >
                                  {userCapacity.utilizationPercent.toFixed(1)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditUser(userCapacity)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {/* Edit User Capacity Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Capacity</DialogTitle>
            <DialogDescription>
              Set the maximum number of files this user can handle per day. This will affect the
              division and department capacity calculations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="capacity">Files Per Day</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                value={editValue}
                onChange={(e) => setEditValue(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">
                Minimum: 1 file per day
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUserCapacity} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

