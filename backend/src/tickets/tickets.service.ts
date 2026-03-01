import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus, TicketPriority } from '@prisma/client';

const SUPPORT_ROLES = ['DEVELOPER', 'SUPPORT', 'SUPER_ADMIN'];

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  private async isSupport(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    return user?.roles?.some((r) => SUPPORT_ROLES.includes(r)) ?? false;
  }

  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const last = await this.prisma.ticket.findFirst({
      where: { ticketNumber: { startsWith: `TKT-${year}-` } },
      orderBy: { createdAt: 'desc' },
      select: { ticketNumber: true },
    });
    const nextNum = last
      ? parseInt(last.ticketNumber.split('-')[2] || '0', 10) + 1
      : 1;
    return `TKT-${year}-${String(nextNum).padStart(5, '0')}`;
  }

  async create(
    userId: string,
    data: {
      subject: string;
      description: string;
      priority?: TicketPriority;
      category?: string;
      fileId?: string;
    },
  ) {
    const ticketNumber = await this.generateTicketNumber();
    return this.prisma.ticket.create({
      data: {
        ticketNumber,
        subject: data.subject,
        description: data.description,
        priority: data.priority ?? 'NORMAL',
        category: data.category ?? null,
        fileId: data.fileId ?? null,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, username: true, email: true } },
      },
    });
  }

  async findAll(userId: string, options: { status?: TicketStatus; mine?: boolean; supportView?: boolean }) {
    const isSupport = await this.isSupport(userId);
    const supportView = options.supportView && isSupport;

    if (supportView) {
      const where: Record<string, unknown> = {};
      if (options.status) where.status = options.status;
      return this.prisma.ticket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, username: true, email: true } },
          assignedTo: { select: { id: true, name: true, username: true } },
          _count: { select: { replies: true } },
        },
      });
    }

    const where: Record<string, unknown> = { createdById: userId };
    if (options.status) where.status = options.status;
    return this.prisma.ticket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, username: true, email: true } },
        assignedTo: { select: { id: true, name: true, username: true } },
        _count: { select: { replies: true } },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, username: true, email: true } },
        assignedTo: { select: { id: true, name: true, username: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            repliedBy: { select: { id: true, name: true, username: true } },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const isSupport = await this.isSupport(userId);
    if (ticket.createdById !== userId && !isSupport) throw new ForbiddenException('Not allowed to view this ticket');
    return ticket;
  }

  async updateStatus(id: string, userId: string, status: TicketStatus) {
    const isSupport = await this.isSupport(userId);
    if (!isSupport) throw new ForbiddenException('Only support can change ticket status');
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.ticket.update({
      where: { id },
      data: { status },
      include: {
        createdBy: { select: { id: true, name: true, username: true, email: true } },
        assignedTo: { select: { id: true, name: true, username: true } },
      },
    });
  }

  async assign(id: string, userId: string, assignedToId: string | null) {
    const isSupport = await this.isSupport(userId);
    if (!isSupport) throw new ForbiddenException('Only support can assign tickets');
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.ticket.update({
      where: { id },
      data: { assignedToId },
      include: {
        createdBy: { select: { id: true, name: true, username: true, email: true } },
        assignedTo: { select: { id: true, name: true, username: true } },
      },
    });
  }

  async addReply(ticketId: string, userId: string, content: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const isSupport = await this.isSupport(userId);
    if (ticket.createdById !== userId && !isSupport) throw new ForbiddenException('Not allowed to reply to this ticket');

    const reply = await this.prisma.ticketReply.create({
      data: {
        ticketId,
        content,
        isSupportReply: isSupport,
        repliedById: userId,
      },
      include: {
        repliedBy: { select: { id: true, name: true, username: true } },
      },
    });

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    return reply;
  }
}
