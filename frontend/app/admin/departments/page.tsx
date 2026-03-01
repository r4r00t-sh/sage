'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { hasAnyRole } from '@/lib/auth-utils';

interface DepartmentListItem {
  id: string;
  name: string;
  code: string;
  organisation?: { id: string; name: string };
  divisions?: { id: string; name: string }[];
  _count?: { users: number; files: number };
}

export default function DepartmentsListPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [departments, setDepartments] = useState<DepartmentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasAnyRole(currentUser, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
      router.replace('/dashboard');
      return;
    }
    fetchDepartments();
  }, [currentUser]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      let list = Array.isArray(res.data) ? res.data : [];
      if (hasAnyRole(currentUser, ['DEPT_ADMIN']) && !hasAnyRole(currentUser, ['SUPER_ADMIN'])) {
        const deptId = (currentUser as { departmentId?: string }).departmentId;
        if (deptId) list = list.filter((d: DepartmentListItem) => d.id === deptId);
      }
      setDepartments(list);
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Departments</h1>
        <p className="text-muted-foreground">
          View department and division profiles and their users
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All departments
          </CardTitle>
          <CardDescription>Click a department to see its profile, divisions, and users</CardDescription>
        </CardHeader>
        <CardContent>
          {departments.length ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead className="text-center">Divisions</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead className="text-center">Files</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell className="text-muted-foreground">{dept.code}</TableCell>
                      <TableCell>{dept.organisation?.name ?? '—'}</TableCell>
                      <TableCell className="text-center">
                        {dept._count ? (
                          dept.divisions?.length ?? 0
                        ) : (
                          dept.divisions?.length ?? 0
                        )}
                      </TableCell>
                      <TableCell className="text-center">{dept._count?.users ?? 0}</TableCell>
                      <TableCell className="text-center">{dept._count?.files ?? 0}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/departments/${dept.id}`}>
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
            <p className="text-sm text-muted-foreground py-8 text-center">No departments found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
