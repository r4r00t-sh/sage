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
  MapPin,
  User,
  ChevronRight,
  FileText,
} from 'lucide-react';
import api from '@/lib/api';
import { hasAnyRole, getRoles } from '@/lib/auth-utils';

interface DivisionProfile {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  department: { id: string; name: string; code: string };
  _count?: { users: number; files: number };
  users: {
    id: string;
    name: string;
    username: string;
    roles: string[];
    designation?: string;
    staffId?: string;
    isActive: boolean;
  }[];
}

export default function DivisionProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuthStore();
  const deptId = params.deptId as string;
  const divisionId = params.divisionId as string;

  const [division, setDivision] = useState<DivisionProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasAnyRole(currentUser, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
      router.replace('/dashboard');
      return;
    }
    fetchDivision();
  }, [currentUser, deptId, divisionId]);

  useEffect(() => {
    if (!division || !currentUser) return;
    if (hasAnyRole(currentUser, ['DEPT_ADMIN']) && !hasAnyRole(currentUser, ['SUPER_ADMIN'])) {
      if (division.department?.id !== (currentUser as { departmentId?: string }).departmentId) {
        router.replace(`/admin/departments/${deptId}`);
      }
    }
  }, [division, currentUser, router, deptId]);

  const fetchDivision = async () => {
    try {
      const res = await api.get(`/departments/${deptId}/divisions/${divisionId}`);
      setDivision(res.data);
    } catch {
      router.replace(`/admin/departments/${deptId}`);
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

  if (!division) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/departments/${deptId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{division.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            {division.code}
            {division.department && (
              <>
                <span>·</span>
                <Link
                  href={`/admin/departments/${division.department.id}`}
                  className="hover:underline flex items-center gap-1"
                >
                  <Building2 className="h-3.5 w-3" />
                  {division.department.name}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Users</p>
                <p className="text-2xl font-bold">{division._count?.users ?? division.users?.length ?? 0}</p>
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
                <p className="text-2xl font-bold">{division._count?.files ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Users in this division
          </CardTitle>
          <CardDescription>Team members in {division.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {division.users?.length ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {division.users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.username}</TableCell>
                      <TableCell>{u.designation || '—'}</TableCell>
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
            <p className="text-sm text-muted-foreground py-4">No users in this division</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
