import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  private isDeptAdminOnly(roles: string[]) {
    return (
      roles.includes('DEPT_ADMIN') &&
      !roles.includes('SUPER_ADMIN') &&
      !roles.includes('DEVELOPER')
    );
  }

  private async assertDeptAdminCanAccessWorkflow(
    workflowId: string,
    userDepartmentId: string | null | undefined,
    userRoles: string[],
  ) {
    if (!this.isDeptAdminOnly(userRoles)) return;
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { departmentId: true },
    });
    if (!workflow) return;
    // Dept admin can manage workflows for their department; global (null) workflows are allowed
    if (workflow.departmentId && workflow.departmentId !== userDepartmentId) {
      throw new ForbiddenException(
        'You can only edit workflows that belong to your department',
      );
    }
  }

  // Create workflow
  async createWorkflow(
    userId: string,
    userRoles: string[],
    data: {
      name: string;
      code: string;
      description?: string;
      departmentId?: string;
      fileType?: string;
      priorityCategory?: string;
    },
    userDepartmentId?: string | null,
  ) {
    // Check authorization
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can create workflows');
    }

    // Dept Admin can only create workflows for their department
    const departmentId =
      this.isDeptAdminOnly(userRoles) && userDepartmentId
        ? userDepartmentId
        : data.departmentId;

    // Check if code exists
    const existing = await this.prisma.workflow.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ForbiddenException('Workflow with this code already exists');
    }

    return this.prisma.workflow.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        departmentId,
        fileType: data.fileType,
        priorityCategory: data.priorityCategory,
        createdById: userId,
        isDraft: true,
        isActive: false,
        isPublished: false,
      },
    });
  }

  // Get all workflows
  async getWorkflows(departmentId?: string, includeInactive = false) {
    const where: any = {};

    if (departmentId) {
      where.OR = [
        { departmentId: null }, // Global workflows
        { departmentId },
      ];
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.workflow.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        publishedBy: { select: { name: true } },
        _count: {
          select: {
            nodes: true,
            edges: true,
            executions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get workflow by ID (optional user context for DEPT_ADMIN scope)
  async getWorkflowById(
    workflowId: string,
    user?: { departmentId?: string | null; roles?: string[] },
  ) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        nodes: {
          orderBy: { createdAt: 'asc' },
        },
        edges: {
          orderBy: { priority: 'desc' },
        },
        createdBy: { select: { name: true, username: true } },
        publishedBy: { select: { name: true, username: true } },
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (user && this.isDeptAdminOnly(user.roles ?? [])) {
      // Dept admin can view workflows for their department; global (null) workflows are visible to all admins
      if (workflow.departmentId && workflow.departmentId !== user.departmentId) {
        throw new ForbiddenException(
          'You can only view workflows that belong to your department',
        );
      }
    }

    return workflow;
  }

  // Update workflow
  async updateWorkflow(
    workflowId: string,
    userId: string,
    userRoles: string[],
    data: Partial<{
      name: string;
      description: string;
      fileType: string;
      priorityCategory: string;
      isActive: boolean;
    }>,
    userDepartmentId?: string | null,
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can update workflows');
    }

    await this.assertDeptAdminCanAccessWorkflow(
      workflowId,
      userDepartmentId,
      userRoles,
    );

    return this.prisma.workflow.update({
      where: { id: workflowId },
      data,
    });
  }

  // Publish workflow (make it active)
  async publishWorkflow(
    workflowId: string,
    userId: string,
    userRoles: string[],
    userDepartmentId?: string | null,
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can publish workflows');
    }

    await this.assertDeptAdminCanAccessWorkflow(
      workflowId,
      userDepartmentId,
      userRoles,
    );

    // Validate workflow has required nodes
    const workflow = await this.getWorkflowById(workflowId, {
      departmentId: userDepartmentId ?? undefined,
      roles: userRoles,
    });
    const hasStart = workflow.nodes.some((n) => n.nodeType === 'start');
    const hasEnd = workflow.nodes.some((n) => n.nodeType === 'end');

    if (!hasStart || !hasEnd) {
      throw new Error(
        'Workflow must have at least one start node and one end node',
      );
    }

    // Increment version
    const newVersion = workflow.version + 1;

    return this.prisma.workflow.update({
      where: { id: workflowId },
      data: {
        isPublished: true,
        isActive: true,
        isDraft: false,
        publishedById: userId,
        publishedAt: new Date(),
        version: newVersion,
      },
    });
  }

  // Delete workflow
  async deleteWorkflow(
    workflowId: string,
    userId: string,
    userRoles: string[],
    userDepartmentId?: string | null,
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can delete workflows');
    }

    await this.assertDeptAdminCanAccessWorkflow(
      workflowId,
      userDepartmentId,
      userRoles,
    );

    // Check if workflow has active executions
    const activeExecutions = await this.prisma.workflowExecution.count({
      where: { workflowId, status: 'running' },
    });

    if (activeExecutions > 0) {
      throw new ForbiddenException(
        'Cannot delete workflow with active executions',
      );
    }

    return this.prisma.workflow.delete({
      where: { id: workflowId },
    });
  }

  // ============================================
  // NODE MANAGEMENT
  // ============================================

  // Add node to workflow
  async addNode(
    workflowId: string,
    userId: string,
    userRoles: string[],
    data: {
      nodeId: string;
      nodeType: string;
      label: string;
      description?: string;
      assigneeType?: string;
      assigneeValue?: string;
      timeLimit?: number;
      timeLimitType?: string;
      availableActions?: string[];
      conditions?: any[];
      positionX?: number;
      positionY?: number;
      config?: any;
    },
    userDepartmentId?: string | null,
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can modify workflows');
    }
    await this.assertDeptAdminCanAccessWorkflow(
      workflowId,
      userDepartmentId,
      userRoles,
    );

    return this.prisma.workflowNode.create({
      data: {
        workflowId,
        nodeId: data.nodeId,
        nodeType: data.nodeType,
        label: data.label,
        description: data.description,
        assigneeType: data.assigneeType,
        assigneeValue: data.assigneeValue,
        timeLimit: data.timeLimit,
        timeLimitType: data.timeLimitType,
        availableActions: data.availableActions || [],
        conditions: data.conditions || [],
        positionX: data.positionX,
        positionY: data.positionY,
        config: data.config || {},
      },
    });
  }

  // Update node
  async updateNode(
    nodeId: string,
    userId: string,
    userRoles: string[],
    data: Partial<{
      label: string;
      description: string;
      assigneeType: string;
      assigneeValue: string;
      timeLimit: number;
      availableActions: string[];
      conditions: any[];
      positionX: number;
      positionY: number;
      config: any;
    }>,
    userDepartmentId?: string | null,
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can modify workflows');
    }
    const node = await this.prisma.workflowNode.findUnique({
      where: { id: nodeId },
      select: { workflowId: true },
    });
    if (node) {
      await this.assertDeptAdminCanAccessWorkflow(
        node.workflowId,
        userDepartmentId,
        userRoles,
      );
    }

    return this.prisma.workflowNode.update({
      where: { id: nodeId },
      data,
    });
  }

  // Delete node
  async deleteNode(
    nodeId: string,
    userId: string,
    userRoles: string[],
    userDepartmentId?: string | null,
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can modify workflows');
    }
    const node = await this.prisma.workflowNode.findUnique({
      where: { id: nodeId },
      select: { workflowId: true },
    });
    if (node) {
      await this.assertDeptAdminCanAccessWorkflow(
        node.workflowId,
        userDepartmentId,
        userRoles,
      );
    }

    return this.prisma.workflowNode.delete({
      where: { id: nodeId },
    });
  }

  // ============================================
  // EDGE MANAGEMENT
  // ============================================

  // Add edge to workflow
  async addEdge(
    workflowId: string,
    userId: string,
    userRoles: string[],
    data: {
      sourceNodeId: string;
      targetNodeId: string;
      label?: string;
      condition?: any;
      priority?: number;
      style?: any;
    },
    userDepartmentId?: string | null,
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can modify workflows');
    }
    await this.assertDeptAdminCanAccessWorkflow(
      workflowId,
      userDepartmentId,
      userRoles,
    );

    return this.prisma.workflowEdge.create({
      data: {
        workflowId,
        sourceNodeId: data.sourceNodeId,
        targetNodeId: data.targetNodeId,
        label: data.label,
        condition: data.condition || {},
        priority: data.priority || 0,
        style: data.style || {},
      },
    });
  }

  // Update edge
  async updateEdge(
    edgeId: string,
    userId: string,
    userRoles: string[],
    data: Partial<{
      label: string;
      condition: any;
      priority: number;
      style: any;
    }>,
    userDepartmentId?: string | null,
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can modify workflows');
    }
    const edge = await this.prisma.workflowEdge.findUnique({
      where: { id: edgeId },
      select: { workflowId: true },
    });
    if (edge) {
      await this.assertDeptAdminCanAccessWorkflow(
        edge.workflowId,
        userDepartmentId,
        userRoles,
      );
    }

    return this.prisma.workflowEdge.update({
      where: { id: edgeId },
      data,
    });
  }

  // Delete edge
  async deleteEdge(
    edgeId: string,
    userId: string,
    userRoles: string[],
    userDepartmentId?: string | null,
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can modify workflows');
    }
    const edge = await this.prisma.workflowEdge.findUnique({
      where: { id: edgeId },
      select: { workflowId: true },
    });
    if (edge) {
      await this.assertDeptAdminCanAccessWorkflow(
        edge.workflowId,
        userDepartmentId,
        userRoles,
      );
    }

    return this.prisma.workflowEdge.delete({
      where: { id: edgeId },
    });
  }

  // ============================================
  // WORKFLOW TEMPLATES
  // ============================================

  // Create workflow from template
  async createFromTemplate(
    templateId: string,
    userId: string,
    userRoles: string[],
    data: {
      name: string;
      code: string;
      departmentId?: string;
    },
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can create workflows');
    }

    const template = await this.prisma.workflowTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const templateData = template.templateData as any;

    // Create workflow
    const workflow = await this.prisma.workflow.create({
      data: {
        name: data.name,
        code: data.code,
        description: templateData.description || template.description,
        departmentId: data.departmentId,
        fileType: templateData.fileType,
        priorityCategory: templateData.priorityCategory,
        createdById: userId,
        isDraft: true,
      },
    });

    // Create nodes
    const nodeMap = new Map<string, string>(); // old ID -> new ID
    for (const nodeData of templateData.nodes || []) {
      const node = await this.prisma.workflowNode.create({
        data: {
          workflowId: workflow.id,
          nodeId: nodeData.nodeId,
          nodeType: nodeData.nodeType,
          label: nodeData.label,
          description: nodeData.description,
          assigneeType: nodeData.assigneeType,
          assigneeValue: nodeData.assigneeValue,
          timeLimit: nodeData.timeLimit,
          timeLimitType: nodeData.timeLimitType,
          availableActions: nodeData.availableActions || [],
          conditions: nodeData.conditions || [],
          positionX: nodeData.positionX,
          positionY: nodeData.positionY,
          config: nodeData.config || {},
        },
      });
      nodeMap.set(nodeData.id, node.id);
    }

    // Create edges
    for (const edgeData of templateData.edges || []) {
      const sourceId = nodeMap.get(edgeData.sourceNodeId);
      const targetId = nodeMap.get(edgeData.targetNodeId);

      if (sourceId && targetId) {
        await this.prisma.workflowEdge.create({
          data: {
            workflowId: workflow.id,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            label: edgeData.label,
            condition: edgeData.condition || {},
            priority: edgeData.priority || 0,
            style: edgeData.style || {},
          },
        });
      }
    }

    // Update template usage count
    await this.prisma.workflowTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 },
      },
    });

    return workflow;
  }

  // Get workflow templates
  async getTemplates(category?: string) {
    const where: any = { isPublic: true };
    if (category) {
      where.category = category;
    }

    return this.prisma.workflowTemplate.findMany({
      where,
      orderBy: { usageCount: 'desc' },
    });
  }

  // Export workflow as template
  async exportAsTemplate(
    workflowId: string,
    userId: string,
    userRoles: string[],
    data: {
      name: string;
      code: string;
      description?: string;
      category: string;
      isPublic?: boolean;
    },
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException(
        'Only super administrators can create templates',
      );
    }

    const workflow = await this.getWorkflowById(workflowId);

    // Build template data
    const templateData = {
      description: workflow.description,
      fileType: workflow.fileType,
      priorityCategory: workflow.priorityCategory,
      nodes: workflow.nodes.map((n) => ({
        id: n.id,
        nodeId: n.nodeId,
        nodeType: n.nodeType,
        label: n.label,
        description: n.description,
        assigneeType: n.assigneeType,
        assigneeValue: n.assigneeValue,
        timeLimit: n.timeLimit,
        timeLimitType: n.timeLimitType,
        availableActions: n.availableActions,
        conditions: n.conditions,
        positionX: n.positionX,
        positionY: n.positionY,
        config: n.config,
      })),
      edges: workflow.edges.map((e) => ({
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        label: e.label,
        condition: e.condition,
        priority: e.priority,
        style: e.style,
      })),
    };

    return this.prisma.workflowTemplate.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        category: data.category,
        templateData,
        isPublic: data.isPublic ?? true,
      },
    });
  }

  // Validate workflow
  async validateWorkflow(workflowId: string) {
    const workflow = await this.getWorkflowById(workflowId);

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for start node
    const startNodes = workflow.nodes.filter((n) => n.nodeType === 'start');
    if (startNodes.length === 0) {
      errors.push('Workflow must have at least one start node');
    } else if (startNodes.length > 1) {
      warnings.push('Workflow has multiple start nodes');
    }

    // Check for end node
    const endNodes = workflow.nodes.filter((n) => n.nodeType === 'end');
    if (endNodes.length === 0) {
      errors.push('Workflow must have at least one end node');
    }

    // Check for orphaned nodes (no incoming or outgoing edges)
    for (const node of workflow.nodes) {
      if (node.nodeType === 'start') continue; // Start nodes don't need incoming edges
      if (node.nodeType === 'end') continue; // End nodes don't need outgoing edges

      const hasIncoming = workflow.edges.some(
        (e) => e.targetNodeId === node.id,
      );
      const hasOutgoing = workflow.edges.some(
        (e) => e.sourceNodeId === node.id,
      );

      if (!hasIncoming) {
        warnings.push(`Node "${node.label}" has no incoming connections`);
      }
      if (!hasOutgoing) {
        warnings.push(`Node "${node.label}" has no outgoing connections`);
      }
    }

    // Check for unreachable nodes
    const reachableNodes = new Set<string>();
    const startNode = startNodes[0];
    if (startNode) {
      this.findReachableNodes(startNode.id, workflow.edges, reachableNodes);
    }

    for (const node of workflow.nodes) {
      if (!reachableNodes.has(node.id) && node.nodeType !== 'start') {
        warnings.push(`Node "${node.label}" is unreachable from start`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private findReachableNodes(
    nodeId: string,
    edges: any[],
    reachable: Set<string>,
  ) {
    reachable.add(nodeId);
    const outgoing = edges.filter((e) => e.sourceNodeId === nodeId);
    for (const edge of outgoing) {
      if (!reachable.has(edge.targetNodeId)) {
        this.findReachableNodes(edge.targetNodeId, edges, reachable);
      }
    }
  }

  // Clone workflow
  async cloneWorkflow(
    workflowId: string,
    userId: string,
    userRoles: string[],
    newCode: string,
    newName: string,
    userDepartmentId?: string | null,
  ) {
    if (!userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN') && !userRoles.includes('DEPT_ADMIN')) {
      throw new ForbiddenException('Only administrators can clone workflows');
    }
    await this.assertDeptAdminCanAccessWorkflow(
      workflowId,
      userDepartmentId,
      userRoles,
    );

    const original = await this.getWorkflowById(workflowId, {
      departmentId: userDepartmentId ?? undefined,
      roles: userRoles,
    });

    // Dept Admin clones always belong to their department
    const cloneDepartmentId = this.isDeptAdminOnly(userRoles) && userDepartmentId
      ? userDepartmentId
      : original.departmentId;

    // Create new workflow
    const newWorkflow = await this.prisma.workflow.create({
      data: {
        name: newName,
        code: newCode,
        description: original.description,
        departmentId: cloneDepartmentId,
        fileType: original.fileType,
        priorityCategory: original.priorityCategory,
        createdById: userId,
        isDraft: true,
        isActive: false,
      },
    });

    // Clone nodes
    const nodeMap = new Map<string, string>();
    for (const node of original.nodes) {
      const newNode = await this.prisma.workflowNode.create({
        data: {
          workflowId: newWorkflow.id,
          nodeId: node.nodeId,
          nodeType: node.nodeType,
          label: node.label,
          description: node.description,
          assigneeType: node.assigneeType,
          assigneeValue: node.assigneeValue,
          timeLimit: node.timeLimit,
          timeLimitType: node.timeLimitType,
          availableActions: node.availableActions ?? undefined,
          conditions: node.conditions ?? undefined,
          positionX: node.positionX,
          positionY: node.positionY,
          config: node.config ?? undefined,
        },
      });
      nodeMap.set(node.id, newNode.id);
    }

    // Clone edges
    for (const edge of original.edges) {
      const sourceId = nodeMap.get(edge.sourceNodeId);
      const targetId = nodeMap.get(edge.targetNodeId);

      if (sourceId && targetId) {
        await this.prisma.workflowEdge.create({
          data: {
            workflowId: newWorkflow.id,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            label: edge.label,
            condition: edge.condition ?? undefined,
            priority: edge.priority,
            style: edge.style ?? undefined,
          },
        });
      }
    }

    return newWorkflow;
  }
}
