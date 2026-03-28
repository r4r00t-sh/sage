'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AiTextarea } from '@/components/ai-textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FileText,
  FolderPlus,
  QrCode,
  History,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  Filter,
  LayoutTemplate,
  ScanLine,
  FileStack,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { format, formatDistanceToNow } from 'date-fns';

interface FileTemplate {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  defaultSubject: string;
  defaultPriority: string;
  defaultPriorityCategory: string;
  defaultDueDays: number;
  isPublic: boolean;
  isActive: boolean;
  templateFilename: string;
  createdAt: string;
}

interface TemplateCategory {
  category: string;
  count: number;
}

interface ScanResult {
  message: string;
  file?: {
    fileNumber: string;
    subject: string;
    status: string;
    department: string;
    assignedTo?: string;
  };
}

export default function DocumentManagementPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('templates');
  const [loading, setLoading] = useState(true);
  
  // Templates state
  const [templates, setTemplates] = useState<FileTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create template dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    code: '',
    description: '',
    category: '',
    defaultSubject: '',
    defaultPriority: 'NORMAL',
    defaultPriorityCategory: 'ROUTINE',
    defaultDueDays: 7,
    isPublic: true,
  });

  // QR Scanner state
  const [qrData, setQrData] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await api.get('/documents/templates', {
        params: selectedCategory !== 'all' ? { category: selectedCategory } : {},
      });
      setTemplates(response.data);
    } catch (error: unknown) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/documents/templates-categories');
      setCategories(response.data);
    } catch (error: unknown) {
      console.error('Failed to load categories');
    }
  };

  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.code || !newTemplate.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      await api.post('/documents/templates', newTemplate);
      toast.success('Template created successfully');
      setShowCreateDialog(false);
      setNewTemplate({
        name: '',
        code: '',
        description: '',
        category: '',
        defaultSubject: '',
        defaultPriority: 'NORMAL',
        defaultPriorityCategory: 'ROUTINE',
        defaultDueDays: 7,
        isPublic: true,
      });
      fetchTemplates();
      fetchCategories();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to create template', {
        description: err.response?.data?.message,
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/documents/templates/${id}`);
      toast.success('Template deleted');
      fetchTemplates();
      fetchCategories();
    } catch (error: unknown) {
      toast.error('Failed to delete template');
    }
  };

  const scanQRCode = async () => {
    if (!qrData.trim()) {
      toast.error('Please enter QR code data');
      return;
    }

    setScanning(true);
    try {
      const response = await api.post('/documents/qr/scan', {
        qrCodeData: qrData,
        location: 'Manual Scan',
      });
      setScanResult(response.data);
      toast.success('QR code scanned successfully');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('QR code not recognized', {
        description: err.response?.data?.message,
      });
      setScanResult(null);
    } finally {
      setScanning(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(query) ||
        t.code.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const categoryOptions = [
    'correspondence',
    'application',
    'report',
    'memo',
    'notice',
    'circular',
    'petition',
    'complaint',
    'other',
  ];

  if (loading && templates.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileStack className="h-8 w-8 text-primary" />
            Document Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage file templates, QR codes, and document versions
          </p>
        </div>
        
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Templates</p>
                <p className="text-2xl font-bold">{templates.length}</p>
              </div>
              <LayoutTemplate className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{categories.length}</p>
              </div>
              <FolderPlus className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Public Templates</p>
                <p className="text-2xl font-bold">{templates.filter(t => t.isPublic).length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Attachments</p>
                <p className="text-2xl font-bold">{templates.filter(t => t.templateFilename).length}</p>
              </div>
              <FileText className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="qrscanner" className="gap-2">
            <QrCode className="h-4 w-4" />
            QR Scanner
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-2">
            <History className="h-4 w-4" />
            Version History
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4 mt-6">
          {/* Filters */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); fetchTemplates(); }}>
              <SelectTrigger className="w-[200px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.category} value={cat.category}>
                    {cat.category} ({cat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchTemplates}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Templates Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Default Priority</TableHead>
                    <TableHead>Due Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map(template => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{template.name}</p>
                            <p className="text-xs text-muted-foreground">{template.code}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {template.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline"
                            className={cn(
                              template.defaultPriority === 'URGENT' && 'bg-red-500/10 text-red-600',
                              template.defaultPriority === 'HIGH' && 'bg-orange-500/10 text-orange-600',
                              template.defaultPriority === 'NORMAL' && 'bg-blue-500/10 text-blue-600',
                              template.defaultPriority === 'LOW' && 'bg-slate-500/10 text-slate-600',
                            )}
                          >
                            {template.defaultPriority}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {template.defaultDueDays || '-'} days
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {template.isPublic ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600">
                              Public
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                              Private
                            </Badge>
                          )}
                          {template.isActive ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-600">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => deleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <LayoutTemplate className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground">No templates found</p>
                        <Button 
                          variant="link" 
                          onClick={() => setShowCreateDialog(true)}
                          className="mt-2"
                        >
                          Create your first template
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QR Scanner Tab */}
        <TabsContent value="qrscanner" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanLine className="h-5 w-5" />
                  Manual QR Code Entry
                </CardTitle>
                <CardDescription>
                  Enter the QR code data to track physical file movement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>QR Code Data</Label>
                  <Input
                    placeholder="EFILING-DEPT-DIV-2024-0001-..."
                    value={qrData}
                    onChange={(e) => setQrData(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={scanQRCode} 
                  disabled={scanning}
                  className="w-full"
                >
                  {scanning ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <QrCode className="mr-2 h-4 w-4" />
                      Scan QR Code
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Scan Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scanResult ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-600">File Found</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{scanResult.message}</p>
                    </div>
                    
                    {scanResult.file && (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">File Number</span>
                          <code className="font-mono">{scanResult.file.fileNumber}</code>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subject</span>
                          <span className="text-right max-w-[200px] truncate">{scanResult.file.subject}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant="outline">{scanResult.file.status}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Department</span>
                          <span>{scanResult.file.department}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Assigned To</span>
                          <span>{scanResult.file.assignedTo || 'Unassigned'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <QrCode className="h-16 w-16 text-muted-foreground mb-4 opacity-30" />
                    <p className="text-muted-foreground">
                      Enter a QR code to see file details
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>How to Generate QR Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <span className="font-bold text-primary">1</span>
                  </div>
                  <h4 className="font-medium mb-1">Open File Details</h4>
                  <p className="text-sm text-muted-foreground">
                    Navigate to the file you want to track physically
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <span className="font-bold text-primary">2</span>
                  </div>
                  <h4 className="font-medium mb-1">Generate QR Code</h4>
                  <p className="text-sm text-muted-foreground">
                    Click the QR code button to generate a unique tracking code
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <span className="font-bold text-primary">3</span>
                  </div>
                  <h4 className="font-medium mb-1">Print & Attach</h4>
                  <p className="text-sm text-muted-foreground">
                    Print the QR code and attach it to the physical file folder
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Version History Tab */}
        <TabsContent value="versions" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Document Version Control
              </CardTitle>
              <CardDescription>
                Track and manage different versions of file attachments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-16 w-16 text-muted-foreground mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">Version Control Available</h3>
                <p className="text-muted-foreground max-w-md mb-4">
                  To view and manage document versions, open a specific file and navigate to its attachments section. 
                  Each attachment shows its version history with options to upload new versions or restore previous ones.
                </p>
                <Button variant="outline" onClick={() => window.location.href = '/files/inbox'}>
                  <FileText className="mr-2 h-4 w-4" />
                  Go to Files
                </Button>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border">
                  <Upload className="h-8 w-8 text-blue-500 mb-3" />
                  <h4 className="font-medium mb-1">Upload New Version</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload a new version of any document while keeping the history intact
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <History className="h-8 w-8 text-green-500 mb-3" />
                  <h4 className="font-medium mb-1">View History</h4>
                  <p className="text-sm text-muted-foreground">
                    See all previous versions with timestamps and change descriptions
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <RefreshCw className="h-8 w-8 text-orange-500 mb-3" />
                  <h4 className="font-medium mb-1">Restore Version</h4>
                  <p className="text-sm text-muted-foreground">
                    Restore any previous version as the current active document
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create File Template</DialogTitle>
            <DialogDescription>
              Create a reusable template for common file types
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  placeholder="e.g., Leave Application"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Template Code *</Label>
                <Input
                  placeholder="e.g., LEAVE-APP"
                  value={newTemplate.code}
                  onChange={(e) => setNewTemplate({ ...newTemplate, code: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select 
                value={newTemplate.category} 
                onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(cat => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <AiTextarea
                placeholder="Template description… (@Ai + Ctrl+Enter)"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                rows={3}
                fieldHint="Document template description"
              />
            </div>

            <div className="space-y-2">
              <Label>Default Subject</Label>
              <Input
                placeholder="e.g., Application for Leave"
                value={newTemplate.defaultSubject}
                onChange={(e) => setNewTemplate({ ...newTemplate, defaultSubject: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Default Priority</Label>
                <Select 
                  value={newTemplate.defaultPriority} 
                  onValueChange={(v) => setNewTemplate({ ...newTemplate, defaultPriority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority Category</Label>
                <Select 
                  value={newTemplate.defaultPriorityCategory} 
                  onValueChange={(v) => setNewTemplate({ ...newTemplate, defaultPriorityCategory: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROUTINE">Routine</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="IMMEDIATE">Immediate</SelectItem>
                    <SelectItem value="PROJECT">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Due Days</Label>
                <Input
                  type="number"
                  min={1}
                  value={newTemplate.defaultDueDays}
                  onChange={(e) => setNewTemplate({ ...newTemplate, defaultDueDays: parseInt(e.target.value) || 7 })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createTemplate} disabled={creating}>
              {creating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

