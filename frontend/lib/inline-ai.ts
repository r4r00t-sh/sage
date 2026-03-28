import api from '@/lib/api';

/** Whether plain text contains an `@Ai` token (for UI affordances). */
export function containsAiToken(text: string): boolean {
  return /@ai\b/i.test(text);
}

/** Match `@Ai`, `@AI`, etc. Case-insensitive; word boundary after `ai`. */
export function findLastAiDirective(text: string): {
  before: string;
  prompt: string;
} | null {
  const re = /@ai\b([\s\S]*)/gi;
  let m: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((m = re.exec(text)) !== null) {
    last = m;
  }
  if (!last) return null;
  const prompt = last[1].trim();
  if (!prompt) return null;
  return {
    before: text.slice(0, last.index),
    prompt,
  };
}

export async function requestInlineCompose(params: {
  instruction: string;
  fieldHint?: string;
  fileId?: string | null;
  extraContext?: string | null;
}): Promise<string> {
  const res = await api.post<{ text: string }>('/assistant/compose', {
    instruction: params.instruction,
    fieldHint: params.fieldHint,
    fileId: params.fileId ?? null,
    extraContext: params.extraContext ?? null,
  });
  return (res.data.text ?? '').trim();
}

/** Plain text → minimal HTML for the rich-text Editor (paragraphs + line breaks). */
export function plainTextToEditorHtml(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const blocks = esc.split(/\n\n+/).filter(Boolean);
  if (blocks.length === 0) return '';
  return blocks
    .map((b) => `<p>${b.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}
