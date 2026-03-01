import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { ChatGateway } from './chat.gateway';

const GROUP_CREATOR_ROLES: UserRole[] = [
  'DEVELOPER',
  'SUPER_ADMIN',
  'DEPT_ADMIN',
  'CHAT_MANAGER',
];

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway,
  ) {}

  canCreateOrManageGroups(roles: string[]): boolean {
    return GROUP_CREATOR_ROLES.some((r) => roles.includes(r));
  }

  /** Get or create a DM conversation between two users */
  async getOrCreateDm(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException('Cannot create DM with yourself');
    }
    const allDms = await this.prisma.chatConversation.findMany({
      where: { type: 'DM' },
      include: { members: true },
    });
    const dm = allDms.find(
      (c) =>
        c.members.length === 2 &&
        c.members.some((m) => m.userId === userId) &&
        c.members.some((m) => m.userId === otherUserId),
    );
    if (dm) {
      return this.prisma.chatConversation.findUnique({
        where: { id: dm.id },
        include: conversationInclude(),
      });
    }
    const created = await this.prisma.chatConversation.create({
      data: {
        type: 'DM',
        createdById: userId,
        members: {
          create: [
            { userId, role: 'member' },
            { userId: otherUserId, role: 'member' },
          ],
        },
      },
      include: conversationInclude(),
    });
    return created;
  }

  /** Create a group (admin or chat manager only) */
  async createGroup(
    createdById: string,
    userRoles: string[],
    data: {
      name: string;
      description?: string;
      departmentId?: string;
      memberIds?: string[];
    },
  ) {
    if (!this.canCreateOrManageGroups(userRoles)) {
      throw new ForbiddenException(
        'Only admins or chat managers can create groups',
      );
    }
    const memberIds = [...new Set([createdById, ...(data.memberIds || [])])];
    const conv = await this.prisma.chatConversation.create({
      data: {
        type: 'GROUP',
        name: data.name,
        description: data.description,
        departmentId: data.departmentId,
        createdById,
        lastMessageAt: null,
        members: {
          create: memberIds.map((userId, i) => ({
            userId,
            role: userId === createdById ? 'admin' : 'member',
          })),
        },
      },
      include: conversationInclude(),
    });
    return conv;
  }

  /** Add members to a group (admin or chat manager only) */
  async addMembers(
    conversationId: string,
    userId: string,
    userRoles: string[],
    memberIds: string[],
  ) {
    if (!this.canCreateOrManageGroups(userRoles)) {
      throw new ForbiddenException(
        'Only admins or chat managers can add members',
      );
    }
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { members: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.type !== 'GROUP') {
      throw new BadRequestException('Can only add members to groups');
    }
    const existingIds = new Set(conv.members.map((m) => m.userId));
    const toAdd = memberIds.filter((id) => !existingIds.has(id));
    if (toAdd.length === 0) {
      return this.getConversation(conversationId, userId);
    }
    await this.prisma.chatConversationMember.createMany({
      data: toAdd.map((uid) => ({
        conversationId,
        userId: uid,
        role: 'member',
      })),
    });
    return this.getConversation(conversationId, userId);
  }

  /** Remove a member from a group (admin/chat manager or self) */
  async removeMember(
    conversationId: string,
    userId: string,
    userRoles: string[],
    targetUserId: string,
  ) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { members: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const isAdminOrManager = this.canCreateOrManageGroups(userRoles);
    const selfMember = conv.members.find((m) => m.userId === userId);
    if (!selfMember)
      throw new ForbiddenException('You are not in this conversation');
    const targetMember = conv.members.find((m) => m.userId === targetUserId);
    if (!targetMember)
      throw new NotFoundException('User is not in this conversation');
    if (
      targetUserId !== userId &&
      !isAdminOrManager &&
      selfMember.role !== 'admin'
    ) {
      throw new ForbiddenException('Only admins can remove other members');
    }
    await this.prisma.chatConversationMember.delete({
      where: {
        conversationId_userId: { conversationId, userId: targetUserId },
      },
    });
    return { success: true };
  }

  /** List conversations for a user */
  async listConversations(userId: string) {
    const memberships = await this.prisma.chatConversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: conversationInclude(),
        },
      },
      orderBy: {
        conversation: { lastMessageAt: 'desc' },
      },
    });
    const list = memberships.map((m) => ({
      ...m.conversation,
      myRole: m.role,
      lastReadAt: m.lastReadAt,
    }));
    return list;
  }

  /** Get one conversation (must be member) */
  async getConversation(conversationId: string, userId: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude(),
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const member = conv.members.find((m) => m.userId === userId);
    if (!member)
      throw new ForbiddenException('You are not in this conversation');
    return { ...conv, myRole: member.role, lastReadAt: member.lastReadAt };
  }

  /** Get messages with pagination */
  async getMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 50,
  ) {
    const member = await this.prisma.chatConversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member)
      throw new ForbiddenException('You are not in this conversation');
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, username: true } },
        readReceipts: { select: { userId: true, readAt: true } },
      },
    });
    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    return {
      messages: items.reverse(),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /** Send a message */
  async sendMessage(conversationId: string, userId: string, content: string) {
    const member = await this.prisma.chatConversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member)
      throw new ForbiddenException('You are not in this conversation');
    const msg = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        content: content.trim(),
      },
      include: {
        sender: { select: { id: true, name: true, username: true } },
        readReceipts: true,
      },
    });
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: msg.createdAt },
    });
    try {
      this.chatGateway.emitNewMessage(conversationId, msg);
    } catch {
      // ignore if gateway not ready
    }
    return msg;
  }

  /** Mark messages as read */
  async markRead(conversationId: string, userId: string, messageId?: string) {
    const member = await this.prisma.chatConversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member)
      throw new ForbiddenException('You are not in this conversation');
    const now = new Date();
    await this.prisma.chatConversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: now },
    });
    if (messageId) {
      await this.prisma.chatReadReceipt.upsert({
        where: {
          messageId_userId: { messageId, userId },
        },
        create: { messageId, userId },
        update: { readAt: now },
      });
    }
    return { success: true };
  }

  /** List users for DM/group (e.g. department or all) */
  async listUsersForChat(
    userId: string,
    departmentId?: string,
    search?: string,
  ) {
    const where: any = {};
    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }
    where.id = { not: userId };
    where.isActive = true;
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: 'asc' },
      take: 100,
    });
  }

  /** Export conversation messages for audit/compliance (admin only) */
  async exportConversationMessages(
    conversationId: string,
    userId: string,
    userRoles: string[],
    startDate?: Date,
    endDate?: Date,
  ) {
    // Only admins can export for audit purposes
    if (!['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN', 'CHAT_MANAGER'].some((r) => userRoles.includes(r))) {
      throw new ForbiddenException('Only admins can export chat messages');
    }

    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, username: true } },
          },
        },
        createdBy: { select: { id: true, name: true, username: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });

    if (!conv) throw new NotFoundException('Conversation not found');

    const where: any = { conversationId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const messages = await this.prisma.chatMessage.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, username: true } },
        readReceipts: {
          include: {
            user: { select: { id: true, name: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      conversation: {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        description: conv.description,
        department: conv.department,
        createdBy: conv.createdBy,
        createdAt: conv.createdAt,
        members: conv.members.map((m) => ({
          user: m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
      messages: messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        createdAt: msg.createdAt,
        readBy: msg.readReceipts.map((r) => ({
          user: r.user,
          readAt: r.readAt,
        })),
      })),
      exportedAt: new Date(),
      exportedBy: { id: userId },
      totalMessages: messages.length,
    };
  }

  /** Get chat statistics for admin dashboard */
  async getChatStatistics(userRoles: string[], departmentId?: string) {
    if (!['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN', 'CHAT_MANAGER'].some((r) => userRoles.includes(r))) {
      throw new ForbiddenException('Only admins can view chat statistics');
    }

    const where: any = {};
    if (departmentId && userRoles.includes('DEPT_ADMIN') && !userRoles.includes('DEVELOPER') && !userRoles.includes('SUPER_ADMIN')) {
      where.departmentId = departmentId;
    }

    const [totalConversations, totalMessages, activeConversations] =
      await Promise.all([
        this.prisma.chatConversation.count({ where }),
        this.prisma.chatMessage.count({
          where: where.departmentId
            ? { conversation: { departmentId: where.departmentId } }
            : {},
        }),
        this.prisma.chatConversation.count({
          where: {
            ...where,
            lastMessageAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
      ]);

    return {
      totalConversations,
      totalMessages,
      activeConversations,
      messageRetention: 'permanent', // All messages are stored permanently
      complianceStatus: 'compliant',
    };
  }
}

function conversationInclude() {
  return {
    members: {
      include: {
        user: {
          select: { id: true, name: true, username: true, email: true },
        },
      },
    },
    createdBy: { select: { id: true, name: true, username: true } },
    department: { select: { id: true, name: true, code: true } },
    _count: { select: { messages: true } },
  };
}
