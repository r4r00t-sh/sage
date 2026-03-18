'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { canCreateFiles } from '@/lib/auth-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Plus,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileListItem {
  id: string;
  status: string;
  fileNumber?: string;
  subject?: string;
  timeRemaining?: number | null;
  isRedListed?: boolean;
  currentDivision?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string; username?: string } | null;
  department?: { id: string; name: string; code?: string } | null;
}

function FilesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const statusFilter = searchParams.get('status');
  const [files, setFiles] = useState<FileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFiles();
  }, [statusFilter]);

  // Debounced search: refetch when searchQuery changes (including when cleared)
  useEffect(() => {
    const t = setTimeout(() => fetchFiles(), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      
      const response = await api.get('/files', { params });
      // Handle both array response and paginated response
      const filesData = response.data?.data || response.data || [];
      setFiles(Array.isArray(filesData) ? filesData : []);
    } catch (error) {
      toast.error('Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: string; label: string }> = {
      PENDING: { variant: 'secondary', label: 'Pending' },
      IN_PROGRESS: { variant: 'default', label: 'In Progress' },
      APPROVED: { variant: 'default', label: 'Approved' },
      RETURNED: { variant: 'destructive', label: 'Returned' },
      REJECTED: { variant: 'destructive', label: 'Rejected' },
      ON_HOLD: { variant: 'secondary', label: 'On Hold' },
    };
    return config[status] || { variant: 'secondary', label: status };
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Files</h1>
          <p className="text-muted-foreground mt-2">
            Manage and track your assigned files
          </p>
        </div>
        {canCreateFiles(user) && (
          <Button onClick={() => router.push('/files/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New File
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files by number, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Files Grid */}
      {files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No files found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {statusFilter
                ? `You don't have any ${statusFilter.toLowerCase()} files.`
                : "You don't have any files assigned yet."}
            </p>
            {canCreateFiles(user) && (
              <Button onClick={() => router.push('/files/new')} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First File
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => {
            const statusConfig = getStatusBadge(file.status);
            return (
              <Card
                key={file.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/files/${file.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base mb-1">{file.fileNumber}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {file.subject}
                      </CardDescription>
                    </div>
                    <Badge variant={statusConfig.variant as 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'} className="ml-2">
                      {statusConfig.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {file.currentDivision && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-medium text-foreground">Stage:</span>
                        <span>{file.currentDivision.name}</span>
                      </div>
                    )}
                    {(file.assignedTo || file.department) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-medium text-foreground">With:</span>
                        <span>
                          {file.assignedTo?.name || file.department?.name || '—'}
                        </span>
                      </div>
                    )}
                    {file.timeRemaining != null && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{file.timeRemaining > 0 ? `${Math.floor(file.timeRemaining / 3600)}h remaining` : 'Overdue'}</span>
                      </div>
                    )}
                    {file.isRedListed && (
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>Red Listed</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FilesPage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    }>
      <FilesContent />
    </Suspense>
  );
}

