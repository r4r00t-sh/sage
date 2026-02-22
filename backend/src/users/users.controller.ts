import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
} from '@nestjs/common';
import { Readable } from 'stream';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { hasAnyRole, hasRole } from '../auth/auth.helpers';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async getAllUsers(
    @Request() req,
    @Query('departmentId') departmentId?: string,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    // Only admins can list users
    if (!hasAnyRole(req.user, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
      throw new ForbiddenException('Not authorized');
    }

    // DEPT_ADMIN can only see their department users
    const filterDeptId =
      hasRole(req.user, 'DEPT_ADMIN') ? req.user.departmentId : departmentId;

    return this.usersService.getAllUsers({
      departmentId: filterDeptId,
      role,
      search,
    });
  }

  @Get(':id/avatar')
  async getAvatar(@Param('id') id: string, @Request() req) {
    if (id !== req.user.id && !hasAnyRole(req.user, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
      throw new ForbiddenException('Not authorized');
    }
    const result = await this.usersService.getAvatarStream(id);
    if (!result) {
      throw new NotFoundException('Avatar not found');
    }
    const stream = Readable.from(result.stream as any);
    return new StreamableFile(stream, {
      type: result.contentType,
      disposition: 'inline',
    });
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Param('id') id: string,
    @Request() req,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (id !== req.user.id) {
      throw new ForbiddenException('Can only upload your own avatar');
    }
    if (!file?.buffer) {
      throw new BadRequestException('No file uploaded');
    }
    const result = await this.usersService.uploadAvatar(id, {
      buffer: file.buffer,
      mimetype: file.mimetype,
    });
    return result;
  }

  @Get(':id')
  async getUser(@Param('id') id: string, @Request() req) {
    // Users can view themselves, admins can view others
    if (
      id !== req.user.id &&
      !hasAnyRole(req.user, ['SUPER_ADMIN', 'DEPT_ADMIN'])
    ) {
      throw new ForbiddenException('Not authorized');
    }
    return this.usersService.getUserById(id);
  }

  @Get(':id/audit-logs')
  async getAuditLogs(
    @Param('id') id: string,
    @Request() req,
    @Query('limit') limit?: string,
  ) {
    if (!hasAnyRole(req.user, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
      throw new ForbiddenException('Not authorized');
    }
    if (hasRole(req.user, 'DEPT_ADMIN')) {
      const targetUser = await this.usersService.getUserById(id);
      if (targetUser.department?.id !== req.user.departmentId) {
        throw new ForbiddenException('Can only view users in your department');
      }
    }
    return this.usersService.getAuditLogs(
      id,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get(':id/activity')
  async getActivity(
    @Param('id') id: string,
    @Request() req,
    @Query('limit') limit?: string,
  ) {
    if (!hasAnyRole(req.user, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
      throw new ForbiddenException('Not authorized');
    }
    if (hasRole(req.user, 'DEPT_ADMIN')) {
      const targetUser = await this.usersService.getUserById(id);
      if (targetUser.department?.id !== req.user.departmentId) {
        throw new ForbiddenException('Can only view users in your department');
      }
    }
    return this.usersService.getActivity(
      id,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get(':id/presence')
  async getPresence(@Param('id') id: string, @Request() req) {
    if (!hasAnyRole(req.user, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
      throw new ForbiddenException('Not authorized');
    }
    if (hasRole(req.user, 'DEPT_ADMIN')) {
      const targetUser = await this.usersService.getUserById(id);
      if (targetUser.department?.id !== req.user.departmentId) {
        throw new ForbiddenException('Can only view users in your department');
      }
    }
    return this.usersService.getPresence(id);
  }

  @Post()
  async createUser(
    @Request() req,
    @Body()
    body: {
      username: string;
      password: string;
      name: string;
      email?: string;
      designation?: string;
      staffId?: string;
      phone?: string;
      roles: string[];
      departmentId?: string;
      divisionId?: string;
    },
  ) {
    // Only admins can create users
    if (!hasAnyRole(req.user, ['SUPER_ADMIN', 'DEPT_ADMIN'])) {
      throw new ForbiddenException('Not authorized');
    }

    // DEPT_ADMIN can only create users in their department
    if (
      hasRole(req.user, 'DEPT_ADMIN') &&
      body.departmentId !== req.user.departmentId
    ) {
      throw new ForbiddenException('Can only create users in your department');
    }

    const roles = body.roles?.length ? body.roles : ['USER'];
    const createdBySuperAdmin = hasRole(req.user, 'SUPER_ADMIN');
    return this.usersService.createUser({
      ...body,
      roles,
      createdBySuperAdmin,
    });
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Request() req,
    @Body()
    body: {
      name?: string;
      email?: string;
      designation?: string;
      staffId?: string;
      phone?: string;
      roles?: string[];
      departmentId?: string;
      divisionId?: string;
      isActive?: boolean;
    },
  ) {
    // Only admins can update users (except self profile updates)
    if (
      id !== req.user.id &&
      !hasAnyRole(req.user, ['SUPER_ADMIN', 'DEPT_ADMIN'])
    ) {
      throw new ForbiddenException('Not authorized');
    }

    // Regular users can only update name/email for themselves
    if (
      id === req.user.id &&
      !hasAnyRole(req.user, ['SUPER_ADMIN', 'DEPT_ADMIN'])
    ) {
      return this.usersService.updateUser(id, {
        name: body.name,
        email: body.email,
      });
    }

    return this.usersService.updateUser(id, body);
  }

  @Put(':id/password')
  async updatePassword(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { currentPassword?: string; newPassword: string },
  ) {
    // Users can change their own password, admins can reset others
    if (id !== req.user.id && !hasRole(req.user, 'SUPER_ADMIN')) {
      throw new ForbiddenException('Not authorized');
    }

    // If changing own password, require current password
    if (id === req.user.id && !hasRole(req.user, 'SUPER_ADMIN')) {
      return this.usersService.changePassword(
        id,
        body.currentPassword!,
        body.newPassword,
      );
    }

    // Admin reset (no current password needed)
    return this.usersService.resetPassword(id, body.newPassword);
  }

  @Put(':id/approve-profile')
  async approveProfile(@Param('id') id: string, @Request() req) {
    if (!hasRole(req.user, 'SUPER_ADMIN')) {
      throw new ForbiddenException('Only Super Admin can approve profiles');
    }
    return this.usersService.approveProfile(id, req.user.id);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string, @Request() req) {
    // Only SUPER_ADMIN can delete users
    if (!hasRole(req.user, 'SUPER_ADMIN')) {
      throw new ForbiddenException('Not authorized');
    }
    return this.usersService.deactivateUser(id);
  }
}
