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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Building2, ChevronRight, Loader2, Plus } from 'lucide-react';
import api from '@/lib/api';
import { hasAnyRole, hasGodRole } from '@/lib/auth-utils';
import { toast } from 'sonner';

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
  const [createOpen, setCreateOpen] = useState(false);
  const [organisations, setOrganisations] = useState<{ id: string; name: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newOrgId, setNewOrgId] = useState('');
  const [creating, setCreating] = useState(false);

  const canManageStructure = hasGodRole(currentUser);

  useEffect(() => {
    if (!hasAnyRole(currentUser, ['SUPER_ADMIN', 'DEPT_ADMIN', 'DEVELOPER'])) {
      router.replace('/dashboard');
      return;
    }
    fetchDepartments();
  }, [currentUser]);

  useEffect(() => {
    if (!createOpen || !canManageStructure) return;
    (async () => {
      try {
        const res = await api.get('/admin/organisations');
        const list = Array.isArray(res.data) ? res.data : [];
        setOrganisations(list);
        if (list.length === 1) setNewOrgId((prev) => prev || list[0].id);
      } catch {
        toast.error('Could not load organisations');
      }
    })();
  }, [createOpen, canManageStructure]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      let list = Array.isArray(res.data) ? res.data : [];
      if (
        hasAnyRole(currentUser, ['DEPT_ADMIN']) &&
        !hasAnyRole(currentUser, ['SUPER_ADMIN', 'DEVELOPER'])
      ) {
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

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim() || !newOrgId) {
      toast.error('Name, code, and organisation are required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/departments', {
        name: newName.trim(),
        code: newCode.trim(),
        organisationId: newOrgId,
      });
      toast.success('Department created');
      setCreateOpen(false);
      setNewName('');
      setNewCode('');
      setNewOrgId(organisations.length === 1 ? organisations[0].id : '');
      await fetchDepartments();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(typeof msg === 'string' ? msg : 'Could not create department');
    } finally {
      setCreating(false);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-muted-foreground">
            View department and division profiles and their users
          </p>
        </div>
        {canManageStructure && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="h-4 w-4 mr-2" />
                Add department
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleCreateDepartment}>
                <DialogHeader>
                  <DialogTitle>New department</DialogTitle>
                  <DialogDescription>
                    Create a department under an organisation. Division codes are generated when you add
                    divisions on the department page.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="dept-org">Organisation</Label>
                    <select
                      id="dept-org"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newOrgId}
                      onChange={(e) => setNewOrgId(e.target.value)}
                      required
                    >
                      <option value="">Select organisation</option>
                      {organisations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dept-name">Name</Label>
                    <Input
                      id="dept-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Department name"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dept-code">Code</Label>
                    <Input
                      id="dept-code"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      placeholder="Unique short code (e.g. HR)"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      'Create'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
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
