'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AiTextarea } from '@/components/ai-textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Workflow,
  Plus,
  Edit,
  Copy,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Download,
  Upload,
  GitBranch,
  Settings,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { hasRole } from '@/lib/auth-utils';
import { format } from 'date-fns';

interface WorkflowItem {
  id: string;
  name: string;
  code: string;
  description: string;
  version: number;
  isActive: boolean;
  isPublished: boolean;
  isDraft: boolean;
  fileType: string;
  priorityCategory: string;
  createdBy: { name: string };
  publishedBy?: { name: string };
  publishedAt?: string;
  createdAt: string;
  _count: {
    nodes: number;
    edges: number;
    executions: number;
  };
}

interface WorkflowTemplate {
  id: string;
  name: string;
  code: string;
  description?: string;
  category?: string;
  usageCount?: number;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    fileType: '',
    priorityCategory: 'ROUTINE',
  });

  useEffect(() => {
    fetchWorkflows();
    fetchTemplates();
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const response = await api.get('/workflows?includeInactive=true');
      setWorkflows(response.data);
    } catch (error: unknown) {
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const setWorkflowActive = async (workflowId: string, isActive: boolean) => {
    try {
      await api.patch(`/workflows/${workflowId}`, { isActive });
      toast.success(isActive ? 'Workflow activated' : 'Workflow deactivated');
      fetchWorkflows();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || (isActive ? 'Failed to activate' : 'Failed to deactivate'));
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/workflows/templates/list');
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to load templates');
    }
  };

  const createWorkflow = async () => {
    if (!formData.name || !formData.code) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      const response = await api.post('/workflows', {
        ...formData,
        departmentId: user && hasRole(user, 'DEPT_ADMIN') ? user.departmentId : undefined,
      });
      toast.success('Workflow created successfully');
      setShowCreateDialog(false);
      resetForm();
      // Navigate to workflow builder
      router.push(`/admin/workflows/${response.data.id}/builder`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to create workflow', {
        description: err.response?.data?.message,
      });
    } finally {
      setCreating(false);
    }
  };

  const createFromTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const code = `${template.code}_${Date.now()}`;
    const name = `${template.name} (Copy)`;

    try {
      const response = await api.post(`/workflows/templates/${templateId}/use`, {
        name,
        code,
        departmentId: user && hasRole(user, 'DEPT_ADMIN') ? user.departmentId : undefined,
      });
      toast.success('Workflow created from template');
      router.push(`/admin/workflows/${response.data.id}/builder`);
    } catch (error: unknown) {
      toast.error('Failed to create workflow from template');
    }
  };

  const publishWorkflow = async (workflowId: string) => {
    try {
      await api.post(`/workflows/${workflowId}/publish`);
      toast.success('Workflow published successfully');
      setConfirmPublishId(null);
      fetchWorkflows();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to publish workflow', {
        description: err.response?.data?.message,
      });
    }
  };

  const cloneWorkflow = async (workflowId: string, name: string) => {
    const newCode = `${workflows.find(w => w.id === workflowId)?.code}_COPY_${Date.now()}`;
    const newName = `${name} (Copy)`;

    try {
      const response = await api.post(`/workflows/${workflowId}/clone`, {
        code: newCode,
        name: newName,
      });
      toast.success('Workflow cloned successfully');
      router.push(`/admin/workflows/${response.data.id}/builder`);
    } catch (error: unknown) {
      toast.error('Failed to clone workflow');
    }
  };

  const deleteWorkflow = async (workflowId: string) => {
    try {
      await api.delete(`/workflows/${workflowId}`);
      toast.success('Workflow deleted successfully');
      setConfirmDeleteId(null);
      fetchWorkflows();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to delete workflow', {
        description: err.response?.data?.message,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      fileType: '',
      priorityCategory: 'ROUTINE',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GitBranch className="h-8 w-8 text-primary" />
            Workflow Builder
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage custom workflows for file processing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTemplateDialog(true)}>
            <Download className="mr-2 h-4 w-4" />
            From Template
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Workflows</p>
                <p className="text-2xl font-bold">{workflows.length}</p>
              </div>
              <Workflow className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {workflows.filter(w => w.isActive).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold text-amber-600">
                  {workflows.filter(w => w.isDraft).length}
                </p>
              </div>
              <Edit className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Templates</p>
                <p className="text-2xl font-bold text-blue-600">{templates.length}</p>
              </div>
              <Download className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflows Table */}
      <Card>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
          <CardDescription>
            Manage file processing workflows and automation rules
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>File Type</TableHead>
                <TableHead>Nodes</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{workflow.name}</p>
                      <code className="text-xs text-muted-foreground">{workflow.code}</code>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {workflow.fileType || 'All'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{workflow._count.nodes} nodes</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{workflow._count.executions}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      {workflow.isActive ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : workflow.isDraft ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                          <Edit className="h-3 w-3 mr-1" />
                          Draft
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-500/10 text-slate-600">
                          <Pause className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                      {workflow.isPublished && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setWorkflowActive(workflow.id, !workflow.isActive)}
                        >
                          {workflow.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">v{workflow.version}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/workflows/${workflow.id}/builder`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {workflow.isDraft && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmPublishId(workflow.id)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cloneWorkflow(workflow.id, workflow.name)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(workflow.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {workflows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No workflows found</p>
                    <Button
                      variant="link"
                      onClick={() => setShowCreateDialog(true)}
                      className="mt-2"
                    >
                      Create your first workflow
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Workflow Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Create a custom workflow for file processing
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Workflow Name *</Label>
              <Input
                placeholder="e.g., Standard Approval Process"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Workflow Code *</Label>
              <Input
                placeholder="e.g., STD_APPROVAL"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>

            <div>
              <Label>Description</Label>
              <AiTextarea
                placeholder="Describe this workflow… (@Ai + Ctrl+Enter)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                fieldHint="Workflow description"
                extraContext={() =>
                  formData.code.trim()
                    ? `Workflow code: ${formData.code}`
                    : null
                }
              />
            </div>

            <div>
              <Label>File Type (Optional)</Label>
              <Input
                placeholder="e.g., correspondence, application"
                value={formData.fileType}
                onChange={(e) => setFormData({ ...formData, fileType: e.target.value })}
              />
            </div>

            <div>
              <Label>Priority Category</Label>
              <Select
                value={formData.priorityCategory}
                onValueChange={(v) => setFormData({ ...formData, priorityCategory: v })}
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createWorkflow} disabled={creating}>
              {creating ? 'Creating...' : 'Create & Build'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create from Template</DialogTitle>
            <DialogDescription>
              Choose a pre-built workflow template to get started quickly
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 max-h-[400px] overflow-auto">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  createFromTemplate(template.id);
                  setShowTemplateDialog(false);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{template.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {template.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Used {template.usageCount} times
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {templates.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No templates available</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmPublishId} onOpenChange={(open) => !open && setConfirmPublishId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This workflow will become active. Departments using it may be affected. You can unpublish later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmPublishId && publishWorkflow(confirmPublishId)}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The workflow will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeleteId && deleteWorkflow(confirmDeleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
