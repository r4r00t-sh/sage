'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AiTextarea } from '@/components/ai-textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const CATEGORIES = [
  { value: 'file_issue', label: 'File / Document issue' },
  { value: 'account', label: 'Account / Login' },
  { value: 'bug', label: 'Bug report' },
  { value: 'feature', label: 'Feature request' },
  { value: 'user_new', label: 'User – New user' },
  { value: 'user_delete', label: 'User – Delete user' },
  { value: 'user_transfer', label: 'User – Transfer user' },
  { value: 'other', label: 'Other' },
];

const ROLE_OPTIONS = [
  { value: 'DEPT_ADMIN', label: 'Department Admin' },
  { value: 'APPROVAL_AUTHORITY', label: 'Approval Authority' },
  { value: 'SECTION_OFFICER', label: 'Section Officer' },
  { value: 'INWARD_DESK', label: 'Inward Desk' },
  { value: 'DISPATCHER', label: 'Dispatcher' },
  { value: 'USER', label: 'User' },
] as const;

interface Department {
  id: string;
  name: string;
  code: string;
  divisions: { id: string; name: string }[];
}

export default function NewTicketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('NORMAL');
  const [category, setCategory] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [requestedRole, setRequestedRole] = useState<string>('');
  const [requestedDepartmentId, setRequestedDepartmentId] = useState<string>('');
  const [requestedDivisionId, setRequestedDivisionId] = useState<string>('');
  const [requestedFullName, setRequestedFullName] = useState<string>('');

  const isUserRequest =
    category === 'user_new' || category === 'user_delete' || category === 'user_transfer';

  const selectedDepartment = departments.find((d) => d.id === requestedDepartmentId);

  useEffect(() => {
    const initialCategory = searchParams.get('category');
    if (initialCategory && CATEGORIES.find((c) => c.value === initialCategory)) {
      setCategory(initialCategory);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isUserRequest) return;
    api
      .get('/departments')
      .then((res) => setDepartments(res.data))
      .catch(() => setDepartments([]));
  }, [isUserRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim()) {
      toast.error('Category is required');
      return;
    }
    if (!subject.trim() && !isUserRequest) {
      toast.error('Subject is required');
      return;
    }
    if (!description.trim() && !isUserRequest) {
      toast.error('Description is required');
      return;
    }

    if (isUserRequest) {
      if (!requestedRole || !requestedDepartmentId || !requestedFullName.trim()) {
        toast.error('Role, department, and full name are required for user requests');
        return;
      }
    }

    setSubmitting(true);
    try {
      const userTypeLabel =
        category === 'user_new'
          ? 'New User'
          : category === 'user_delete'
          ? 'Delete User'
          : category === 'user_transfer'
          ? 'Transfer User'
          : '';

      const finalSubject =
        subject.trim() ||
        (isUserRequest
          ? `[User Request] ${userTypeLabel}${requestedFullName ? ` - ${requestedFullName}` : ''}`
          : 'Support ticket');

      const baseDetails = description.trim();

      const deptLabel = selectedDepartment
        ? `${selectedDepartment.name} (${selectedDepartment.code})`
        : requestedDepartmentId || '-';
      const divLabel =
        selectedDepartment?.divisions.find((d) => d.id === requestedDivisionId)?.name ||
        (requestedDivisionId || '-');

      const composedDescription = isUserRequest
        ? [
            `User Request Type: ${userTypeLabel}`,
            `Role: ${requestedRole}`,
            `Department: ${deptLabel}`,
            `Division: ${divLabel}`,
            `Full Name: ${requestedFullName}`,
            '',
            'Details:',
            baseDetails || '(no additional details provided)',
          ].join('\n')
        : baseDetails;

      const res = await api.post('/tickets', {
        subject: finalSubject,
        description: composedDescription,
        priority: priority || 'NORMAL',
        category: category || undefined,
      });
      toast.success('Ticket created');
      router.push(`/support/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/support">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New support ticket</h1>
          <p className="text-muted-foreground">Describe your issue and we’ll get back to you.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" />
            Create ticket
          </CardTitle>
          <CardDescription>Provide as much detail as possible so support can help quickly.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0) + p.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={category || undefined} onValueChange={setCategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isUserRequest && (
              <div className="space-y-4 rounded-lg border p-3 bg-muted/40">
                <p className="text-xs text-muted-foreground">
                  This is a user management request. Please provide details for the account to be
                  created/updated.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select value={requestedRole} onValueChange={setRequestedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Full name *</Label>
                    <Input
                      value={requestedFullName}
                      onChange={(e) => setRequestedFullName(e.target.value)}
                      placeholder="User full name"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Department *</Label>
                    <Select
                      value={requestedDepartmentId}
                      onValueChange={(val) => {
                        setRequestedDepartmentId(val);
                        setRequestedDivisionId('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Division</Label>
                    <Select
                      value={requestedDivisionId}
                      onValueChange={setRequestedDivisionId}
                      disabled={!requestedDepartmentId}
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
            )}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <AiTextarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your issue… (@Ai + Ctrl+Enter)"
                rows={6}
                fieldHint="Support ticket description"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create ticket'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/support">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
