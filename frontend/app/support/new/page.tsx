'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  { value: 'other', label: 'Other' },
];

export default function NewTicketPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('NORMAL');
  const [category, setCategory] = useState<string>('other');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error('Subject and description are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/tickets', {
        subject: subject.trim(),
        description: description.trim(),
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
                required
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
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
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
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your issue in detail..."
                rows={6}
                required
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
