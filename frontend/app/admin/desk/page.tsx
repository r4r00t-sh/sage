'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Search,
  RefreshCw,
  Circle,
  Building2,
  MapPin,
  Clock,
  UserCheck,
  UserX,
  Timer,
  Filter,
  Briefcase,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { hasRole, hasGodRole, getRoles } from '@/lib/auth-utils';
import { formatDistanceToNow } from 'date-fns';
import { UserProfileLink, DepartmentProfileLink, DivisionProfileLink } from '@/components/profile-links';

interface UserPresence {
  id: string;
  name: string;
  username: string;
  role: string;
  department?: { id?: string; name: string; code: string };
  division?: { id?: string; name: string; code: string };
  presenceStatus?: 'ACTIVE' | 'ABSENT' | 'SESSION_TIMEOUT' | null;
  lastPing?: string;
}

const roleLabels: Record<string, string> = {
  DEVELOPER: 'Developer',
  SUPER_ADMIN: 'Tech Panel',
  DEPT_ADMIN: 'Dept Admin',
  SUPPORT: 'Support',
  APPROVAL_AUTHORITY: 'Approval Authority',
  SECTION_OFFICER: 'Section Officer',
  INWARD_DESK: 'Inward Desk',
  DISPATCHER: 'Dispatcher',
  USER: 'User',
};

const statusConfig = {
  ACTIVE: {
    label: 'Active',
    color: 'text-green-600',
    bgColor: 'bg-green-500',
    lightBg: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    icon: UserCheck,
  },
  ABSENT: {
    label: 'Absent',
    color: 'text-slate-500',
    bgColor: 'bg-slate-400',
    lightBg: 'bg-slate-500/10',
    borderColor: 'border-slate-300',
    icon: UserX,
  },
  SESSION_TIMEOUT: {
    label: 'Timed Out',
    color: 'text-amber-600',
    bgColor: 'bg-amber-500',
    lightBg: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: Timer,
  },
};

