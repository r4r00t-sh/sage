'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAssistantStore } from '@/lib/store';
import api from '@/lib/api';

type Message = { role: 'user' | 'assistant'; text: string };

export function extractFileIdFromPath(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'files' || parts.length < 2) return undefined;
  const id = parts[1];
  const reserved = new Set(['inbox', 'new', 'track', 'approvals']);
  if (reserved.has(id)) return undefined;
  if (!/^[a-f0-9-]{10,}$/i.test(id)) return undefined;
  return id;
}

function stripAssistantMarkdown(text: string): string {
  let t = text.replace(/\r\n/g, '\n');
  t = t.replace(/\*\*/g, '');
  t = t.replace(/(^|\s)\*([^*\n]+)\*(\s|$)/g, '$1$2$3');
  t = t.replace(/^#{1,6}\s+/gm, '');
  return t.trim();
}

function MessageBody({
  text,
  role,
}: {
  text: string;
  role: 'user' | 'assistant';
}) {
  const display =
    role === 'assistant' ? stripAssistantMarkdown(text) : text;
  const paragraphs = display.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length === 0) {
    return <span className="whitespace-pre-wrap break-words">{display}</span>;
  }
  return (
    <div className="space-y-2 break-words">
      {paragraphs.map((para, i) => (
        <p key={i} className="whitespace-pre-wrap leading-relaxed last:mb-0">
          {para}
        </p>
      ))}
    </div>
  );
}

type AssistantPanelProps = {
  pathname: string | null;
};

export function AssistantPanel({ pathname }: AssistantPanelProps) {
  const {
    isOpen: open,
    closeAssistant,
    fileIdOverride,
    fileNumberLabel,
  } = useAssistantStore();

  const pathFileId = extractFileIdFromPath(pathname);
  const fileId = pathFileId ?? fileIdOverride ?? undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  if (!open) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await api.post<{ reply: string }>('/assistant/chat', {
        message: text,
        fileId: fileId ?? null,
      });
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: res.data.reply || 'No reply.' },
      ]);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      const msg =
        err.response?.data?.message ||
        'Request failed. Is the assistant configured on the server?';
      setMessages((m) => [...m, { role: 'assistant', text: String(msg) }]);
    } finally {
      setLoading(false);
    }
  };

  const contextLabel = fileId
    ? fileNumberLabel
      ? `File ${fileNumberLabel} — answers use metadata and readable attachment text you’re allowed to see.`
      : 'This file — answers use metadata and readable attachment text you’re allowed to see.'
    : 'Open a file (or use Ask AI on a file) for file-specific questions.';

  return (
    <div
      className={cn(
        'fixed bottom-24 right-6 z-[100] flex flex-col rounded-xl border bg-background shadow-xl',
        'w-[min(100vw-1.5rem,min(96vw,32rem))]',
        'max-h-[min(88vh,44rem)] min-h-[22rem]',
      )}
      role="dialog"
      aria-label="AI assistant"
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-violet-600" />
          Assistant
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => closeAssistant()}
          aria-label="Close assistant"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground leading-snug">
        {contextLabel}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ask for a summary, attachment overview, or status. PDF and plain-text
            attachments are included when available.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'rounded-lg px-3 py-2.5 text-sm',
              msg.role === 'user'
                ? 'ml-2 bg-primary/10 text-foreground'
                : 'mr-1 bg-muted/80 text-foreground',
            )}
          >
            <MessageBody text={msg.text} role={msg.role} />
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3 space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="min-h-[88px] resize-none text-sm"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          type="button"
          className="w-full"
          size="sm"
          onClick={send}
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
