'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ASSISTANT_ENABLED } from '@/lib/feature-flags';
import { findLastAiDirective, requestInlineCompose } from '@/lib/inline-ai';
import { InlineAiHighlightedText } from '@/components/inline-ai-highlight';
import { toast } from 'sonner';

export type AiTextareaProps = Omit<
  React.ComponentProps<'textarea'>,
  'className'
> & {
  className?: string;
  fileId?: string | null;
  fieldHint?: string;
  extraContext?: string | null | (() => string | null | undefined);
};

function emitValue(
  onChange: AiTextareaProps['onChange'],
  value: string,
) {
  onChange?.({
    target: { value } as HTMLTextAreaElement,
    currentTarget: { value } as HTMLTextAreaElement,
  } as React.ChangeEvent<HTMLTextAreaElement>);
}

export const AiTextarea = React.forwardRef<HTMLTextAreaElement, AiTextareaProps>(
  function AiTextarea(
    {
      value,
      onChange,
      onKeyDown,
      onScroll,
      fileId,
      fieldHint,
      extraContext,
      className,
      disabled,
      ...props
    },
    ref,
  ) {
    const mirrorRef = React.useRef<HTMLPreElement>(null);
    const [busy, setBusy] = React.useState(false);
    const strVal = typeof value === 'string' ? value : '';

    const resolveExtra = (): string | null => {
      if (extraContext == null) return null;
      const v =
        typeof extraContext === 'function' ? extraContext() : extraContext;
      const s = v == null ? '' : String(v).trim();
      return s.length ? s : null;
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(e);
      if (!ASSISTANT_ENABLED || disabled || busy) return;
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return;

      const m = findLastAiDirective(strVal);
      if (!m) return;

      e.preventDefault();
      const snapshot = strVal;
      const { before, prompt } = m;

      setBusy(true);
      emitValue(onChange, `${before}Thinking…`);
      try {
        const text = await requestInlineCompose({
          instruction: prompt,
          fieldHint,
          fileId: fileId ?? null,
          extraContext: resolveExtra(),
        });
        if (!text) {
          toast.error('AI returned empty text');
          emitValue(onChange, snapshot);
          return;
        }
        emitValue(onChange, `${before}Writing…`);
        await new Promise((r) => setTimeout(r, 320));
        emitValue(onChange, before + text);
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { message?: string } } };
        toast.error('AI compose failed', {
          description: ax.response?.data?.message ?? 'Check GEMINI_API_KEY and try again.',
        });
        emitValue(onChange, snapshot);
      } finally {
        setBusy(false);
      }
    };

    const showHint =
      ASSISTANT_ENABLED &&
      !disabled &&
      findLastAiDirective(strVal) &&
      !busy;

    return (
      <div className="space-y-1 w-full">
        <div
          className={cn(
            'relative w-full rounded-md border border-input bg-transparent dark:bg-input/30 shadow-xs transition-[color,box-shadow]',
            'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
            (disabled || busy) && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <pre
            ref={mirrorRef}
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 z-0 m-0 overflow-hidden',
              'whitespace-pre-wrap break-words px-3 py-2 text-left font-sans text-base leading-normal md:text-sm',
            )}
          >
            <InlineAiHighlightedText text={strVal} />
          </pre>
          <textarea
            ref={ref}
            {...props}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            onScroll={(e) => {
              const m = mirrorRef.current;
              if (m) {
                m.scrollTop = e.currentTarget.scrollTop;
                m.scrollLeft = e.currentTarget.scrollLeft;
              }
              onScroll?.(e);
            }}
            disabled={disabled || busy}
            className={cn(
              'relative z-10 block w-full min-h-16 resize-y bg-transparent',
              'field-sizing-content border-0 px-3 py-2 text-base leading-normal shadow-none outline-none md:text-sm',
              'ring-0 focus-visible:ring-0',
              'text-transparent caret-foreground',
              'placeholder:text-muted-foreground',
              'disabled:cursor-not-allowed',
            )}
          />
        </div>
        {showHint && (
          <p className="text-[11px] text-muted-foreground">
            Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl</kbd>
            +
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd>
            {' '}to run <span className="font-medium">@Ai</span> and replace it with the generated text.
          </p>
        )}
      </div>
    );
  },
);

AiTextarea.displayName = 'AiTextarea';
