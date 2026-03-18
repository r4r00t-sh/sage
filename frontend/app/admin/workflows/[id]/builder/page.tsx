'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnNodesDelete,
  type OnEdgesDelete,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Plus,
  Play,
  Settings,
  GitBranch,
  CheckCircle,
  AlertCircle,
  Trash2,
  Edit,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import WorkflowNodeComponent from './WorkflowNodeComponent';
import WorkflowEdgeComponent from './WorkflowEdgeComponent';

interface WorkflowNode {
  id: string;
  nodeType?: string;
  label?: string;
  description?: string;
  positionX?: number | null;
  positionY?: number | null;
  [key: string]: unknown;
}

interface WorkflowEdge {
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  [key: string]: unknown;
}

interface Workflow {
  name: string;
  code: string;
  version: number;
  isActive: boolean;
  isDraft: boolean;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  createdBy?: { name: string };
  publishedBy?: { name: string };
}

interface WorkflowValidation {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/** Roles that can be used as workflow assignees (matches backend UserRole) */
const WORKFLOW_ROLES = [
  { value: 'USER', label: 'User' },
  { value: 'INWARD_DESK', label: 'Inward Desk' },
  { value: 'SECTION_OFFICER', label: 'Section Officer' },
  { value: 'APPROVAL_AUTHORITY', label: 'Approval Authority' },
  { value: 'DISPATCHER', label: 'Dispatcher' },
  { value: 'DEPT_ADMIN', label: 'Department Admin' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'CHAT_MANAGER', label: 'Chat Manager' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'DEVELOPER', label: 'Developer' },
] as const;

export default function WorkflowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddNodeDialog, setShowAddNodeDialog] = useState(false);
  const [showAddEdgeDialog, setShowAddEdgeDialog] = useState(false);
  const [showEditNodeDialog, setShowEditNodeDialog] = useState(false);
  const [editingNode, setEditingNode] = useState<WorkflowNode | null>(null);
  const [validation, setValidation] = useState<WorkflowValidation | null>(null);
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);
  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string }[]>([]);

  const [nodeForm, setNodeForm] = useState({
    nodeId: '',
    nodeType: 'task',
    label: '',
    description: '',
    assigneeType: 'role',
    assigneeValue: '',
    timeLimit: 86400,
    availableActions: [] as string[],
  });

  const [editNodeForm, setEditNodeForm] = useState({
    label: '',
    description: '',
    assigneeType: 'role',
    assigneeValue: '',
    timeLimit: 86400,
    availableActions: [] as string[],
  });

  const [edgeForm, setEdgeForm] = useState({
    sourceNodeId: '',
    targetNodeId: '',
    label: '',
    condition: null as unknown,
  });

  useEffect(() => {
    fetchWorkflow();
  }, [workflowId]);

  useEffect(() => {
    const needLists = (showAddNodeDialog && nodeForm.nodeType === 'task') || (showEditNodeDialog && editingNode?.nodeType === 'task');
    if (needLists) {
      api.get('/users', { params: { search: '' } }).then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setUsersList(list.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name || u.id })));
      }).catch(() => setUsersList([]));
      api.get('/departments').then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        setDepartmentsList(list.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name || d.id })));
      }).catch(() => setDepartmentsList([]));
    }
  }, [showAddNodeDialog, nodeForm.nodeType, showEditNodeDialog, editingNode?.nodeType]);

  const fetchWorkflow = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/workflows/${workflowId}`);
      setWorkflow(response.data);
    } catch (error: unknown) {
      toast.error('Failed to load workflow');
      router.push('/admin/workflows');
    } finally {
      setLoading(false);
    }
  };

  const validateWorkflow = async () => {
    try {
      const response = await api.get(`/workflows/${workflowId}/validate`);
      setValidation(response.data);
      if (response.data.valid) {
        toast.success('Workflow is valid');
      } else {
        toast.error('Workflow has errors', {
          description: response.data.errors.join(', '),
        });
      }
    } catch (error) {
      toast.error('Failed to validate workflow');
    }
  };

  const publishWorkflow = async () => {
    if (!confirm('Publish this workflow? It will become active.')) return;

    try {
      await api.post(`/workflows/${workflowId}/publish`);
      toast.success('Workflow published successfully');
      fetchWorkflow();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to publish workflow', {
        description: err.response?.data?.message,
      });
    }
  };

  const defaultNewNodePosition = useMemo(() => {
    const count = workflow?.nodes?.length ?? 0;
    return { positionX: 200 + count * 220, positionY: 150 };
  }, [workflow?.nodes?.length]);

  const addNode = async () => {
    try {
      await api.post(`/workflows/${workflowId}/nodes`, {
        ...nodeForm,
        positionX: defaultNewNodePosition.positionX,
        positionY: defaultNewNodePosition.positionY,
      });
      toast.success('Node added successfully');
      setShowAddNodeDialog(false);
      fetchWorkflow();
      resetNodeForm();
    } catch (error: unknown) {
      toast.error('Failed to add node');
    }
  };

  const openEditNodeDialog = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const wfNode = workflow?.nodes?.find((n) => n.id === node.id) as WorkflowNode | undefined;
      if (!wfNode) return;
      setEditingNode(wfNode);
      setEditNodeForm({
        label: (wfNode.label as string) ?? '',
        description: (wfNode.description as string) ?? '',
        assigneeType: (wfNode.assigneeType as string) ?? 'role',
        assigneeValue: (wfNode.assigneeValue as string) ?? '',
        timeLimit: typeof wfNode.timeLimit === 'number' ? wfNode.timeLimit : 86400,
        availableActions: Array.isArray(wfNode.availableActions) ? wfNode.availableActions : [],
      });
      setShowEditNodeDialog(true);
    },
    [workflow?.nodes]
  );

  const saveEditNode = async () => {
    if (!editingNode) return;
    try {
      await api.patch(`/workflows/nodes/${editingNode.id}`, {
        label: editNodeForm.label,
        description: editNodeForm.description || undefined,
        assigneeType: editNodeForm.assigneeType,
        assigneeValue: editNodeForm.assigneeValue || undefined,
        timeLimit: editNodeForm.timeLimit,
        availableActions: editNodeForm.availableActions,
      });
      toast.success('Node updated');
      setShowEditNodeDialog(false);
      setEditingNode(null);
      fetchWorkflow();
    } catch (error: unknown) {
      toast.error('Failed to update node');
    }
  };

  const addEdge = async () => {
    try {
      await api.post(`/workflows/${workflowId}/edges`, edgeForm);
      toast.success('Connection added successfully');
      setShowAddEdgeDialog(false);
      fetchWorkflow();
      resetEdgeForm();
    } catch (error: unknown) {
      toast.error('Failed to add connection');
    }
  };

  const deleteNode = async (nodeId: string) => {
    if (!confirm('Delete this node?')) return;

    try {
      await api.delete(`/workflows/nodes/${nodeId}`);
      toast.success('Node deleted');
      fetchWorkflow();
    } catch (error: unknown) {
      toast.error('Failed to delete node');
    }
  };

  const deleteEdge = async (edgeId: string) => {
    if (!confirm('Delete this connection?')) return;

    try {
      await api.delete(`/workflows/edges/${edgeId}`);
      toast.success('Connection deleted');
      fetchWorkflow();
    } catch (error: unknown) {
      toast.error('Failed to delete connection');
    }
  };

  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node, _nodes: Node[]) => {
      const pos = node.position;
      try {
        await api.patch(`/workflows/nodes/${node.id}`, {
          positionX: pos.x,
          positionY: pos.y,
        });
        fetchWorkflow();
      } catch {
        toast.error('Failed to update node position');
      }
    },
    [workflowId]
  );

  const handleConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;
      try {
        await api.post(`/workflows/${workflowId}/edges`, {
          sourceNodeId: params.source,
          targetNodeId: params.target,
        });
        toast.success('Connection added');
        fetchWorkflow();
      } catch {
        toast.error('Failed to add connection');
      }
    },
    [workflowId]
  );

  const handleNodesDelete: OnNodesDelete = useCallback(
    async (nodesToDelete) => {
      for (const node of nodesToDelete) {
        try {
          await api.delete(`/workflows/nodes/${node.id}`);
        } catch {
          toast.error(`Failed to delete node ${node.id}`);
        }
      }
      if (nodesToDelete.length) fetchWorkflow();
    },
    []
  );

  const handleEdgesDelete: OnEdgesDelete = useCallback(
    async (edgesToDelete) => {
      for (const edge of edgesToDelete) {
        if (edge.id) {
          try {
            await api.delete(`/workflows/edges/${edge.id}`);
          } catch {
            toast.error(`Failed to delete connection`);
          }
        }
      }
      if (edgesToDelete.length) fetchWorkflow();
    },
    []
  );

  const nodeTypes = useMemo(() => ({ workflow: WorkflowNodeComponent }), []);
  const edgeTypes = useMemo(() => ({ workflow: WorkflowEdgeComponent }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!workflow?.nodes) return;
    const flowNodes: Node[] = workflow.nodes.map((n) => ({
      id: n.id,
      type: 'workflow' as const,
      position: { x: n.positionX ?? 0, y: n.positionY ?? 0 },
      data: {
        label: n.label,
        nodeType: n.nodeType,
        description: n.description,
        onDelete: (nodeId: string) => deleteNode(nodeId),
      },
    }));
    const flowEdges: Edge[] = (workflow.edges ?? []).map((e) => ({
      id: e.id as string,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      label: e.label,
      type: 'workflow',
      data: { onDelete: (edgeId: string) => deleteEdge(edgeId) },
    }));
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [workflow?.nodes, workflow?.edges]);

  const resetNodeForm = () => {
    setNodeForm({
      nodeId: '',
      nodeType: 'task',
      label: '',
      description: '',
      assigneeType: 'role',
      assigneeValue: '',
      timeLimit: 86400,
      availableActions: [],
    });
  };

  const resetEdgeForm = () => {
    setEdgeForm({
      sourceNodeId: '',
      targetNodeId: '',
      label: '',
      condition: null,
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

  if (!workflow) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" className="mb-4 -ml-2" onClick={() => router.push('/admin/workflows')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflows
          </Button>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight">{workflow.name}</h1>
            {workflow.isActive ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                <Edit className="h-3 w-3 mr-1" />
                Draft
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {workflow.description || 'No description'}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={validateWorkflow}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Validate
          </Button>
          {workflow.isDraft && (
            <Button onClick={publishWorkflow}>
              <Play className="mr-2 h-4 w-4" />
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Validation Results */}
      {validation && (
        <Card className={cn(
          validation.valid ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'
        )}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {validation.valid ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={cn(
                  "font-medium",
                  validation.valid ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                )}>
                  {validation.valid ? 'Workflow is valid' : 'Workflow has errors'}
                </p>
                {(validation.errors?.length ?? 0) > 0 && validation.errors && (
                  <ul className="text-sm text-red-700 dark:text-red-300 mt-2 list-disc list-inside">
                    {validation.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
                {(validation.warnings?.length ?? 0) > 0 && validation.warnings && (
                  <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 list-disc list-inside">
                    {validation.warnings.map((warn: string, i: number) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Canvas + Settings Tabs */}
      <Tabs defaultValue="canvas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="canvas">Canvas</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="canvas" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Drag nodes to move. Double-click a node to view or edit its details. Drag from a node&apos;s right handle to another&apos;s left to connect. Click a connection and use the trash icon to remove it, or select it and press Backspace/Delete.
          </p>
          <div className="rounded-lg border bg-muted/30 h-[600px]">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={handleNodeDragStop}
                onNodeDoubleClick={openEditNodeDialog}
                onConnect={handleConnect}
                onNodesDelete={handleNodesDelete}
                onEdgesDelete={handleEdgesDelete}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
                className="bg-background"
              >
                <Background />
                <Controls className="!bg-card !border !border-border rounded-lg shadow-md [&>button]:!bg-card [&>button]:!border [&>button]:!border-border [&>button]:!text-foreground [&>button_svg]:!fill-foreground [&>button:hover]:!bg-muted" />
                <Panel position="top-left" className="m-2">
                  <Button size="sm" onClick={() => setShowAddNodeDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Node
                  </Button>
                </Panel>
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Workflow Name</Label>
                <Input value={workflow.name} disabled />
              </div>
              <div>
                <Label>Workflow Code</Label>
                <Input value={workflow.code} disabled />
              </div>
              <div>
                <Label>Version</Label>
                <Input value={`v${workflow.version}`} disabled />
              </div>
              <div>
                <Label>Created By</Label>
                <Input value={workflow.createdBy?.name} disabled />
              </div>
              {workflow.publishedBy && (
                <div>
                  <Label>Published By</Label>
                  <Input value={workflow.publishedBy.name} disabled />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Node Dialog */}
      <Dialog open={showAddNodeDialog} onOpenChange={setShowAddNodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Node</DialogTitle>
            <DialogDescription>Add a new step to the workflow</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Node ID *</Label>
                <Input
                  placeholder="e.g., approval_step"
                  value={nodeForm.nodeId}
                  onChange={(e) => setNodeForm({ ...nodeForm, nodeId: e.target.value })}
                />
              </div>
              <div>
                <Label>Node Type *</Label>
                <Select
                  value={nodeForm.nodeType}
                  onValueChange={(v) => setNodeForm({ ...nodeForm, nodeType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">Start</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="decision">Decision</SelectItem>
                    <SelectItem value="end">End</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Label *</Label>
              <Input
                placeholder="e.g., Approval Authority"
                value={nodeForm.label}
                onChange={(e) => setNodeForm({ ...nodeForm, label: e.target.value })}
              />
            </div>

            {nodeForm.nodeType === 'task' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Assignee Type</Label>
                    <Select
                      value={nodeForm.assigneeType}
                      onValueChange={(v) => setNodeForm({ ...nodeForm, assigneeType: v, assigneeValue: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="role">Role</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="department">Department</SelectItem>
                        <SelectItem value="dynamic">Dynamic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assignee Value</Label>
                    {nodeForm.assigneeType === 'role' && (
                      <Select
                        value={nodeForm.assigneeValue || undefined}
                        onValueChange={(v) => setNodeForm({ ...nodeForm, assigneeValue: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKFLOW_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {nodeForm.assigneeType === 'user' && (
                      <Select
                        value={nodeForm.assigneeValue || undefined}
                        onValueChange={(v) => setNodeForm({ ...nodeForm, assigneeValue: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {usersList.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {nodeForm.assigneeType === 'department' && (
                      <Select
                        value={nodeForm.assigneeValue || undefined}
                        onValueChange={(v) => setNodeForm({ ...nodeForm, assigneeValue: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departmentsList.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {nodeForm.assigneeType === 'dynamic' && (
                      <p className="text-sm text-muted-foreground py-2">
                        Assignee is taken from the file (current assignee or creator).
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Time Limit (hours)</Label>
                  <Input
                    type="number"
                    value={Math.floor(nodeForm.timeLimit / 3600)}
                    onChange={(e) => setNodeForm({ ...nodeForm, timeLimit: parseInt(e.target.value) * 3600 })}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNodeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addNode}>Add Node</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Node Dialog */}
      <Dialog open={showEditNodeDialog} onOpenChange={(open) => { setShowEditNodeDialog(open); if (!open) setEditingNode(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Node details</DialogTitle>
            <DialogDescription>View and edit this step. Double-click a node on the canvas to open this.</DialogDescription>
          </DialogHeader>

          {editingNode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Node ID</Label>
                  <Input value={(editingNode.nodeId as string) ?? ''} disabled className="bg-muted" />
                </div>
                <div>
                  <Label>Node Type</Label>
                  <Input value={String(editingNode.nodeType ?? '').toLowerCase()} disabled className="bg-muted capitalize" />
                </div>
              </div>

              <div>
                <Label>Label *</Label>
                <Input
                  placeholder="e.g., Approval Authority"
                  value={editNodeForm.label}
                  onChange={(e) => setEditNodeForm({ ...editNodeForm, label: e.target.value })}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  placeholder="Optional description"
                  value={editNodeForm.description}
                  onChange={(e) => setEditNodeForm({ ...editNodeForm, description: e.target.value })}
                />
              </div>

              {editingNode.nodeType === 'task' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Assignee Type</Label>
                      <Select
                        value={editNodeForm.assigneeType}
                        onValueChange={(v) => setEditNodeForm({ ...editNodeForm, assigneeType: v, assigneeValue: '' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="role">Role</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="department">Department</SelectItem>
                          <SelectItem value="dynamic">Dynamic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Assignee Value</Label>
                      {editNodeForm.assigneeType === 'role' && (
                        <Select
                          value={editNodeForm.assigneeValue || undefined}
                          onValueChange={(v) => setEditNodeForm({ ...editNodeForm, assigneeValue: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {WORKFLOW_ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {editNodeForm.assigneeType === 'user' && (
                        <Select
                          value={editNodeForm.assigneeValue || undefined}
                          onValueChange={(v) => setEditNodeForm({ ...editNodeForm, assigneeValue: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent>
                            {usersList.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {editNodeForm.assigneeType === 'department' && (
                        <Select
                          value={editNodeForm.assigneeValue || undefined}
                          onValueChange={(v) => setEditNodeForm({ ...editNodeForm, assigneeValue: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departmentsList.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {editNodeForm.assigneeType === 'dynamic' && (
                        <p className="text-sm text-muted-foreground py-2">
                          Assignee is taken from the file (current assignee or creator).
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>Time Limit (hours)</Label>
                    <Input
                      type="number"
                      value={Math.floor(editNodeForm.timeLimit / 3600)}
                      onChange={(e) => setEditNodeForm({ ...editNodeForm, timeLimit: parseInt(e.target.value || '0') * 3600 })}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditNodeDialog(false); setEditingNode(null); }}>
              Cancel
            </Button>
            <Button onClick={saveEditNode} disabled={!editNodeForm.label?.trim()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Edge Dialog */}
      <Dialog open={showAddEdgeDialog} onOpenChange={setShowAddEdgeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Connection</DialogTitle>
            <DialogDescription>Connect two nodes in the workflow</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>From Node *</Label>
              <Select
                value={edgeForm.sourceNodeId}
                onValueChange={(v) => setEdgeForm({ ...edgeForm, sourceNodeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source node" />
                </SelectTrigger>
                <SelectContent>
                  {workflow.nodes?.map((node: WorkflowNode) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.label != null ? String(node.label) : node.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>To Node *</Label>
              <Select
                value={edgeForm.targetNodeId}
                onValueChange={(v) => setEdgeForm({ ...edgeForm, targetNodeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target node" />
                </SelectTrigger>
                <SelectContent>
                  {workflow.nodes?.map((node: WorkflowNode) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.label != null ? String(node.label) : node.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Label (Optional)</Label>
              <Input
                placeholder="e.g., Approved, Rejected"
                value={edgeForm.label}
                onChange={(e) => setEdgeForm({ ...edgeForm, label: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEdgeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addEdge}>Add Connection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