export default function DeskPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, statusFilter, roleFilter, departmentFilter]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/desk-status');
      setUsers(response.data);
    } catch (error: unknown) {
      toast.error('Failed to load desk status');
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

  const filterUsers = () => {
    let filtered = [...users];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        u =>
          u.name.toLowerCase().includes(query) ||
          u.username.toLowerCase().includes(query) ||
          u.department?.name.toLowerCase().includes(query) ||
          u.division?.name.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => {
        if (!u.presenceStatus) return statusFilter === 'ABSENT';
        return u.presenceStatus === statusFilter;
      });
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // Department filter (Super Admin only)
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(u => u.department?.code === departmentFilter);
    }

    setFilteredUsers(filtered);
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.presenceStatus === 'ACTIVE').length,
    absent: users.filter(u => !u.presenceStatus || u.presenceStatus === 'ABSENT').length,
    timedOut: users.filter(u => u.presenceStatus === 'SESSION_TIMEOUT').length,
  };

  const isSuperAdmin = hasGodRole(user);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Active Desk Monitor
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time presence status of all users in the system
          </p>
        </div>
        
        <Button onClick={fetchUsers} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className={cn(
            "cursor-pointer transition-all",
            statusFilter === 'all' && 'ring-2 ring-primary'
          )}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all",
            statusFilter === 'ACTIVE' && 'ring-2 ring-green-500'
          )}
          onClick={() => setStatusFilter('ACTIVE')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Now</p>
                <p className="text-3xl font-bold text-green-600">{stats.active}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all",
            statusFilter === 'SESSION_TIMEOUT' && 'ring-2 ring-amber-500'
          )}
          onClick={() => setStatusFilter('SESSION_TIMEOUT')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Timed Out</p>
                <p className="text-3xl font-bold text-amber-600">{stats.timedOut}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Timer className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all",
            statusFilter === 'ABSENT' && 'ring-2 ring-slate-500'
          )}
          onClick={() => setStatusFilter('ABSENT')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="text-3xl font-bold text-slate-500">{stats.absent}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-slate-500/10 flex items-center justify-center">
                <UserX className="h-6 w-6 text-slate-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, username, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-3 flex-wrap">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <Briefcase className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="DEPT_ADMIN">Dept Admin</SelectItem>
                  <SelectItem value="APPROVAL_AUTHORITY">Approval Authority</SelectItem>
                  <SelectItem value="SECTION_OFFICER">Section Officer</SelectItem>
                  <SelectItem value="INWARD_DESK">Inward Desk</SelectItem>
                  <SelectItem value="DISPATCHER">Dispatcher</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>

              {isSuperAdmin && (
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Building2 className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.code}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(statusFilter !== 'all' || roleFilter !== 'all' || departmentFilter !== 'all') && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setStatusFilter('all');
                    setRoleFilter('all');
                    setDepartmentFilter('all');
                    setSearchQuery('');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Cards Grid */}
      {filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No users found</h3>
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== 'all' || roleFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No users available'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredUsers.map((u) => {
            const presenceStatus = u.presenceStatus || 'ABSENT';
            const status = statusConfig[presenceStatus] || statusConfig.ABSENT;
            const StatusIcon = status.icon;

            return (
              <Card 
                key={u.id}
                className={cn(
                  "relative overflow-hidden transition-all hover:shadow-lg",
                  status.borderColor,
                  "border-l-4"
                )}
              >
                {/* Status indicator dot */}
                <div className={cn(
                  "absolute top-4 right-4 h-3 w-3 rounded-full",
                  status.bgColor,
                  presenceStatus === 'ACTIVE' && 'animate-pulse'
                )} />

                <CardContent className="p-5">
                  {/* Avatar and Name */}
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className={cn(
                        "text-lg font-semibold",
                        status.lightBg,
                        status.color
                      )}>
                        {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        <UserProfileLink userId={u.id} name={u.name} />
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">@{u.username}</p>
                    </div>
                  </div>

                  {/* Designation Badge */}
                  <div className="mb-4">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs font-medium",
                        u.role === 'SUPER_ADMIN' && 'bg-purple-500/10 text-purple-600 border-purple-300',
                        u.role === 'DEPT_ADMIN' && 'bg-blue-500/10 text-blue-600 border-blue-300',
                        u.role === 'APPROVAL_AUTHORITY' && 'bg-emerald-500/10 text-emerald-600 border-emerald-300',
                        u.role === 'SECTION_OFFICER' && 'bg-cyan-500/10 text-cyan-600 border-cyan-300',
                        u.role === 'INWARD_DESK' && 'bg-orange-500/10 text-orange-600 border-orange-300',
                        u.role === 'DISPATCHER' && 'bg-pink-500/10 text-pink-600 border-pink-300',
                        !getRoles(u).some((r: string) => ['SUPER_ADMIN', 'DEPT_ADMIN', 'APPROVAL_AUTHORITY', 'SECTION_OFFICER', 'INWARD_DESK', 'DISPATCHER'].includes(r)) && 'bg-slate-500/10 text-slate-600 border-slate-300',
                      )}
                    >
                      {getRoles(u).map((r) => roleLabels[r] || r).join(', ') || '—'}
                    </Badge>
                  </div>

                  {/* Department & Division Info */}
                  <div className="space-y-2 text-sm">
                    {/* For Super Admin: Show Department */}
                    {isSuperAdmin && u.department && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          <span className="font-medium text-foreground">{u.department.code}</span>
                          {' - '}
                          {u.department.id ? (
                            <DepartmentProfileLink departmentId={u.department.id} name={u.department.name} />
                          ) : (
                            u.department.name
                          )}
                        </span>
                      </div>
                    )}

                    {/* Division */}
                    {u.division && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {u.department?.id && u.division.id ? (
                            <DivisionProfileLink departmentId={u.department.id} divisionId={u.division.id} name={u.division.name} />
                          ) : (
                            u.division.name
                          )}
                        </span>
                      </div>
                    )}

                    {/* No department/division assigned */}
                    {!u.department && !u.division && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="italic">No department assigned</span>
                      </div>
                    )}
                  </div>

                  {/* Status Footer */}
                  <div className={cn(
                    "mt-4 pt-4 border-t flex items-center justify-between"
                  )}>
                    <div className={cn("flex items-center gap-2", status.color)}>
                      <StatusIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">{status.label}</span>
                    </div>
                    {presenceStatus === 'ACTIVE' && (
                      <span className="text-xs text-muted-foreground">
                        Online now
                      </span>
                    )}
                    {presenceStatus === 'SESSION_TIMEOUT' && (
                      <span className="text-xs text-muted-foreground">
                        Session expired
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Showing {filteredUsers.length} of {users.length} users • Auto-refreshes every 30 seconds</p>
      </div>
    </div>
  );
}

