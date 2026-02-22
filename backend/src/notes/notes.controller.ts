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
    // Permission check: INWARD_DESK and DISPATCHER cannot add notes
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { roles: true },
    });

    if (user?.roles?.includes('INWARD_DESK') || user?.roles?.includes('DISPATCHER')) {
      if (!user?.roles?.includes('DEPT_ADMIN') && !user?.roles?.includes('SUPER_ADMIN')) {
        throw new ForbiddenException('Inward Desk and Dispatcher users cannot add notes to files.');
      }
    }

    return this.prisma.note.create({
      data: {
        fileId,
        userId: req.user.id,
        content: body.content,
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
