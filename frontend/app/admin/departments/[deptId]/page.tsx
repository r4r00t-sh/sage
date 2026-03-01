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
} from 'lucide-react';
import api from '@/lib/api';
import { hasAnyRole, getRoles } from '@/lib/auth-utils';

interface DepartmentProfile {
  id: string;
  name: string;
  code: string;
  organisation?: { id: string; name: string };
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

export default function DepartmentProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuthStore();
  const departmentId = params.deptId as string;

  const [department, setDepartment] = useState<DepartmentProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
