'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  UserPlus,
  UserMinus,
  Undo2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
import { hasAnyRole, getRoles } from '@/lib/auth-utils';

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'DEPT_ADMIN', label: 'Department Admin' },
  { value: 'CHAT_MANAGER', label: 'Chat Manager' },
  { value: 'APPROVAL_AUTHORITY', label: 'Approval Authority' },
  { value: 'SECTION_OFFICER', label: 'Section Officer' },
  { value: 'INWARD_DESK', label: 'Inward Desk' },
  { value: 'DISPATCHER', label: 'Dispatcher' },
  { value: 'USER', label: 'User' },
] as const;

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  designation?: string;
  staffId?: string;
  phone?: string;
  roles: string[];
  role?: string; // legacy
  isActive: boolean;
  department?: { id: string; name: string; code: string };
  division?: { id: string; name: string };
  points?: { currentPoints: number };
}

interface Department {
  id: string;
  name: string;
  code: string;
  divisions: { id: string; name: string }[];
}

export default function UsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  // Undo: track last bulk action for revert
  const [lastUndoable, setLastUndoable] = useState<{ ids: string[]; wasActivate: boolean } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    designation: '',
    staffId: '',
    phone: '',
    roles: ['SECTION_OFFICER'] as string[],
    departmentId: '',
    divisionId: '',
  });

  useEffect(() => {
    if (!hasAnyRole(currentUser, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
      router.push('/dashboard');
      return;
    }
    fetchUsers();
    fetchDepartments();
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users', {
        params: { search: searchQuery || undefined },
      });
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
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

  const handleCreate = async () => {
    if (!formData.username || !formData.password || !formData.name) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!formData.roles?.length) {
      toast.error('Please select at least one role');
      return;
    }

    setFormLoading(true);
    try {
      await api.post('/users', {
        ...formData,
        roles: formData.roles.length ? formData.roles : ['USER'],
        designation: formData.designation || undefined,
        staffId: formData.staffId || undefined,
        phone: formData.phone || undefined,
      });
      toast.success('User created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    setFormLoading(true);
    try {
      await api.put(`/users/${selectedUser.id}`, {
        name: formData.name,
        email: formData.email,
        designation: formData.designation || undefined,
        staffId: formData.staffId || undefined,
        phone: formData.phone || undefined,
        roles: formData.roles,
        departmentId: formData.departmentId || null,
        divisionId: formData.divisionId || null,
      });
      toast.success('User updated successfully');
      setIsEditOpen(false);
      fetchUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive });
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleResetPassword = async (userId: string) => {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      await api.put(`/users/${userId}/password`, { newPassword });
      toast.success('Password reset successfully');
    } catch (error) {
      toast.error('Failed to reset password');
    }
  };

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  };

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkLoading(true);
    try {
      for (const id of ids) {
        await api.delete(`/users/${id}`);
      }
      toast.success(`${ids.length} user(s) deactivated`);
      setLastUndoable({ ids, wasActivate: false });
      clearSelection();
      setDeleteDialogOpen(false);
      fetchUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to deactivate users');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkActivate = async (activate: boolean) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkLoading(true);
    try {
      for (const id of ids) {
        await api.put(`/users/${id}`, { isActive: activate });
      }
      toast.success(`${ids.length} user(s) ${activate ? 'activated' : 'deactivated'}`);
      if (!activate) setLastUndoable({ ids, wasActivate: false });
      clearSelection();
      setDeactivateDialogOpen(false);
      fetchUsers();
    } catch (error: unknown) {
      toast.error('Failed to update users');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!lastUndoable) return;
    setBulkLoading(true);
    try {
      for (const id of lastUndoable.ids) {
        await api.put(`/users/${id}`, { isActive: true });
      }
      toast.success(`${lastUndoable.ids.length} user(s) reactivated`);
      setLastUndoable(null);
      fetchUsers();
    } catch (error: unknown) {
      toast.error('Failed to undo');
    } finally {
      setBulkLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      email: user.email || '',
      designation: user.designation || '',
      staffId: user.staffId || '',
      phone: user.phone || '',
      roles: user.roles?.length ? [...user.roles] : ['USER'],
      departmentId: user.department?.id || '',
      divisionId: user.division?.id || '',
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      name: '',
      email: '',
      designation: '',
      staffId: '',
      phone: '',
      roles: ['SECTION_OFFICER'],
      departmentId: '',
      divisionId: '',
    });
    setSelectedUser(null);
  };

  const toggleRole = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-purple-500/10 text-purple-600',
      DEPT_ADMIN: 'bg-blue-500/10 text-blue-600',
      SECTION_OFFICER: 'bg-green-500/10 text-green-600',
      INWARD_DESK: 'bg-orange-500/10 text-orange-600',
    };
    return colors[role] || 'bg-gray-500/10 text-gray-600';
  };

  const selectedDepartment = departments.find(d => d.id === formData.departmentId);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage system users and their permissions
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
            className="pl-9"
          />
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={users.length > 0 && selectedIds.size === users.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Points</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="w-12">
                      <Checkbox
                        checked={selectedIds.has(user.id)}
                        onCheckedChange={() => toggleSelect(user.id)}
                        aria-label={`Select ${user.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="block hover:underline"
                      >
                        <p className="font-medium">{user.name}</p>
                        {user.email && (
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{user.username}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getRoles(user).map((r) => (
                          <Badge key={r} className={getRoleBadge(r)}>
                            {r.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.department ? (
                        <div>
                          <p className="text-sm">{user.department.name}</p>
                          {user.division && (
                            <p className="text-xs text-muted-foreground">
                              {user.division.name}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      {user.points?.currentPoints ?? 1000}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/users/${user.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditModal(user)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>
                            <Key className="mr-2 h-4 w-4" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(user)}
                            className={user.isActive ? 'text-destructive' : 'text-green-600'}
                          >
                            {user.isActive ? (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Floating bulk action bar - appears at bottom when users selected */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-background border rounded-xl shadow-lg animate-in slide-in-from-bottom-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-md"
            onClick={clearSelection}
          >
            <XCircle className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedIds.size} user{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="h-4 w-px bg-border mx-1" />
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => handleBulkActivate(true)}
              disabled={bulkLoading}
              title="Activate"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setDeactivateDialogOpen(true)}
              disabled={bulkLoading}
              title="Deactivate"
            >
              <UserMinus className="h-4 w-4" />
            </Button>
            {hasAnyRole(currentUser, ['SUPER_ADMIN']) && (
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8 rounded-md bg-red-600 hover:bg-red-700 text-white border-red-600"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={bulkLoading}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Undo bar - appears after bulk deactivate for reverting */}
      {lastUndoable && selectedIds.size === 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-background border rounded-xl shadow-lg animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium whitespace-nowrap">
            {lastUndoable.ids.length} user{lastUndoable.ids.length > 1 ? 's' : ''} deactivated
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleUndo}
            disabled={bulkLoading}
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-md"
            onClick={() => setLastUndoable(null)}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter username"
                />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="Designation"
                />
              </div>
              <div className="space-y-2">
                <Label>Staff ID</Label>
                <Input
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  placeholder="Staff ID"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Phone"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Roles *</Label>
              <div className="rounded-md border p-3 space-y-2 max-h-48 overflow-y-auto">
                {ROLE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`create-${opt.value}`}
                      checked={formData.roles.includes(opt.value)}
                      onCheckedChange={() => toggleRole(opt.value)}
                      disabled={opt.value === 'SUPER_ADMIN' && !hasAnyRole(currentUser, ['SUPER_ADMIN'])}
                    />
                    <label htmlFor={`create-${opt.value}`} className="text-sm font-medium leading-none cursor-pointer">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Select one or more roles</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value, divisionId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Division</Label>
                <Select
                  value={formData.divisionId}
                  onValueChange={(value) => setFormData({ ...formData, divisionId: value })}
                  disabled={!formData.departmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDepartment?.divisions.map((div) => (
                      <SelectItem key={div.id} value={div.id}>
                        {div.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={formLoading}>
              {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={formData.username} disabled />
            </div>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Staff ID</Label>
                <Input
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="rounded-md border p-3 space-y-2 max-h-48 overflow-y-auto">
                {ROLE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${opt.value}`}
                      checked={formData.roles.includes(opt.value)}
                      onCheckedChange={() => toggleRole(opt.value)}
                      disabled={opt.value === 'SUPER_ADMIN' && !hasAnyRole(currentUser, ['SUPER_ADMIN'])}
                    />
                    <label htmlFor={`edit-${opt.value}`} className="text-sm font-medium leading-none cursor-pointer">
                      {opt.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value, divisionId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Division</Label>
                <Select
                  value={formData.divisionId}
                  onValueChange={(value) => setFormData({ ...formData, divisionId: value })}
                  disabled={!formData.departmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDepartment?.divisions.map((div) => (
                      <SelectItem key={div.id} value={div.id}>
                        {div.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={formLoading}>
              {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Do you want to delete {selectedIds.size} user{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the selected user account{selectedIds.size > 1 ? 's' : ''}. Deactivated users cannot log in. You can undo this action or reactivate them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkLoading}>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate confirmation dialog */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Do you want to deactivate {selectedIds.size} user{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivated users cannot log in. You can undo this action or reactivate them later from the user list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkLoading}>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkActivate(false)}
              disabled={bulkLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserMinus className="h-4 w-4 mr-2" />
              )}
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

