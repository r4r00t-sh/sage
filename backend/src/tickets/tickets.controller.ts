import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TicketsService } from './tickets.service';
import { TicketStatus } from '@prisma/client';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Post()
  create(
    @Request() req: { user: { id: string } },
    @Body() body: { subject: string; description: string; priority?: string; category?: string; fileId?: string },
  ) {
    return this.ticketsService.create(req.user.id, {
      subject: body.subject,
      description: body.description,
      priority: body.priority as any,
      category: body.category,
      fileId: body.fileId,
    });
  }

  @Get()
  findAll(
    @Request() req: { user: { id: string } },
    @Query('status') status?: string,
    @Query('supportView') supportView?: string,
  ) {
    return this.ticketsService.findAll(req.user.id, {
      status: status as TicketStatus | undefined,
      supportView: supportView === 'true',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.ticketsService.findOne(id, req.user.id);
  }

  @Post(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() body: { status: string },
  ) {
    return this.ticketsService.updateStatus(id, req.user.id, body.status as TicketStatus);
  }

  @Post(':id/assign')
  assign(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() body: { assignedToId: string | null },
  ) {
    return this.ticketsService.assign(id, req.user.id, body.assignedToId ?? null);
  }

  @Post(':id/replies')
  addReply(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() body: { content: string },
  ) {
    return this.ticketsService.addReply(id, req.user.id, body.content);
  }
}
