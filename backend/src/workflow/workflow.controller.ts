import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WorkflowService } from './workflow.service';
import { WorkflowEngineService } from './workflow-engine.service';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(
    private workflowService: WorkflowService,
    private workflowEngine: WorkflowEngineService,
  ) {}

  // ============================================
  // WORKFLOW CRUD
  // ============================================

  @Post()
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async createWorkflow(
    @Request() req,
    @Body()
    body: {
      name: string;
      code: string;
      description?: string;
      departmentId?: string;
      fileType?: string;
      priorityCategory?: string;
    },
  ) {
    return this.workflowService.createWorkflow(
      req.user.id,
      req.user.roles ?? [],
      body,
      req.user.departmentId,
    );
  }

  @Get()
  async getWorkflows(
    @Request() req,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const departmentId =
      (req.user.roles ?? []).includes('DEPT_ADMIN') && !(req.user.roles ?? []).includes('SUPER_ADMIN') && !(req.user.roles ?? []).includes('DEVELOPER')
        ? req.user.departmentId
        : undefined;
    return this.workflowService.getWorkflows(
      departmentId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  async getWorkflow(@Param('id') id: string, @Request() req) {
    return this.workflowService.getWorkflowById(id, {
      departmentId: req.user?.departmentId,
      roles: req.user?.roles ?? [],
    });
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async updateWorkflow(
    @Param('id') id: string,
    @Request() req,
    @Body()
    body: {
      name?: string;
      description?: string;
      fileType?: string;
      priorityCategory?: string;
      isActive?: boolean;
    },
  ) {
    return this.workflowService.updateWorkflow(
      id,
      req.user.id,
      req.user.roles ?? [],
      body,
      req.user.departmentId,
    );
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async publishWorkflow(@Param('id') id: string, @Request() req) {
    return this.workflowService.publishWorkflow(
      id,
      req.user.id,
      req.user.roles ?? [],
      req.user.departmentId,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async deleteWorkflow(@Param('id') id: string, @Request() req) {
    return this.workflowService.deleteWorkflow(
      id,
      req.user.id,
      req.user.roles ?? [],
      req.user.departmentId,
    );
  }

  @Post(':id/clone')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async cloneWorkflow(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { code: string; name: string },
  ) {
    return this.workflowService.cloneWorkflow(
      id,
      req.user.id,
      req.user.roles ?? [],
      body.code,
      body.name,
      req.user.departmentId,
    );
  }

  @Get(':id/validate')
  async validateWorkflow(@Param('id') id: string) {
    return this.workflowService.validateWorkflow(id);
  }

  // ============================================
  // NODE MANAGEMENT
  // ============================================

  @Post(':id/nodes')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async addNode(
    @Param('id') workflowId: string,
    @Request() req,
    @Body()
    body: {
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
  ) {
    return this.workflowService.addNode(
      workflowId,
      req.user.id,
      req.user.roles ?? [],
      body,
      req.user.departmentId,
    );
  }

  @Patch('nodes/:nodeId')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async updateNode(
    @Param('nodeId') nodeId: string,
    @Request() req,
    @Body() body: any,
  ) {
    return this.workflowService.updateNode(
      nodeId,
      req.user.id,
      req.user.roles ?? [],
      body,
      req.user.departmentId,
    );
  }

  @Delete('nodes/:nodeId')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async deleteNode(@Param('nodeId') nodeId: string, @Request() req) {
    return this.workflowService.deleteNode(
      nodeId,
      req.user.id,
      req.user.roles ?? [],
      req.user.departmentId,
    );
  }

  // ============================================
  // EDGE MANAGEMENT
  // ============================================

  @Post(':id/edges')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async addEdge(
    @Param('id') workflowId: string,
    @Request() req,
    @Body()
    body: {
      sourceNodeId: string;
      targetNodeId: string;
      label?: string;
      condition?: any;
      priority?: number;
      style?: any;
    },
  ) {
    return this.workflowService.addEdge(
      workflowId,
      req.user.id,
      req.user.roles ?? [],
      body,
      req.user.departmentId,
    );
  }

  @Patch('edges/:edgeId')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async updateEdge(
    @Param('edgeId') edgeId: string,
    @Request() req,
    @Body() body: any,
  ) {
    return this.workflowService.updateEdge(
      edgeId,
      req.user.id,
      req.user.roles ?? [],
      body,
      req.user.departmentId,
    );
  }

  @Delete('edges/:edgeId')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async deleteEdge(@Param('edgeId') edgeId: string, @Request() req) {
    return this.workflowService.deleteEdge(
      edgeId,
      req.user.id,
      req.user.roles ?? [],
      req.user.departmentId,
    );
  }

  // ============================================
  // WORKFLOW EXECUTION
  // ============================================

  @Post(':id/start')
  async startWorkflow(
    @Param('id') workflowId: string,
    @Body() body: { fileId: string; variables?: any },
  ) {
    return this.workflowEngine.startWorkflow(
      workflowId,
      body.fileId,
      body.variables,
    );
  }

  @Post('executions/:id/execute')
  async executeStep(
    @Param('id') executionId: string,
    @Request() req,
    @Body()
    body: {
      action: string;
      remarks?: string;
      targetNodeId?: string;
      output?: any;
    },
  ) {
    return this.workflowEngine.executeStep(
      executionId,
      req.user.id,
      body.action,
      {
        remarks: body.remarks,
        targetNodeId: body.targetNodeId,
        output: body.output,
      },
    );
  }

  @Get('executions/file/:fileId')
  async getExecutionForFile(@Param('fileId') fileId: string) {
    return this.workflowEngine.getExecutionForFile(fileId);
  }

  @Get('executions/:id/actions')
  async getAvailableActions(@Param('id') executionId: string) {
    return this.workflowEngine.getAvailableActions(executionId);
  }

  @Post('executions/:id/pause')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async pauseWorkflow(@Param('id') executionId: string, @Request() req) {
    return this.workflowEngine.pauseWorkflow(executionId, req.user.id);
  }

  @Post('executions/:id/resume')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async resumeWorkflow(@Param('id') executionId: string, @Request() req) {
    return this.workflowEngine.resumeWorkflow(executionId, req.user.id);
  }

  // ============================================
  // TEMPLATES
  // ============================================

  @Get('templates/list')
  async getTemplates(@Query('category') category?: string) {
    return this.workflowService.getTemplates(category);
  }

  @Post('templates/:id/use')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async createFromTemplate(
    @Param('id') templateId: string,
    @Request() req,
    @Body() body: { name: string; code: string; departmentId?: string },
  ) {
    return this.workflowService.createFromTemplate(
      templateId,
      req.user.id,
      req.user.roles ?? [],
      body,
    );
  }

  @Post(':id/export-template')
  @UseGuards(RolesGuard)
  @Roles('DEVELOPER' as any, 'TECH_PANEL' as any)
  async exportAsTemplate(
    @Param('id') workflowId: string,
    @Request() req,
    @Body()
    body: {
      name: string;
      code: string;
      description?: string;
      category: string;
      isPublic?: boolean;
    },
  ) {
    return this.workflowService.exportAsTemplate(
      workflowId,
      req.user.id,
      req.user.roles ?? [],
      body,
    );
  }
}
