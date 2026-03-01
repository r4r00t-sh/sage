'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { hasRole, hasGodRole, getRoles } from '@/lib/auth-utils';
import { ForwardFileModal } from '@/components/forward-file-modal';
import { FileNotes } from '@/components/file-notes';
import { FileHistory } from '@/components/file-history';
import { QuickActions } from '@/components/quick-actions';
import { UserProfileLink, DepartmentProfileLink, DivisionProfileLink } from '@/components/profile-links';
import { FileTimer, PriorityCategoryBadge } from '@/components/file-timer';
import { RecallModal } from '@/components/recall-modal';
import {
  FileText,
  ArrowLeft,
  Calendar,
  Building2,
  User,
  Clock,
  AlertTriangle,
  Download,
  Send,
  ExternalLink,
  MapPin,
  Shield,
  Pause,
  Paperclip,
  FileImage,
  FileSpreadsheet,
  FileType,
  File,
  ChevronLeft,
  ChevronRight,
  Upload,
  Timer,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api';
import { getFilePreviewConfig, canPreviewFile } from '@/lib/file-preview';

// Helper to resolve attachment URLs
function resolveAttachmentUrl(url: string): string {
  if (!url) return '';
  // If already absolute URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // If relative URL from backend (starts with /), prepend API base
  if (url.startsWith('/')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
  uploadedBy?: {
    id: string;
    name: string;
    roles: string[];
    department: {
      id: string;
      name: string;
    } | null;
    division: {
      id: string;
      name: string;
    } | null;
  } | null;
}

interface FileNote {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
}

interface RoutingEntry {
  id: string;
  action: string;
  actionString?: string;
  remarks?: string;
  createdAt: string;
  fromUserId?: string;
  toUserId?: string;
  toDivisionId?: string;
  fromUser?: { id: string; name: string };
  toUser?: { id: string; name: string };
  toDivision?: { id: string; name: string };
}

interface FileDetails {
  id: string;
  fileNumber: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  priorityCategory?: string;
  isRedListed: boolean;
  isOnHold: boolean;
  holdReason?: string;
  dueDate?: string;
  deskArrivalTime?: string;
  allottedTime?: number;
  timerPercentage?: number;
  timeRemaining?: number;
  createdAt: string;
  fileUrl?: string;
  s3Key?: string;
  createdBy: { id: string; name: string; email?: string };
  assignedTo?: { id: string; name: string; email?: string };
  department: { id: string; name: string; code: string };
  currentDivision?: { id: string; name: string };
  intendedDivision?: { id: string; name: string; code?: string } | null;
  intendedUser?: { id: string; name: string; username?: string } | null;
  originDesk?: {
    id: string;
    name: string;
    code: string;
    department?: { name: string; code: string };
    division?: { name: string };
  } | null;
  notes: FileNote[];
  routingHistory: RoutingEntry[];
  attachments?: Attachment[];
}

// Helper to get file icon
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('word') || mimeType.includes('document')) return FileType;
  return File;
}

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Attachments Section Component
function AttachmentsSection({ 
  attachments, 
  legacyFileUrl, 
  legacyS3Key,
  fileId,
  onUpdate,
  canEdit = false,
}: { 
  attachments: Attachment[]; 
  legacyFileUrl?: string;
  legacyS3Key?: string;
  fileId: string;
  onUpdate: () => void;
  canEdit?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Build display items - use attachments if available, fallback to legacy
  const displayItems = attachments.length > 0 
    ? attachments 
    : legacyS3Key && legacyFileUrl 
      ? [{ id: 'legacy', filename: 'Document', mimeType: 'application/pdf', size: 0, url: legacyFileUrl, createdAt: '' }]
      : [];

  // Group attachments by department
  const groupedAttachments = displayItems.reduce((acc, attachment) => {
    const deptName = attachment.uploadedBy?.department?.name || 'Unknown Department';
    if (!acc[deptName]) {
      acc[deptName] = [];
    }
    acc[deptName].push(attachment);
    return acc;
  }, {} as Record<string, Attachment[]>);

  const activeItem = displayItems[activeIndex];

  const handleAttachmentClick = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
    setShowDetailModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    setUploading(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      await api.post(`/files/${fileId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(`${files.length} file(s) uploaded successfully`);
      onUpdate();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to upload files', {
        description: err.response?.data?.message,
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (displayItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Attachments
          </CardTitle>
          <CardDescription>No attachments on this file</CardDescription>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium mb-1">Upload attachments</p>
              <p className="text-sm text-muted-foreground">PDF, Word, Excel, PowerPoint, ODT, Images, Text files (max 50MB)</p>
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.html,.htm,.jpg,.jpeg,.png,.gif,.webp"
                disabled={uploading}
              />
            </label>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
              <Paperclip className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No attachments available</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments
            </CardTitle>
            <CardDescription>
              {displayItems.length} file{displayItems.length !== 1 ? 's' : ''} attached
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Add More'}
                  </span>
                </Button>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.html,.htm,.jpg,.jpeg,.png,.gif,.webp"
                  disabled={uploading}
                />
              </label>
            )}
            {displayItems.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {activeIndex + 1} / {displayItems.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setActiveIndex((prev) => Math.min(displayItems.length - 1, prev + 1))}
                  disabled={activeIndex === displayItems.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border">
          {activeItem ? (() => {
            const fileUrl = resolveAttachmentUrl(activeItem.url);
            const previewConfig = getFilePreviewConfig(
              fileUrl,
              activeItem.mimeType || '',
              activeItem.filename
            );

            if (previewConfig.type === 'image') {
              return (
                <img 
                  src={fileUrl} 
                  alt={activeItem.filename}
                  className="w-full h-full object-contain"
                />
              );
            }

            if (previewConfig.type === 'pdf' || previewConfig.type === 'office') {
              return (
                <iframe
                  src={previewConfig.url}
                  className="w-full h-full border-0"
                  title={activeItem.filename}
                  allow="fullscreen"
                />
              );
            }


            if (previewConfig.type === 'google-viewer') {
              return (
                <iframe
                  src={previewConfig.url}
                  className="w-full h-full border-0"
                  title={activeItem.filename}
                  allow="fullscreen"
                />
              );
            }

            // Download fallback
            return (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                {(() => {
                  const Icon = getFileIcon(activeItem.mimeType || '');
                  return <Icon className="h-16 w-16 mb-3 opacity-50" />;
                })()}
                <p className="text-sm font-medium mb-2">Preview not available</p>
                <p className="text-xs text-center mb-4">{activeItem.filename}</p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download to view
                </a>
              </div>
            );
          })() : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="h-16 w-16 mb-3 opacity-50" />
              <p>No file selected</p>
            </div>
          )}
        </div>

        {/* File List - Grouped by Department */}
        <div className="space-y-4">
          {Object.entries(groupedAttachments).map(([deptName, deptAttachments]) => (
            <div key={deptName} className="space-y-2">
              <div className="flex items-center gap-2 px-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm text-foreground">{deptName}</h4>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {deptAttachments.length} file{deptAttachments.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="grid gap-2">
                {deptAttachments.map((item, index) => {
                  const Icon = getFileIcon(item.mimeType);
                  const globalIndex = displayItems.findIndex(a => a.id === item.id);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors group",
                        globalIndex === activeIndex
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => setActiveIndex(globalIndex)}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.filename}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.size > 0 ? formatFileSize(item.size) : 'Document'}</span>
                          {item.uploadedBy && (
                            <>
                              <span>•</span>
                              <span className="truncate">{item.uploadedBy.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAttachmentClick(item);
                          }}
                          title="View details"
                        >
                          <User className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={resolveAttachmentUrl(item.url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={resolveAttachmentUrl(item.url)} download={item.filename} onClick={(e) => e.stopPropagation()}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Attachment Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachment Details
            </DialogTitle>
            <DialogDescription>
              Information about the uploaded attachment
            </DialogDescription>
          </DialogHeader>
          {selectedAttachment && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-1">File Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Filename:</span>
                    <span className="font-medium">{selectedAttachment.filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size:</span>
                    <span>{selectedAttachment.size > 0 ? formatFileSize(selectedAttachment.size) : 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span>{selectedAttachment.mimeType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uploaded:</span>
                    <span>{selectedAttachment.createdAt ? format(new Date(selectedAttachment.createdAt), 'PPp') : 'Unknown'}</span>
                  </div>
                </div>
              </div>

              {selectedAttachment.uploadedBy ? (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Uploader Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{selectedAttachment.uploadedBy.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Designation:</span>
                        <div className="flex gap-1">
                          {selectedAttachment.uploadedBy.roles.map((role) => (
                            <Badge key={role} variant="outline" className="text-xs">
                              {role.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {selectedAttachment.uploadedBy.department && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Department:</span>
                          <DepartmentProfileLink
                            departmentId={selectedAttachment.uploadedBy.department.id}
                            name={selectedAttachment.uploadedBy.department.name}
                          />
                        </div>
                      )}
                      {selectedAttachment.uploadedBy.division && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Division:</span>
                          <DivisionProfileLink
                            departmentId={selectedAttachment.uploadedBy.department?.id ?? ''}
                            divisionId={selectedAttachment.uploadedBy.division.id}
                            name={selectedAttachment.uploadedBy.division.name}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Uploader information not available
                </div>
              )}

              <Separator />

              <div className="flex gap-2 justify-end">
                <Button variant="outline" asChild>
                  <a href={resolveAttachmentUrl(selectedAttachment.url)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </a>
                </Button>
                <Button asChild>
                  <a href={resolveAttachmentUrl(selectedAttachment.url)} download={selectedAttachment.filename}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FileDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [file, setFile] = useState<FileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [recallModalOpen, setRecallModalOpen] = useState(false);
  const [showSetDueTimeDialog, setShowSetDueTimeDialog] = useState(false);
  const [dueTimeHours, setDueTimeHours] = useState<string>('24');
  const [settingDueTime, setSettingDueTime] = useState(false);

  const fileId = params.id as string;

  useEffect(() => {
    fetchFile();
    if (searchParams.get('action') === 'forward') {
      setForwardModalOpen(true);
    }
  }, [fileId]);

  const fetchFile = async () => {
    try {
      const response = await api.get(`/files/${fileId}`);
      setFile(response.data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to load file', {
        description: err.response?.data?.message || 'File not found',
      });
      router.push('/files/inbox');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const config: Record<string, { variant: string; label: string; color: string; bgColor: string }> = {
      PENDING: { variant: 'secondary', label: 'Pending', color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
      IN_PROGRESS: { variant: 'default', label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-500/10' },
      APPROVED: { variant: 'default', label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-500/10' },
      RETURNED: { variant: 'destructive', label: 'Returned', color: 'text-orange-600', bgColor: 'bg-orange-500/10' },
      REJECTED: { variant: 'destructive', label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-500/10' },
      ON_HOLD: { variant: 'secondary', label: 'On Hold', color: 'text-gray-600', bgColor: 'bg-gray-500/10' },
      RECALLED: { variant: 'destructive', label: 'Recalled', color: 'text-purple-600', bgColor: 'bg-purple-500/10' },
    };
    return config[status] || { variant: 'secondary', label: status, color: 'text-gray-600', bgColor: 'bg-gray-500/10' };
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-32" />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-24" />
            <Skeleton className="h-96" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!file) return null;

  const statusConfig = getStatusConfig(file.status);
  const canRecall = hasGodRole(user);
  
  // Permission check: Only the assigned user OR creator (if unassigned) can edit/perform actions
  // Super Admin can always edit
  const isAssignee = file.assignedTo?.id === user?.id;
  const isCreator = file.createdBy?.id === user?.id;
  const isUnassigned = !file.assignedTo;
  const isSuperAdmin = hasGodRole(user);
  const isDeptAdmin = hasRole(user, 'DEPT_ADMIN');
  const canSetDueTime = isSuperAdmin || isDeptAdmin;
  
  // Role-based permission checks
  const isInwardDesk = hasRole(user, 'INWARD_DESK') && !isDeptAdmin && !isSuperAdmin;
  const isDispatcher = hasRole(user, 'DISPATCHER') && !isDeptAdmin && !isSuperAdmin;
  const isSectionOfficer = hasRole(user, 'SECTION_OFFICER') && !isDeptAdmin && !isSuperAdmin;
  const isApprovalAuthority = hasRole(user, 'APPROVAL_AUTHORITY') && !isDeptAdmin && !isSuperAdmin;
  
    // Permission: Can add notes (INWARD_DESK and DISPATCHER cannot)
  const canAddNotes = !isInwardDesk && !isDispatcher && (isAssignee || (isCreator && isUnassigned) || isSuperAdmin || isDeptAdmin);
  
  // Permission: Can add attachments (INWARD_DESK cannot add to incoming files)
  const canAddAttachments = !isInwardDesk && (isAssignee || (isCreator && isUnassigned) || isSuperAdmin || isDeptAdmin);
  
  // User can edit if:
  // 1. They are the current assignee (file is with them), OR
  // 2. They are the creator AND file is unassigned (hasn't been forwarded yet), OR
  // 3. They are Super Admin
  const canEdit = isAssignee || (isCreator && isUnassigned) || isSuperAdmin;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button variant="ghost" className="mb-4 -ml-2" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Files
          </Button>
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold font-mono">{file.fileNumber}</h1>
                {file.isRedListed && (
                  <Badge variant="destructive" className="gap-1.5 animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Red Listed
                  </Badge>
                )}
                {file.isOnHold && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Pause className="h-3.5 w-3.5" />
                    On Hold
                  </Badge>
                )}
              </div>
              <p className="text-lg text-muted-foreground mt-1">{file.subject}</p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <Badge 
                  variant="outline" 
                  className={cn("gap-1.5", statusConfig.bgColor, statusConfig.color, "border-0")}
                >
                  {statusConfig.label}
                </Badge>
                <PriorityCategoryBadge category={file.priorityCategory || 'ROUTINE'} showTime />
              </div>
            </div>
          </div>
        </div>

        {/* Timer Display */}
        <div className="flex flex-col items-end gap-3">
          {(!file.deskArrivalTime || !file.allottedTime) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Due time not set - Timer will not work until due time is configured</span>
            </div>
          )}
          <FileTimer
            timerPercentage={file.timerPercentage || null}
            deskArrivalTime={file.deskArrivalTime}
            allottedTime={file.allottedTime}
            isRedListed={file.isRedListed}
            isOnHold={file.isOnHold}
            priorityCategory={file.priorityCategory}
            variant="clock"
          />
          <div className="flex gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setForwardModalOpen(true)} className="transition-all duration-200 hover:shadow-md">
                <Send className="mr-2 h-4 w-4" />
                Forward
              </Button>
            )}
            {canSetDueTime && (
              <Button 
                variant={(!file.deskArrivalTime || !file.allottedTime) ? "default" : "outline"}
                className={(!file.deskArrivalTime || !file.allottedTime) ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-blue-600 hover:text-blue-700"}
                onClick={() => {
                  // Pre-fill with current allotted time if available
                  if (file.allottedTime) {
                    setDueTimeHours((file.allottedTime / 3600).toString());
                  } else {
                    // Default to 24 hours if not set
                    setDueTimeHours('24');
                  }
                  setShowSetDueTimeDialog(true);
                }}
              >
                <Timer className="mr-2 h-4 w-4" />
                {(!file.deskArrivalTime || !file.allottedTime) ? 'Set Due Time' : 'Update Due Time'}
              </Button>
            )}
            {file.s3Key && (
              <Button variant="outline" asChild>
                <a href={resolveAttachmentUrl(file.fileUrl || '')} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            )}
            {canRecall && (
              <Button 
                variant="outline" 
                className="text-amber-600 hover:text-amber-700"
                onClick={() => setRecallModalOpen(true)}
              >
                <Shield className="mr-2 h-4 w-4" />
                Recall
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Permission Notice - Show when user cannot edit */}
      {!canEdit && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">View Only Mode</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  This file is currently assigned to{' '}
                  {file.assignedTo ? (
                    <UserProfileLink userId={file.assignedTo.id} name={file.assignedTo.name} />
                  ) : (
                    'another user'
                  )}
                  . Only they can perform actions on it.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hold Notice */}
      {file.isOnHold && file.holdReason && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Pause className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">File is on hold</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">{file.holdReason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions Bar - Only show if user can edit */}
      {canEdit && (
        <QuickActions
          fileId={file.id}
          fileNumber={file.fileNumber}
          currentStatus={file.status}
          isOnHold={file.isOnHold}
          userRole={getRoles(user)[0] || ''}
          onActionComplete={fetchFile}
        />
      )}

      {/* File Info Card - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            File Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {file.description && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">File Matter</h4>
              <div 
                className="prose dark:prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: file.description }}
              />
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Host Department</h4>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <DepartmentProfileLink departmentId={file.department.id} name={file.department.name} code={file.department.code} />
              </div>
            </div>
            {file.originDesk && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-muted-foreground">Desk of Origin</h4>
                <p className="text-sm font-medium">
                  {[file.originDesk.department?.name, file.originDesk.division?.name, file.originDesk.name].filter(Boolean).join(' / ')}
                </p>
                <p className="text-xs text-muted-foreground">{file.originDesk.code}</p>
              </div>
            )}
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Current Location</h4>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {file.currentDivision ? (
                  <DivisionProfileLink departmentId={file.department.id} divisionId={file.currentDivision.id} name={file.currentDivision.name} />
                ) : (
                  <span className="font-medium">General</span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Created By</h4>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <UserProfileLink userId={file.createdBy.id} name={file.createdBy.name} />
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Assigned To</h4>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {file.assignedTo ? (
                  <UserProfileLink userId={file.assignedTo.id} name={file.assignedTo.name} />
                ) : (
                  <span className="font-medium">Unassigned</span>
                )}
              </div>
            </div>
          </div>

          {(file.intendedDivision || file.intendedUser) && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground shrink-0">For:</span>
              <span className="font-medium flex items-center gap-1 flex-wrap">
                {file.intendedDivision && (
                  <DivisionProfileLink
                    departmentId={file.department.id}
                    divisionId={file.intendedDivision.id}
                    name={file.intendedDivision.name}
                  />
                )}
                {file.intendedDivision && file.intendedUser && ' → '}
                {file.intendedUser && (
                  <UserProfileLink userId={file.intendedUser.id} name={file.intendedUser.name} />
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {file.intendedUser ? 'Inward can forward in one click' : 'At department/division inward desk'}
              </span>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(new Date(file.createdAt), 'PPP')}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
              </p>
            </div>
            {file.dueDate && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-muted-foreground">Due Date</h4>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(file.dueDate), 'PPP')}</span>
                </div>
              </div>
            )}
            {file.deskArrivalTime && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-muted-foreground">Arrived at Desk</h4>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(file.deskArrivalTime), 'PPp')}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(file.deskArrivalTime), { addSuffix: true })}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Split Layout like Create File Page */}
      <div className="grid gap-6 lg:grid-cols-2 lg:min-h-[600px]">
        {/* Left Column - Notes & Timeline */}
        <div className="space-y-6">
          <Card className="h-full">
            <Tabs defaultValue="notes" className="h-full flex flex-col">
              <CardHeader className="pb-0">
                <TabsList className="w-full">
                  <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">Timeline</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="pt-6 flex-1 overflow-auto">
                <TabsContent value="notes" className="mt-0 h-full">
                  <FileNotes
                    fileId={file.id}
                    notes={file.notes}
                    onNoteAdded={fetchFile}
                    canEdit={canAddNotes}
                  />
                </TabsContent>
                <TabsContent value="history" className="mt-0 h-full">
                  <FileHistory routingHistory={file.routingHistory} createdAt={file.createdAt} createdBy={file.createdBy} />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        {/* Right Column - Attachments Preview */}
        <div className="space-y-6">
          <AttachmentsSection 
            attachments={file.attachments || []} 
            legacyFileUrl={file.fileUrl}
            legacyS3Key={file.s3Key}
            fileId={file.id}
            onUpdate={fetchFile}
            canEdit={canAddAttachments}
          />
        </div>
      </div>

      {/* Forward Modal */}
      <ForwardFileModal
        open={forwardModalOpen}
        onOpenChange={setForwardModalOpen}
        fileId={file.id}
        fileNumber={file.fileNumber}
        departmentId={file.department.id}
        onSuccess={fetchFile}
      />

      {/* Recall Modal */}
      {canRecall && (
        <RecallModal
          open={recallModalOpen}
          onOpenChange={setRecallModalOpen}
          file={{
            id: file.id,
            fileNumber: file.fileNumber,
            subject: file.subject,
            status: file.status,
            currentLocation: file.currentDivision?.name || file.department.name,
            currentOfficer: file.assignedTo?.name,
            createdBy: file.createdBy,
            department: file.department,
          }}
          onRecallComplete={() => {
            setRecallModalOpen(false);
            fetchFile();
          }}
        />
      )}

      {/* Set Due Time Dialog */}
      {canSetDueTime && (
        <Dialog open={showSetDueTimeDialog} onOpenChange={setShowSetDueTimeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-blue-600" />
                Set File Due Time
              </DialogTitle>
              <DialogDescription>
                Set the default due time for file {file.fileNumber}. This will set the allotted time for the file to be processed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800 dark:text-blue-200">Due Time Information</p>
                    <p className="text-blue-700 dark:text-blue-300 mt-1">
                      The due time is calculated from now. The file will be redlisted if not processed within this time.
                      {file.allottedTime && (
                        <>
                          <br />
                          Current allotted time: {(file.allottedTime / 3600).toFixed(1)} hours
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="due-time-hours">Allotted Time (Hours) *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="due-time-hours"
                    type="number"
                    min="1"
                    step="0.5"
                    value={dueTimeHours}
                    onChange={(e) => setDueTimeHours(e.target.value)}
                    placeholder="e.g., 24, 48, 72"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">hours</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Common values: 24 (1 day), 48 (2 days), 72 (3 days), 168 (1 week)
                </p>
              </div>

              {dueTimeHours && parseFloat(dueTimeHours) > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Due Date Preview:</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(Date.now() + parseFloat(dueTimeHours) * 3600 * 1000).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSetDueTimeDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const hours = parseFloat(dueTimeHours);
                  if (!hours || hours <= 0) {
                    toast.error('Please enter a valid number of hours');
                    return;
                  }

                  setSettingDueTime(true);
                  try {
                    await api.post(`/files/${file.id}/set-due-time`, {
                      allottedTimeInHours: hours,
                    });
                    toast.success('Due time set successfully', {
                      description: `File due time set to ${hours} hours`,
                    });
                    setShowSetDueTimeDialog(false);
                    fetchFile();
                  } catch (error: unknown) {
                    const err = error as { response?: { data?: { message?: string } } };
                    toast.error('Failed to set due time', {
                      description: err.response?.data?.message || 'An error occurred',
                    });
                  } finally {
                    setSettingDueTime(false);
                  }
                }}
                disabled={!dueTimeHours || parseFloat(dueTimeHours) <= 0 || settingDueTime}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {settingDueTime ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting...
                  </>
                ) : (
                  <>
                    <Timer className="mr-2 h-4 w-4" />
                    Set Due Time
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function FileDetailPage() {
  return (
    <Suspense fallback={
      <div className="space-y-8">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    }>
      <FileDetailContent />
    </Suspense>
  );
}
