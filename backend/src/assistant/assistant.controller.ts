import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssistantService } from './assistant.service';

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('chat')
  async chat(
    @Request() req: { user: { id: string } },
    @Body() body: { message?: string; fileId?: string | null },
  ) {
    const message = body.message?.trim() ?? '';
    if (!message) {
      return { reply: 'Please enter a question.' };
    }
    const fileId =
      body.fileId && typeof body.fileId === 'string' && body.fileId.length > 0
        ? body.fileId
        : undefined;
    return this.assistantService.chat(req.user.id, message, fileId);
  }

  @Post('compose')
  async compose(
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      instruction?: string;
      fieldHint?: string;
      fileId?: string | null;
      extraContext?: string | null;
    },
  ) {
    const instruction = body.instruction?.trim() ?? '';
    if (!instruction) {
      return { text: '' };
    }
    const fileId =
      body.fileId && typeof body.fileId === 'string' && body.fileId.length > 0
        ? body.fileId
        : undefined;
    const extra =
      body.extraContext && typeof body.extraContext === 'string'
        ? body.extraContext
        : undefined;
    return this.assistantService.compose(req.user.id, instruction, {
      fieldHint: body.fieldHint,
      fileId,
      extraContext: extra,
    });
  }
}
