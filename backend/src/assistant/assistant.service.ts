import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesService } from '../files/files.service';

/** Tracks Google’s current Flash model; same idea as `gemini-flash-latest` in REST. */
const GEMINI_MODEL = 'gemini-flash-latest';

const ATTACH_TEXT_TOTAL_BUDGET = 45_000;
const ATTACH_TEXT_PER_FILE = 12_000;
const MAX_ATTACHMENTS_TO_READ = 8;
const MAX_BUFFER_BYTES = 25 * 1024 * 1024;

@Injectable()
export class AssistantService {
  constructor(
    private readonly config: ConfigService,
    private readonly filesService: FilesService,
  ) {}

  async chat(userId: string, message: string, fileId?: string) {
    let fileContext = '';
    if (fileId) {
      const file = await this.filesService.getFileById(fileId, userId);
      fileContext = await this.buildFileContext(file);
    }

    const systemInstruction = `You are a concise assistant inside an electronic file management (e-filing) system.
Answer only using the file context provided below when a file is in context. If no file context is given, answer general questions about how such systems typically work, or say you need the user to open a file page for file-specific questions.
Do not invent file numbers, statuses, or people not listed in the context. If something is not in the context, say so.
When attachmentTextExcerpts are present, use them to answer questions about document content, summaries, or what an attachment says. Excerpts may be truncated.
Do not use markdown bold or italics (no ** or * for emphasis). Use plain sentences, optional numbered lists, and line breaks only.
Use short paragraphs or bullet points.`;

    const userText = fileContext
      ? `File context (JSON; user is allowed to see this):\n${fileContext}\n\nUser question:\n${message}`
      : `No file is in context.\n\nUser question:\n${message}`;

    const text = await this.generateGeminiText(systemInstruction, userText, {
      maxOutputTokens: 2048,
      temperature: 0.35,
    });
    return { reply: text };
  }

  /**
   * Compose text for a form field from a natural-language instruction (inline @Ai in the UI).
   */
  async compose(
    userId: string,
    instruction: string,
    options?: {
      fieldHint?: string;
      fileId?: string;
      extraContext?: string;
    },
  ): Promise<{ text: string }> {
    const trimmed = instruction.trim();
    if (!trimmed) {
      throw new BadRequestException('Instruction is empty.');
    }
    if (trimmed.length > 8000) {
      throw new BadRequestException('Instruction is too long.');
    }

    let fileContext = '';
    if (options?.fileId) {
      const file = await this.filesService.getFileById(options.fileId, userId);
      fileContext = await this.buildFileContext(file);
    }

    const fieldLine = options?.fieldHint
      ? `The user is composing content for this form field: ${options.fieldHint}.`
      : 'The user is composing content for a form field in the e-filing system.';

    const systemInstruction = `You help staff write text for an electronic file management (e-filing) system.
${fieldLine}
The user message after "Instruction:" is what they want you to produce (tone, topic, length, bullet vs paragraph, etc.).
Output ONLY the final text to insert into the field. No surrounding quotes, no markdown (** or # headings), no preamble like "Here is" or "Sure". Use plain language suitable for official records.`;

    const parts: string[] = [];
    if (fileContext) {
      parts.push(`Optional file context (JSON; user may rely on this):\n${fileContext}`);
    } else {
      parts.push('No file context.');
    }
    if (options?.extraContext?.trim()) {
      parts.push(
        `Additional context from the form (plain text):\n${options.extraContext.trim().slice(0, 4000)}`,
      );
    }
    parts.push(`Instruction:\n${trimmed}`);

    const userText = parts.join('\n\n');
    const text = await this.generateGeminiText(systemInstruction, userText, {
      maxOutputTokens: 4096,
      temperature: 0.4,
    });
    return { text };
  }

