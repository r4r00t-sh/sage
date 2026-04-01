'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';
import { DepartmentProfileLink, DivisionProfileLink } from '@/components/profile-links';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  AlertTriangle,
  MoreVertical,
  Eye,
  Search,
  Plus,
  RefreshCw,
  TrendingUp,
  Inbox,
  Filter,
  ArrowUpDown,
  Download,
  ListOrdered,
  LogIn,
  Send,
  FolderInput,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { hasAnyRole, canCreateFiles } from '@/lib/auth-utils';
import { formatDistanceToNow, format } from 'date-fns';
import { QuickFilters, type Filter as QuickFilterItem } from '@/components/quick-filters';
import { BulkActions } from '@/components/bulk-actions';
import { ExportDialog } from '@/components/export-dialog';
import { EmptyState } from '@/components/empty-state';

interface InboxFile {
  id: string;
  status: string;
  priority?: string;
  fileNumber?: string;
  subject?: string;
  isRedListed?: boolean;
  department?: { id?: string; name: string };
  currentDivision?: { id?: string; name: string };
  createdAt?: string;
  [key: string]: unknown;
}

interface QueueEntry {
  id: string;
  fileId: string;
  sortOrder: number;
  createdAt: string;
  file: { id: string; fileNumber: string; subject: string; status: string; priority?: string; createdAt: string };
  fromUser?: { id: string; name: string } | null;
}

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [files, setFiles] = useState<InboxFile[]>([]);
  const [allFiles, setAllFiles] = useState<InboxFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const redlistedParam = searchParams.get('redlisted') === 'true';
  const [statusFilter, setStatusFilter] = useState<string>(
    redlistedParam ? 'redlisted' : (searchParams.get('status') || 'all')
  );
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'originated'>('inbox');
  const [sentFiles, setSentFiles] = useState<InboxFile[]>([]);
  const [sentFilesLoading, setSentFilesLoading] = useState(false);
  const [originatedFiles, setOriginatedFiles] = useState<InboxFile[]>([]);
  const [originatedFilesLoading, setOriginatedFilesLoading] = useState(false);

  useEffect(() => {
    fetchFiles(redlistedParam);
    fetchQueue();
  }, [redlistedParam]);

  useEffect(() => {
    if (activeTab === 'sent') {
      fetchSentFiles();
    } else if (activeTab === 'originated') {
      fetchOriginatedFiles();
    }
  }, [activeTab]);

  useEffect(() => {
    filterFiles();
  }, [searchQuery, statusFilter, priorityFilter, allFiles]);

  const fetchFiles = async (redlistedOnly?: boolean) => {
    setLoading(true);
    try {
      const params = redlistedOnly ? { redlisted: 'true' } : {};
      const response = await api.get('/files', { params });
      let fetchedFiles = response.data?.data || response.data || [];
      if (!Array.isArray(fetchedFiles)) {
        fetchedFiles = [];
      }
      setAllFiles(fetchedFiles);
      setFiles(fetchedFiles);
    } catch (error: unknown) {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const fetchSentFiles = async () => {
    setSentFilesLoading(true);
    try {
      const response = await api.get('/files/sent');
      const data = response.data?.data || response.data || [];
      setSentFiles(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load sent files');
      setSentFiles([]);
    } finally {
      setSentFilesLoading(false);
    }
  };

  const fetchOriginatedFiles = async () => {
    setOriginatedFilesLoading(true);
    try {
      const response = await api.get('/files', { params: { originated: 'true' } });
      const data = response.data?.data || response.data || [];
      setOriginatedFiles(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load originated files');
      setOriginatedFiles([]);
    } finally {
      setOriginatedFilesLoading(false);
    }
  };

  const fetchQueue = async () => {
    setQueueLoading(true);
    try {
      const response = await api.get('/files/queue');
      const data = response.data?.data ?? response.data;
      setQueueEntries(Array.isArray(data) ? data : []);
    } catch {
      setQueueEntries([]);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleClaimFromQueue = async (fileId: string) => {
    setClaimingId(fileId);
    try {
      await api.post(`/files/queue/${fileId}/claim`);
      toast.success('File moved to your inbox');
      await fetchQueue();
      await fetchFiles();
      router.push(`/files/${fileId}`);
    } catch (error: unknown) {
      toast.error(apiErrorMessage(error, 'Failed to claim file'));
    } finally {
      setClaimingId(null);
    }
  };

  const filterFiles = () => {
    let filtered = [...allFiles];

    if (statusFilter === 'redlisted') {
      filtered = filtered.filter((file) => file.isRedListed);
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter((file) => file.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter((file) => file.priority === priorityFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (file) =>
          file.fileNumber?.toLowerCase().includes(query) ||
          file.subject?.toLowerCase().includes(query)
      );
    }

    setFiles(filtered);
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { color: string; bgColor: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
      PENDING: { color: 'text-amber-600', bgColor: 'bg-amber-500/10', icon: Clock, label: 'Pending' },
      IN_PROGRESS: { color: 'text-blue-600', bgColor: 'bg-blue-500/10', icon: TrendingUp, label: 'In Progress' },
      APPROVED: { color: 'text-green-600', bgColor: 'bg-green-500/10', icon: CheckCircle2, label: 'Approved' },
      REJECTED: { color: 'text-red-600', bgColor: 'bg-red-500/10', icon: XCircle, label: 'Rejected' },
      ON_HOLD: { color: 'text-gray-600', bgColor: 'bg-gray-500/10', icon: Pause, label: 'On Hold' },
    };
    return config[status] || config.PENDING;
  };

  const getPriorityConfig = (priority: string) => {
    const config: Record<string, { color: string; bgColor: string; label: string }> = {
      LOW: { color: 'text-slate-600', bgColor: 'bg-slate-500', label: 'Low' },
      NORMAL: { color: 'text-blue-600', bgColor: 'bg-blue-500', label: 'Normal' },
      HIGH: { color: 'text-orange-600', bgColor: 'bg-orange-500', label: 'High' },
      URGENT: { color: 'text-red-600', bgColor: 'bg-red-500', label: 'Urgent' },
    };
    return config[priority] || config.NORMAL;
  };

  const stats = {
    total: allFiles.length,
    pending: allFiles.filter((f) => f.status === 'PENDING').length,
    inProgress: allFiles.filter((f) => f.status === 'IN_PROGRESS').length,
    redListed: allFiles.filter((f) => f.isRedListed).length,
  };

  const quickFilters: QuickFilterItem[] = [
    { id: 'all', label: 'All Files', value: 'all', count: stats.total },
    { id: 'PENDING', label: 'Pending', value: 'PENDING', count: stats.pending },
    { id: 'IN_PROGRESS', label: 'In Progress', value: 'IN_PROGRESS', count: stats.inProgress },
    { id: 'APPROVED', label: 'Approved', value: 'APPROVED', count: allFiles.filter((f) => f.status === 'APPROVED').length },
    { id: 'redlisted', label: 'Red Listed', value: 'redlisted', count: stats.redListed },
  ];

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const selectAllFiles = () => {
    setSelectedFiles(new Set(files.map(f => f.id)));
  };

  const deselectAllFiles = () => {
    setSelectedFiles(new Set());
  };

  const handleBulkExport = () => {
    setShowExportDialog(true);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">File Inbox</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Manage and process your assigned files
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="lg" onClick={() => { fetchFiles(); fetchQueue(); if (activeTab === 'sent') fetchSentFiles(); if (activeTab === 'originated') fetchOriginatedFiles(); }}>
            <RefreshCw className="mr-2 h-5 w-5" />
            Refresh
          </Button>
          {canCreateFiles(user) && (
            <Button size="lg" onClick={() => router.push('/files/new')}>
              <Plus className="mr-2 h-5 w-5" />
              New File
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'inbox' | 'sent' | 'originated')}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-6">
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Inbox ({allFiles.length})
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Sent Files
          </TabsTrigger>
          <TabsTrigger value="originated" className="flex items-center gap-2">
            <FolderInput className="h-4 w-4" />
            Originated
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-0 space-y-8">
      {/* Forward Queue */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5" />
                Forward queue
              </CardTitle>
              <CardDescription>
                Files sent to you while your desk was at capacity. Claim any file to move it into your inbox.
              </CardDescription>
            </div>
            {queueEntries.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                {queueEntries.length} waiting
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {queueLoading ? (
            <div className="flex items-center justify-center py-8">
              <Skeleton className="h-24 w-full max-w-md" />
            </div>
          ) : queueEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No files in your queue.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[140px]">File number</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-[140px]">From</TableHead>
                    <TableHead className="w-[120px]">Queued</TableHead>
                    <TableHead className="w-[100px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueEntries.map((entry) => (
                    <TableRow key={entry.id} data-sage-row className="transition-all duration-200">
                      <TableCell className="font-mono text-sm">{entry.file?.fileNumber ?? '-'}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{entry.file?.subject ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.fromUser?.name ?? '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {entry.createdAt ? formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true }) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleClaimFromQueue(entry.fileId)}
                          disabled={claimingId === entry.fileId}
                        >
                          {claimingId === entry.fileId ? (
                            'Claiming…'
                          ) : (
                            <>
                              <LogIn className="mr-1.5 h-4 w-4" />
                              Claim
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card 
          className={cn("cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group", statusFilter === 'all' && 'ring-2 ring-primary')}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 group-hover:text-primary transition-colors">Total Files</p>
                <p className="text-2xl sm:text-3xl font-bold group-hover:scale-105 transition-transform inline-block">{stats.total}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn("cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group", statusFilter === 'PENDING' && 'ring-2 ring-amber-500')}
          onClick={() => setStatusFilter('PENDING')}
        >
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 group-hover:text-amber-600 transition-colors">Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-600 group-hover:scale-105 transition-transform inline-block">{stats.pending}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn("cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group", statusFilter === 'IN_PROGRESS' && 'ring-2 ring-blue-500')}
          onClick={() => setStatusFilter('IN_PROGRESS')}
        >
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 group-hover:text-blue-600 transition-colors">In Progress</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 group-hover:scale-105 transition-transform inline-block">{stats.inProgress}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn("cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group", stats.redListed > 0 && 'border-red-500/50 animate-pulse-slow')}
        >
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 group-hover:text-red-600 transition-colors">Red Listed</p>
                <p className="text-2xl sm:text-3xl font-bold text-red-600 group-hover:scale-105 transition-transform inline-block">{stats.redListed}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-red-500/10 group-hover:bg-red-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Filters */}
      <QuickFilters
        filters={quickFilters}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by file number or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base"
                />
              </div>
              <div className="flex gap-3">
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[160px] h-12">
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="lg" onClick={handleBulkExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
            
            {/* Bulk Actions */}
            {selectedFiles.size > 0 && (
              <BulkActions
                selectedCount={selectedFiles.size}
                totalCount={files.length}
                onSelectAll={selectAllFiles}
                onDeselectAll={deselectAllFiles}
                onExport={handleBulkExport}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        endpoint="/files/export"
        filename="files"
        selectedIds={Array.from(selectedFiles)}
      />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {files.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No files found"
              description={
                searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your filters or search terms to find what you\'re looking for'
                  : 'Create your first file to get started with the e-filing system'
              }
              action={
                canCreateFiles(user) && !searchQuery && statusFilter === 'all'
                  ? {
                      label: 'Create New File',
                      onClick: () => router.push('/files/new'),
                    }
                  : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[50px] pl-6">
                    <Checkbox
                      checked={selectedFiles.size === files.length && files.length > 0}
                      onCheckedChange={(checked) => checked ? selectAllFiles() : deselectAllFiles()}
                    />
                  </TableHead>
                  <TableHead className="w-[180px]">File Number</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[120px]">Priority</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[140px]">Created</TableHead>
                  <TableHead className="w-[80px] pr-6"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => {
                  const statusConfig = getStatusConfig(file.status);
                  const priorityConfig = getPriorityConfig(file.priority ?? 'NORMAL');
                  const StatusIcon = statusConfig.icon;
                  const isSelected = selectedFiles.has(file.id);
                  return (
                    <TableRow 
                      key={file.id} 
                      data-sage-row
                      className={cn(
                        "cursor-pointer group h-20 transition-all duration-200",
                        isSelected && "bg-primary/5"
                      )}
                      onClick={() => router.push(`/files/${file.id}`)}
                    >
                      <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleFileSelection(file.id)}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => {
                        e.stopPropagation();
                        const num = file.fileNumber ?? '';
                        if (num && navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(num).then(() => toast.success('File number copied'));
                        }
                      }}>
                        <div className="flex items-center gap-3">
                          {Boolean(file.isRedListed) && (
                            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                          )}
                          <code className="text-sm font-mono font-medium">{file.fileNumber ?? ''}</code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[400px]">
                          <p className="font-medium truncate group-hover:text-primary transition-colors">
                            {file.subject}
                          </p>
                          <p className="text-sm text-muted-foreground truncate mt-1 flex items-center gap-1 flex-wrap">
                            {file.department && (
                              file.department.id ? (
                                <span onClick={(e) => e.stopPropagation()}>
                                  <DepartmentProfileLink departmentId={file.department.id} name={file.department.name} />
                                </span>
                              ) : (
                                <span>{file.department.name}</span>
                              )
                            )}
                            {file.department?.name && file.currentDivision?.name && ' • '}
                            {file.currentDivision && (
                              file.department?.id && file.currentDivision.id ? (
                                <span onClick={(e) => e.stopPropagation()}>
                                  <DivisionProfileLink departmentId={file.department.id} divisionId={file.currentDivision.id} name={file.currentDivision.name} />
                                </span>
                              ) : (
                                <span>{file.currentDivision.name}</span>
                              )
                            )}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 rounded-full", priorityConfig.bgColor)} />
                          <span className={cn("text-sm font-medium", priorityConfig.color)}>
                            {priorityConfig.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn("gap-1.5 font-medium", statusConfig.color, statusConfig.bgColor, "border-0")}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">
                            {file.createdAt ? format(new Date(file.createdAt), 'MMM d, yyyy') : '-'}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {file.createdAt ? formatDistanceToNow(new Date(file.createdAt), { addSuffix: true }) : ''}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-10 w-10 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/files/${file.id}`); }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/files/track/${file.id}`); }}>
                              <MapPin className="mr-2 h-4 w-4" />
                              Track File
                            </DropdownMenuItem>
                            {hasAnyRole(user, ['SECTION_OFFICER', 'DEPT_ADMIN', 'APPROVAL_AUTHORITY', 'SUPER_ADMIN', 'DEVELOPER']) && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/files/${file.id}?action=forward`); }}>
                                <Send className="mr-2 h-4 w-4" />
                                Forward File
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      {files.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {files.length} of {allFiles.length} files
        </p>
      )}
        </TabsContent>

        <TabsContent value="sent" className="mt-0 space-y-6">
          <Card>
            <CardContent className="p-0">
              {sentFilesLoading ? (
                <div className="p-8">
                  <Skeleton className="h-[400px] w-full" />
                </div>
              ) : sentFiles.length === 0 ? (
                <EmptyState
                  icon={Send}
                  title="No sent files"
                  description="Files you forward will appear here, similar to Sent Mail in email"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[180px]">File Number</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="w-[120px]">Priority</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead className="w-[140px]">Created</TableHead>
                      <TableHead className="w-[80px] pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentFiles.map((file) => {
                      const statusConfig = getStatusConfig(file.status);
                      const priorityConfig = getPriorityConfig(file.priority ?? 'NORMAL');
                      const StatusIcon = statusConfig.icon;
                      return (
                        <TableRow
                          key={file.id}
                          data-sage-row
                          className="cursor-pointer group h-20 transition-all duration-200 hover:bg-muted/50"
                          onClick={() => router.push(`/files/${file.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {Boolean(file.isRedListed) && (
                                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                              )}
                              <code className="text-sm font-mono font-medium">{file.fileNumber ?? ''}</code>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[400px]">
                              <p className="font-medium truncate group-hover:text-primary transition-colors">
                                {file.subject}
                              </p>
                              <p className="text-sm text-muted-foreground truncate mt-1 flex items-center gap-1 flex-wrap">
                                {file.department && (
                                  file.department.id ? (
                                    <span onClick={(e) => e.stopPropagation()}>
                                      <DepartmentProfileLink departmentId={file.department.id} name={file.department.name} />
                                    </span>
                                  ) : (
                                    <span>{file.department.name}</span>
                                  )
                                )}
                                {file.department?.name && file.currentDivision?.name && ' • '}
                                {file.currentDivision && (
                                  file.department?.id && file.currentDivision.id ? (
                                    <span onClick={(e) => e.stopPropagation()}>
                                      <DivisionProfileLink departmentId={file.department.id} divisionId={file.currentDivision.id} name={file.currentDivision.name} />
                                    </span>
                                  ) : (
                                    <span>{file.currentDivision.name}</span>
                                  )
                                )}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={cn('h-2.5 w-2.5 rounded-full', priorityConfig.bgColor)} />
                              <span className={cn('text-sm font-medium', priorityConfig.color)}>
                                {priorityConfig.label}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('gap-1.5 font-medium', statusConfig.color, statusConfig.bgColor, 'border-0')}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">
                                {file.createdAt ? format(new Date(file.createdAt), 'MMM d, yyyy') : '-'}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {file.createdAt ? formatDistanceToNow(new Date(file.createdAt), { addSuffix: true }) : ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="pr-6">
                            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={(e) => { e.stopPropagation(); router.push(`/files/${file.id}`); }}>
                              <Eye className="h-5 w-5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {sentFiles.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Showing {sentFiles.length} file{sentFiles.length !== 1 ? 's' : ''} you forwarded
            </p>
          )}
        </TabsContent>

        <TabsContent value="originated" className="mt-0 space-y-6">
          <Card>
            <CardContent className="p-0">
              {originatedFilesLoading ? (
                <div className="p-8">
                  <Skeleton className="h-[400px] w-full" />
                </div>
              ) : originatedFiles.length === 0 ? (
                <EmptyState
                  icon={FolderInput}
                  title="No originated files"
                  description="Files created by your department will appear here. Host department can track all files it initiated (Rule 9)."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[180px]">File Number</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="w-[120px]">Priority</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead className="w-[140px]">Created</TableHead>
                      <TableHead className="w-[80px] pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {originatedFiles.map((file) => {
                      const statusConfig = getStatusConfig(file.status);
                      const priorityConfig = getPriorityConfig(file.priority ?? 'NORMAL');
                      const StatusIcon = statusConfig.icon;
                      return (
                        <TableRow
                          key={file.id}
                          data-sage-row
                          className="cursor-pointer group h-20 transition-all duration-200 hover:bg-muted/50"
                          onClick={() => router.push(`/files/${file.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {Boolean(file.isRedListed) && (
                                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                              )}
                              <code className="text-sm font-mono font-medium">{file.fileNumber ?? ''}</code>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[400px]">
                              <p className="font-medium truncate group-hover:text-primary transition-colors">
                                {file.subject}
                              </p>
                              <p className="text-sm text-muted-foreground truncate mt-1 flex items-center gap-1 flex-wrap">
                                {file.department && (
                                  file.department.id ? (
                                    <span onClick={(e) => e.stopPropagation()}>
                                      <DepartmentProfileLink departmentId={file.department.id} name={file.department.name} />
                                    </span>
                                  ) : (
                                    <span>{file.department.name}</span>
                                  )
                                )}
                                {file.department?.name && file.currentDivision?.name && ' • '}
                                {file.currentDivision && (
                                  file.department?.id && file.currentDivision.id ? (
                                    <span onClick={(e) => e.stopPropagation()}>
                                      <DivisionProfileLink departmentId={file.department.id} divisionId={file.currentDivision.id} name={file.currentDivision.name} />
                                    </span>
                                  ) : (
                                    <span>{file.currentDivision.name}</span>
                                  )
                                )}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={cn('h-2.5 w-2.5 rounded-full', priorityConfig.bgColor)} />
                              <span className={cn('text-sm font-medium', priorityConfig.color)}>
                                {priorityConfig.label}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('gap-1.5 font-medium', statusConfig.color, statusConfig.bgColor, 'border-0')}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">
                                {file.createdAt ? format(new Date(file.createdAt), 'MMM d, yyyy') : '-'}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {file.createdAt ? formatDistanceToNow(new Date(file.createdAt), { addSuffix: true }) : ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="pr-6">
                            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={(e) => { e.stopPropagation(); router.push(`/files/${file.id}`); }}>
                              <Eye className="h-5 w-5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {originatedFiles.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Showing {originatedFiles.length} file{originatedFiles.length !== 1 ? 's' : ''} originated by your department
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid gap-6 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    }>
      <InboxContent />
    </Suspense>
  );
}
