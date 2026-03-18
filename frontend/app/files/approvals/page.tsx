'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  FileText,
  CheckCircle,
  Search,
  ArrowLeft,
  Eye,
} from 'lucide-react';
import { DepartmentProfileLink } from '@/components/profile-links';

interface ApprovalFile {
  id: string;
  status: string;
  fileNumber?: string;
  subject?: string;
  isRedListed?: boolean;
  currentDivision?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string; username?: string } | null;
  department?: { id: string; name: string; code?: string } | null;
  createdBy?: { id: string; name: string } | null;
  createdAt?: string;
}

export default function PendingApprovalsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [files, setFiles] = useState<ApprovalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchFiles(), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { assignedToMe: 'true' };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const response = await api.get('/files', { params });
      const filesData = response.data?.data ?? response.data ?? [];
      setFiles(Array.isArray(filesData) ? filesData : []);
    } catch (error) {
      toast.error('Failed to load pending approvals');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading && files.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 gap-2"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Pending Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Files assigned to you for approval. Open a file to approve and forward.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by file number or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No pending approvals</h3>
            <p className="text-muted-foreground text-center mb-4">
              You have no files assigned for approval. New files will appear here when they are forwarded to you.
            </p>
            <Button variant="outline" onClick={() => router.push('/files/inbox')}>
              Go to Inbox
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <Card
              key={file.id}
              className="hover:shadow-md transition-shadow cursor-pointer border-primary/20"
              onClick={() => router.push(`/files/${file.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base truncate">{file.fileNumber}</CardTitle>
                  {file.isRedListed && (
                    <Badge variant="destructive" className="shrink-0">Red listed</Badge>
                  )}
                </div>
                <CardDescription className="line-clamp-2">{file.subject}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {file.department && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>Dept:</span>
                    <DepartmentProfileLink departmentId={file.department.id} name={file.department.name} />
                  </p>
                )}
                {file.currentDivision && (
                  <p className="text-xs text-muted-foreground">Stage: {file.currentDivision.name}</p>
                )}
                <Button
                  size="sm"
                  className="w-full mt-2 gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/files/${file.id}`);
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Open &amp; approve
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