  private async generateGeminiText(
    systemInstruction: string,
    userText: string,
    generationConfig: { maxOutputTokens: number; temperature: number },
  ): Promise<string> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI assistant is not configured (missing GEMINI_API_KEY on the server).',
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userText }],
          },
        ],
        generationConfig,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let detail = errText;
      try {
        const j = JSON.parse(errText) as { error?: { message?: string } };
        if (j?.error?.message) detail = j.error.message;
      } catch {
        /* keep raw */
      }
      throw new BadRequestException(
        `Gemini API error (${res.status}): ${detail.slice(0, 500)}`,
      );
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim() ?? '';

    if (!text) {
      throw new BadRequestException('Empty response from AI model.');
    }

    return this.formatAssistantReply(text);
  }

  private formatAssistantReply(text: string): string {
    let t = text.replace(/\r\n/g, '\n');
    t = t.replace(/\*\*/g, '');
    t = t.replace(/(^|\s)\*([^*\n]+)\*(\s|$)/g, '$1$2$3');
    t = t.replace(/^#{1,6}\s+/gm, '');
    return t.trim();
  }

  private async extractTextFromBuffer(
    buffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<string | null> {
    const name = (filename || '').toLowerCase();
    const mt = (mimeType || '').toLowerCase();

    if (mt === 'application/pdf' || name.endsWith('.pdf')) {
      if (buffer.length > MAX_BUFFER_BYTES) return null;
      try {
        // CommonJS module; avoids ESM/default export edge cases in Nest bundling.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse') as (
          b: Buffer,
        ) => Promise<{ text?: string }>;
        const data = await pdfParse(buffer);
        const raw = data.text?.replace(/\0/g, '') ?? '';
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : null;
      } catch {
        return null;
      }
    }

    if (
      mt.startsWith('text/') ||
      mt === 'application/json' ||
      mt === 'application/xml' ||
      name.endsWith('.txt') ||
      name.endsWith('.csv') ||
      name.endsWith('.md')
    ) {
      try {
        const s = buffer.toString('utf8').replace(/\0/g, '').trim();
        return s.length > 0 ? s : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  private async extractAttachmentTextExcerpts(
    file: Record<string, unknown>,
  ): Promise<{ filename: string; mimeType: string; excerpt: string }[]> {
    const attachments = Array.isArray(file.attachments)
      ? (file.attachments as { id: string; filename?: string; mimeType?: string }[])
      : [];
    let budget = ATTACH_TEXT_TOTAL_BUDGET;
    const out: { filename: string; mimeType: string; excerpt: string }[] = [];

    for (const att of attachments.slice(0, MAX_ATTACHMENTS_TO_READ)) {
      if (budget <= 0) break;
      try {
        const { buffer, filename, mimeType } =
          await this.filesService.getAttachmentBuffer(att.id);
        if (buffer.length > MAX_BUFFER_BYTES) continue;
        const text = await this.extractTextFromBuffer(
          buffer,
          mimeType,
          filename,
        );
        if (!text) continue;
        const cap = Math.min(ATTACH_TEXT_PER_FILE, budget);
        const excerpt =
          text.length > cap ? `${text.slice(0, cap)}…` : text;
        const len = excerpt.length;
        budget -= len;
        out.push({
          filename: filename || 'attachment',
          mimeType: mimeType || 'application/octet-stream',
          excerpt,
        });
      } catch {
        /* skip unreadable attachment */
      }
    }

    return out;
  }

  private async buildFileContext(file: Record<string, unknown>): Promise<string> {
    const truncate = (s: string, max: number) =>
      s.length <= max ? s : `${s.slice(0, max)}…`;

    const summary: Record<string, unknown> = {
      fileNumber: file.fileNumber,
      subject: file.subject,
      status: file.status,
      priorityCategory: file.priorityCategory,
      isRedListed: file.isRedListed,
      description: file.description
        ? truncate(String(file.description), 800)
        : undefined,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      department: (file.department as { name?: string })?.name,
      currentDivision: (file.currentDivision as { name?: string })?.name,
      intendedDivision: (file.intendedDivision as { name?: string })?.name,
      assignedTo: file.assignedTo
        ? {
            name: (file.assignedTo as { name?: string }).name,
          }
        : null,
      createdBy: file.createdBy
        ? { name: (file.createdBy as { name?: string }).name }
        : null,
    };

    const routing = Array.isArray(file.routingHistory)
      ? (file.routingHistory as Record<string, unknown>[])
          .slice(0, 15)
          .map((r) => ({
            action: r.action ?? r.actionString,
            createdAt: r.createdAt,
            remarks: r.remarks
              ? truncate(String(r.remarks), 400)
              : undefined,
            toUser: (r.toUser as { name?: string } | undefined)?.name,
          }))
      : [];

    const notes = Array.isArray(file.notes)
      ? (file.notes as { content?: string; createdAt?: string }[])
          .slice(0, 12)
          .map((n) => ({
            createdAt: n.createdAt,
            content: n.content ? truncate(String(n.content), 500) : '',
          }))
      : [];

    const attachments = Array.isArray(file.attachments)
      ? (file.attachments as { filename?: string; mimeType?: string }[]).map(
          (a) => ({
            name: a.filename,
            mimeType: a.mimeType,
          }),
        )
      : [];

    const attachmentTextExcerpts = await this.extractAttachmentTextExcerpts(
      file,
    );

    const payload = {
      summary,
      routingHistory: routing,
      notes,
      attachments,
      attachmentTextExcerpts,
    };
    return JSON.stringify(payload, null, 0);
  }
}
