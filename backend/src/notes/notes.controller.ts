import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('files/:fileId/notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async createNote(
    @Param('fileId') fileId: string,
    @Request() req,
    @Body() body: { content: string },
  ) {
    // Permission: INWARD_DESK and DISPATCHER cannot add notes, unless user is from host (originating) department
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { roles: true, departmentId: true },
    });

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { currentProcessCycleId: true, originDepartmentId: true },
    });

    const isHostDepartment =
      file?.originDepartmentId &&
      user?.departmentId &&
      file.originDepartmentId === user.departmentId;

    if (!isHostDepartment && (user?.roles?.includes('INWARD_DESK') || user?.roles?.includes('DISPATCHER'))) {
      if (!user?.roles?.includes('DEPT_ADMIN') && !user?.roles?.includes('SUPER_ADMIN')) {
        throw new ForbiddenException('Inward Desk and Dispatcher users cannot add notes to files.');
      }
    }

    return this.prisma.note.create({
      data: {
        fileId,
        userId: req.user.id,
        content: body.content,
        departmentId: user?.departmentId ?? undefined,
        processCycleId: file?.currentProcessCycleId ?? undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }
}
