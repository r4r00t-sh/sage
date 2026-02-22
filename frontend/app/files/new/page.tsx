'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Editor } from '@/components/ui/editor';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import api from '@/lib/api';
import { hasRole } from '@/lib/auth-utils';
import {
  FileText,
  Upload,
  X,
  Calendar,
  Building2,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  MapPin,
  ScrollText,
  Send,
  Image as ImageIcon,
  File,
  FileImage,
  Trash2,
  ZoomIn,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileType,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserDepartment {
  id: string;
  name: string;
  code: string;
}

interface UserDivision {
  id: string;
  name: string;
  code: string;
}

interface UploadFile {
  file: File;
  preview: string | null;
  id: string;
}

export default function NewFilePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const [userDepartment, setUserDepartment] = useState<UserDepartment | null>(null);
  const [userDivision, setUserDivision] = useState<UserDivision | null>(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [fileMatter, setFileMatter] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  useEffect(() => {
    // Permission check: INWARD_DESK cannot create new files
    if (user) {
      const isInwardDesk = hasRole(user, 'INWARD_DESK') && !hasRole(user, 'DEPT_ADMIN') && !hasRole(user, 'SUPER_ADMIN');
      if (isInwardDesk) {
        router.push('/files');
        toast.error('Inward Desk users cannot create new files. They can only receive and forward files.');
        return;
      }
    }
    fetchUserInfo();
  }, [user]);

  const fetchUserInfo = async () => {
    if (!user) return;

    try {
      if (user.departmentId) {
        const deptResponse = await api.get(`/departments/${user.departmentId}`);
        setUserDepartment(deptResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch user department info');
    }

    if (user.divisionId) {
      try {
        if (user.departmentId) {
          const divResponse = await api.get(`/departments/${user.departmentId}/divisions`);
          const divisions = divResponse.data || [];
          const userDiv = divisions.find((d: Record<string, unknown>) => d.id === user.divisionId);
          if (userDiv) {
            setUserDivision(userDiv);
          }
        }
      } catch (error) {
        console.error('Failed to fetch division info');
      }
    }
  };

  const createFilePreview = async (file: File): Promise<string | null> => {
    if (file.type.startsWith('image/')) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    } else if (file.type === 'application/pdf') {
      return URL.createObjectURL(file);
    }
    return null;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      await addFiles(droppedFiles);
    }
  }, [files]);

  const validateFile = (file: File): boolean => {
    const maxSize = 50 * 1024 * 1024;
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (file.size > maxSize) {
      toast.error(`File "${file.name}" too large`, { description: 'Maximum file size is 50MB' });
      return false;
    }

    if (!allowedTypes.includes(file.type)) {
      toast.error(`Invalid file type: ${file.name}`, {
        description: 'Allowed: PDF, Word, Excel, JPEG, PNG, GIF, WebP',
      });
      return false;
    }

    return true;
  };

  const addFiles = async (newFiles: File[]) => {
    const validFiles = newFiles.filter(validateFile);
    
    if (files.length + validFiles.length > 10) {
      toast.error('Too many files', { description: 'Maximum 10 files allowed' });
      return;
    }

    const uploadFiles: UploadFile[] = await Promise.all(
      validFiles.map(async (file) => ({
        file,
        preview: await createFilePreview(file),
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }))
    );

    setFiles((prev) => [...prev, ...uploadFiles]);
    
    if (files.length === 0 && uploadFiles.length > 0) {
      setActivePreviewIndex(0);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      await addFiles(selectedFiles);
      e.target.value = ''; // Reset input
    }
  };

  const removeFile = (id: string) => {
    const index = files.findIndex((f) => f.id === id);
    
    // Revoke object URL if it's a PDF
    const fileToRemove = files.find((f) => f.id === id);
    if (fileToRemove?.file.type === 'application/pdf' && fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }

    setFiles((prev) => prev.filter((f) => f.id !== id));
    
    // Adjust active preview index
    if (index <= activePreviewIndex && activePreviewIndex > 0) {
      setActivePreviewIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }

    if (!user?.departmentId) {
      toast.error('You must be assigned to a department to create files');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('description', fileMatter);
      formData.append('departmentId', user.departmentId);
      if (user.divisionId) {
        formData.append('divisionId', user.divisionId);
      }
      formData.append('priority', priority);
      if (dueDate) {
        formData.append('dueDate', new Date(dueDate).toISOString());
      }
      
      // Append all files
      files.forEach((uploadFile) => {
        formData.append('files', uploadFile.file);
      });

      const response = await api.post('/files', formData);

      toast.success('File created successfully', {
        description: `File Number: ${response.data.fileNumber}`,
      });

      // Clean up object URLs
      files.forEach((f) => {
        if (f.file.type === 'application/pdf' && f.preview) {
          URL.revokeObjectURL(f.preview);
        }
      });

      router.push(`/files/${response.data.id}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to create file', {
        description: err.response?.data?.message || 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return FileImage;
    if (file.type === 'application/pdf') return FileText;
    if (file.type.includes('spreadsheet') || file.type.includes('excel')) return FileSpreadsheet;
    if (file.type.includes('word')) return FileType;
    return File;
  };

  // Check if user can create files
  if (!user?.departmentId) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="max-w-lg w-full">
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Cannot Create Files</h3>
            <p className="text-muted-foreground mb-6">
              You must be assigned to a department to create files.<br />
              Please contact your administrator.
            </p>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeFile = files[activePreviewIndex];

  return (
    <div className="min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Files
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New File</h1>
            <p className="text-muted-foreground mt-2">
              Fill in the details below to create a new file entry in the system
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-8 gap-2 px-3">
              <Building2 className="h-3.5 w-3.5" />
              {userDepartment?.name || 'Loading...'}
            </Badge>
            {userDivision && (
              <Badge variant="secondary" className="h-8 gap-2 px-3">
                <MapPin className="h-3.5 w-3.5" />
                {userDivision.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Side - Form */}
          <div className="space-y-8">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Enter the basic details for this file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-base">
                    Subject <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter the file subject"
                    required
                    disabled={loading}
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base flex items-center gap-2">
                    <ScrollText className="h-4 w-4" />
                    File Matter
                  </Label>
                  <Editor
                    value={fileMatter}
                    onChange={setFileMatter}
                    placeholder="Enter the detailed file matter..."
                    disabled={loading}
                    minHeight="200px"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  File Settings
                </CardTitle>
                <CardDescription>
                  Set priority and due date for this file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-base">Priority Level</Label>
                    <Select
                      value={priority}
                      onValueChange={setPriority}
                      disabled={loading}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full bg-slate-400" />
                            <span>Low Priority</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="NORMAL">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full bg-blue-500" />
                            <span>Normal Priority</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="HIGH">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full bg-orange-500" />
                            <span>High Priority</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="URGENT">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full bg-red-500" />
                            <span>Urgent</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Due Date
                    </Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      disabled={loading}
                      className="h-12"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upload Area */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Attachments
                    </CardTitle>
                    <CardDescription>
                      Upload documents or images (up to 10 files, max 50MB each)
                    </CardDescription>
                  </div>
                  {files.length > 0 && (
                    <Badge variant="secondary" className="text-base">
                      {files.length} / 10 files
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop Zone */}
                <div
                  className={cn(
                    'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all duration-300 cursor-pointer group',
                    dragActive
                      ? 'border-primary bg-primary/10 scale-[1.02] shadow-lg'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30 hover:shadow-md',
                    loading && 'opacity-50 pointer-events-none',
                    files.length >= 10 && 'opacity-50 pointer-events-none'
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className={cn(
                    "h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 transition-all duration-300",
                    dragActive ? "scale-110 from-primary/20 to-primary/10" : "group-hover:scale-110"
                  )}>
                    <Upload className={cn(
                      "h-8 w-8 transition-colors duration-300",
                      dragActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                    )} />
                  </div>
                  <p className="text-lg font-semibold mb-2">
                    {dragActive ? 'Drop files here' : 'Drop files here, or'} <span className="text-primary">browse</span>
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    PDF, Word, Excel, Images (max 50MB each)
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">Up to 10 files</Badge>
                    <span>•</span>
                    <span>Drag & drop supported</span>
                  </div>
                  <input
                    type="file"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                    multiple
                    disabled={loading || files.length >= 10}
                  />
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        Uploaded Files ({files.length})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Click to preview
                      </p>
                    </div>
                    {files.map((uploadFile, index) => {
                      const FileIcon = getFileIcon(uploadFile.file);
                      return (
                        <div
                          key={uploadFile.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer group animate-slide-up',
                            index === activePreviewIndex
                              ? 'border-primary bg-primary/5 shadow-sm scale-[1.01]'
                              : 'border-border hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm'
                          )}
                          onClick={() => setActivePreviewIndex(index)}
                        >
                          <div className={cn(
                            "h-11 w-11 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200",
                            index === activePreviewIndex 
                              ? "bg-primary/15" 
                              : "bg-primary/10 group-hover:bg-primary/15"
                          )}>
                            <FileIcon className={cn(
                              "h-5 w-5 transition-colors",
                              index === activePreviewIndex ? "text-primary" : "text-primary/70 group-hover:text-primary"
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                              {uploadFile.file.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(uploadFile.file.size)}
                              </p>
                              {index === activePreviewIndex && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Previewing
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(uploadFile.id);
                            }}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.back()}
                disabled={loading}
                className="flex-1 h-12"
              >
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={loading} className="flex-1 h-12">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Create File
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Side - Preview */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card className="h-[calc(100vh-200px)] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ZoomIn className="h-5 w-5" />
                      Attachment Preview
                    </CardTitle>
                    <CardDescription>
                      {files.length > 0
                        ? `Viewing ${activePreviewIndex + 1} of ${files.length}`
                        : 'Preview your uploaded documents here'}
                    </CardDescription>
                  </div>
                  {files.length > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setActivePreviewIndex((prev) => Math.max(0, prev - 1))}
                        disabled={activePreviewIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setActivePreviewIndex((prev) => Math.min(files.length - 1, prev + 1))}
                        disabled={activePreviewIndex === files.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                {activeFile ? (
                  <div className="flex-1 flex flex-col">
                    {activeFile.preview ? (
                      activeFile.file.type.startsWith('image/') ? (
                        <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
                          <img
                            src={activeFile.preview}
                            alt="Preview"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ) : activeFile.file.type === 'application/pdf' ? (
                        <iframe
                          src={activeFile.preview}
                          className="w-full flex-1 rounded-lg border"
                          title="PDF Preview"
                        />
                      ) : null
                    ) : (
                      <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg">
                        <div className="text-center">
                          {(() => {
                            const FileIcon = getFileIcon(activeFile.file);
                            return (
                              <>
                                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                                  <FileIcon className="h-10 w-10 text-muted-foreground" />
                                </div>
                                <p className="font-medium mb-1">{activeFile.file.name}</p>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Preview not available for this file type
                                </p>
                                <Badge variant="secondary">{formatFileSize(activeFile.file.size)}</Badge>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* File info footer */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="flex items-center gap-3 min-w-0">
                        {(() => {
                          const FileIcon = getFileIcon(activeFile.file);
                          return (
                            <>
                              <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{activeFile.file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(activeFile.file.size)}</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeFile(activeFile.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="h-24 w-24 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
                        <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                      <p className="text-lg font-medium text-muted-foreground mb-2">
                        No files uploaded
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Upload files to see previews here
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
