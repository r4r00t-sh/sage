import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface WorkflowContext {
  fileId: string;
  userId: string;
  action: string;
  variables: Record<string, any>;
}

@Injectable()
export class WorkflowEngineService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Start a workflow execution for a file
  async startWorkflow(
    workflowId: string,
    fileId: string,
    variables?: Record<string, any>,
  ) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        nodes: true,
        edges: true,
      },
    });

    if (!workflow || !workflow.isActive) {
      throw new NotFoundException('Workflow not found or inactive');
    }

    // Find start node
    const startNode = workflow.nodes.find((n) => n.nodeType === 'start');
    if (!startNode) {
      throw new Error('Workflow has no start node');
    }

    // Create execution
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        fileId,
        currentNodeId: startNode.nodeId,
        status: 'running',
        variables: variables || {},
      },
    });

    // Create first step
    await this.prisma.workflowExecutionStep.create({
      data: {
        executionId: execution.id,
        nodeId: startNode.nodeId,
        nodeName: startNode.label,
        result: 'started',
        startedAt: new Date(),
      },
    });

    return execution;
  }

  // Execute a workflow step (when user performs an action)
  async executeStep(
    executionId: string,
    userId: string,
    action: string,
    data?: {
      remarks?: string;
      targetNodeId?: string; // For manual routing
      output?: Record<string, any>;
    },
  ) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        workflow: {
          include: {
            nodes: true,
            edges: true,
          },
        },
        file: true,
      },
    });

    if (!execution) {
      throw new NotFoundException('Workflow execution not found');
    }

    if (execution.status !== 'running') {
      throw new BadRequestException(
        `Workflow is ${execution.status}, cannot execute step. Use Forward to send the file to someone.`,
      );
    }

    // Get current node
    const currentNode = execution.workflow.nodes.find(
      (n) => n.nodeId === execution.currentNodeId,
    );
    if (!currentNode) {
      throw new BadRequestException(
        'Current workflow step is missing in the workflow definition. Please edit the workflow in Admin → Workflows or use Forward to send the file.',
      );
    }

    // Validate action is allowed at this node. Treat "approve" as valid when node has
    // "forward" or "submit" so the Submit button works for Section Officer / Dept Admin.
    const availableActions = (currentNode.availableActions as string[]) || [];
    const actionLower = action?.toLowerCase?.() ?? '';
    const allowApproveAsForward =
      actionLower === 'approve' &&
      availableActions.some(
        (a) => (String(a).toLowerCase() === 'forward' || String(a).toLowerCase() === 'submit'),
      );
    if (
      availableActions.length > 0 &&
      !availableActions.map((a) => String(a).toLowerCase()).includes(actionLower) &&
      !allowApproveAsForward
    ) {
      throw new BadRequestException(
        `"${action}" is not allowed at this step (${currentNode.label}). Use Forward to send the file, or contact admin to update the workflow.`,
      );
    }

    // Find next node based on action and conditions
    const nextNode = await this.determineNextNode(
      execution.workflow,
      currentNode,
      action,
      data?.targetNodeId,
      execution.variables as Record<string, any>,
    );

    // Record the step
    const step = await this.prisma.workflowExecutionStep.create({
      data: {
        executionId,
        nodeId: currentNode.nodeId,
        nodeName: currentNode.label,
        action,
        performedById: userId,
        result: action,
        output: data?.output || {},
        remarks: data?.remarks,
        completedAt: new Date(),
        duration: 0, // Calculate if needed
      },
    });

    // Update execution
    let status = 'running';
    if (nextNode?.nodeType === 'end') {
      status = 'completed';
    }

    const updatedExecution = await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        currentNodeId: nextNode?.nodeId || null,
        status,
        completedAt: status === 'completed' ? new Date() : undefined,
        variables: {
          ...(execution.variables as object),
          ...(data?.output || {}),
        },
      },
    });

    // Notify next assignee if task node
    if (nextNode && nextNode.nodeType === 'task') {
      await this.notifyNextAssignee(nextNode, execution.file, userId);
    }

    return {
      execution: updatedExecution,
      step,
      nextNode,
    };
  }

  // Determine next node based on edges and conditions
  private async determineNextNode(
    workflow: any,
    currentNode: any,
    action: string,
    targetNodeId?: string,
    variables?: Record<string, any>,
  ) {
    // If target node specified (manual routing), use it
    if (targetNodeId) {
      return workflow.nodes.find((n: any) => n.nodeId === targetNodeId);
    }

    // Find outgoing edges from current node
    const outgoingEdges = workflow.edges
      .filter((e: any) => e.sourceNodeId === currentNode.id)
      .sort((a: any, b: any) => b.priority - a.priority); // Higher priority first

    // For decision nodes, evaluate conditions
    if (currentNode.nodeType === 'decision') {
      for (const edge of outgoingEdges) {
        if (this.evaluateCondition(edge.condition, action, variables)) {
          return workflow.nodes.find((n: any) => n.id === edge.targetNodeId);
        }
      }
    }

    // For task nodes, find edge matching the action (treat Forward/Submit as approve for Submit button)
    const actionLower = action.toLowerCase();
    const approveAliases = ['approve', 'forward', 'submit'];
    const actionMatches = (label: string | null) =>
      !label ||
      label.toLowerCase() === actionLower ||
      (actionLower === 'approve' && approveAliases.includes(label.toLowerCase()));

    for (const edge of outgoingEdges) {
      if (actionMatches(edge.label)) {
        return workflow.nodes.find((n: any) => n.id === edge.targetNodeId);
      }
    }

    // Default: take first available edge
    if (outgoingEdges.length > 0) {
      return workflow.nodes.find(
        (n: any) => n.id === outgoingEdges[0].targetNodeId,
      );
    }

    return null;
  }

  // Evaluate condition for decision nodes
  private evaluateCondition(
    condition: any,
    action: string,
    variables?: Record<string, any>,
  ): boolean {
    if (!condition) return true;

    // Simple condition evaluation
    // Format: { field: "action", operator: "equals", value: "approve" }
    const field = condition.field;
    const operator = condition.operator;
    const value = condition.value;

    let fieldValue: any;
    if (field === 'action') {
      fieldValue = action;
    } else if (variables && field in variables) {
      fieldValue = variables[field];
    } else {
      return false;
    }

    switch (operator) {
      case 'equals':
      case '==':
        return fieldValue === value;
      case 'not_equals':
      case '!=':
        return fieldValue !== value;
      case 'greater_than':
      case '>':
        return fieldValue > value;
      case 'less_than':
      case '<':
        return fieldValue < value;
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      default:
        return false;
    }
  }

  /** Resolve assignee and division for a workflow node (used by files.service for routing). */
  async resolveAssigneeForNode(
    node: { assigneeType?: string; assigneeValue?: string },
    file: { departmentId: string | null; assignedToId: string | null; createdById: string },
  ): Promise<{ assigneeId: string | null; divisionId: string | null }> {
    let assigneeId: string | null = null;

    switch (node.assigneeType) {
      case 'role':
        const userByRole = await this.prisma.user.findFirst({
          where: {
            roles: { has: node.assigneeValue as any },
            departmentId: file.departmentId,
            isActive: true,
          },
          select: { id: true, divisionId: true },
        });
        assigneeId = userByRole?.id ?? null;
        if (userByRole) {
          return { assigneeId: userByRole.id, divisionId: userByRole.divisionId };
        }
        return { assigneeId: null, divisionId: null };

      case 'user':
        assigneeId = node.assigneeValue ?? null;
        break;

      case 'department':
        const deptAdmin = await this.prisma.user.findFirst({
          where: {
            roles: { has: 'DEPT_ADMIN' },
            departmentId: node.assigneeValue,
            isActive: true,
          },
          select: { id: true, divisionId: true },
        });
        assigneeId = deptAdmin?.id ?? null;
        if (deptAdmin) {
          return { assigneeId: deptAdmin.id, divisionId: deptAdmin.divisionId };
        }
        return { assigneeId: null, divisionId: null };

      case 'dynamic':
        assigneeId = file.assignedToId || file.createdById;
        break;

      default:
        return { assigneeId: null, divisionId: null };
    }

    if (!assigneeId) return { assigneeId: null, divisionId: null };
    const user = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, divisionId: true },
    });
    return {
      assigneeId: user?.id ?? null,
      divisionId: user?.divisionId ?? null,
    };
  }

  /**
   * Resolve through decision nodes to get the next task or end node (for assignment).
   * When executeStep returns a decision node, use this to get the actual assignee target.
   */
  async resolveNextTaskOrEnd(
    workflow: { nodes: any[]; edges: any[] },
    fromNode: any,
    action: string,
    variables?: Record<string, any>,
    maxDepth = 10,
  ): Promise<any | null> {
    if (maxDepth <= 0) return null;
    const next = await this.determineNextNode(workflow, fromNode, action, undefined, variables);
    if (!next) return null;
    if (next.nodeType === 'task' || next.nodeType === 'end') return next;
    if (next.nodeType === 'decision') {
      return this.resolveNextTaskOrEnd(workflow, next, action, variables, maxDepth - 1);
    }
    return null;
  }

  /** Get the first task node after the start node (for initial file assignment). */
  getFirstTaskNodeAfterStart(workflow: { nodes: any[]; edges: any[] }): any | null {
    const startNode = workflow.nodes.find((n: any) => n.nodeType === 'start');
    if (!startNode) return null;
    const outgoing = workflow.edges.filter(
      (e: any) => e.sourceNodeId === startNode.id,
    );
    if (outgoing.length === 0) return null;
    const targetNode = workflow.nodes.find(
      (n: any) => n.id === outgoing[0].targetNodeId,
    );
    return targetNode?.nodeType === 'task' ? targetNode : null;
  }

  // Notify next assignee
  private async notifyNextAssignee(node: any, file: any, fromUserId: string) {
    const { assigneeId } = await this.resolveAssigneeForNode(node, file);
    if (assigneeId) {
      await this.notifications.createNotification({
        userId: assigneeId,
        type: 'workflow_task_assigned',
        title: 'New Task Assigned',
        message: `File ${file.fileNumber} requires your action at "${node.label}"`,
        fileId: file.id,
        metadata: {
          nodeId: node.nodeId,
          nodeName: node.label,
        },
      });
    }
  }

  // Get workflow execution for a file
  async getExecutionForFile(fileId: string) {
    return this.prisma.workflowExecution.findFirst({
      where: { fileId, status: 'running' },
      include: {
        workflow: {
          include: {
            nodes: true,
            edges: true,
          },
        },
        steps: {
          include: {
            performedBy: {
              select: { name: true, username: true },
            },
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    });
  }

  // Get available actions for current node
  async getAvailableActions(executionId: string) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        workflow: {
          include: {
            nodes: true,
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException('Workflow execution not found');
    }

    const currentNode = execution.workflow.nodes.find(
      (n) => n.nodeId === execution.currentNodeId,
    );
    if (!currentNode) {
      return [];
    }

    return (currentNode.availableActions as string[]) || [];
  }

  // Pause workflow
  async pauseWorkflow(executionId: string, userId: string) {
    return this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'paused',
        pausedAt: new Date(),
      },
    });
  }

  // Resume workflow
  async resumeWorkflow(executionId: string, userId: string) {
    return this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'running',
        pausedAt: null,
      },
    });
  }
}
