'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ASSISTANT_ENABLED } from '@/lib/feature-flags';
import { findLastAiDirective, requestInlineCompose } from '@/lib/inline-ai';
import { InlineAiHighlightedText } from '@/components/inline-ai-highlight';
import { toast } from 'sonner';

export type AiInputProps = Omit<React.ComponentProps<'input'>, 'className'> & {
  className?: string;
  fileId?: string | null;
  fieldHint?: string;
  extraContext?: string | null | (() => string | null | undefined);
};

function emitValue(onChange: AiInputProps['onChange'], value: string) {
  onChange?.({
    target: { value } as HTMLInputElement,
    currentTarget: { value } as HTMLInputElement,
  } as React.ChangeEvent<HTMLInputElement>);
}

export const AiInput = React.forwardRef<HTMLInputElement, AiInputProps>(
  function AiInput(
    {
      value,
      onChange,
      onKeyDown,
      fileId,
      fieldHint,
      extraContext,
      className,
      disabled,
      type = 'text',
      ...props
    },
    ref,
  ) {
    const [busy, setBusy] = React.useState(false);
    const strVal = typeof value === 'string' ? value : '';

    const resolveExtra = (): string | null => {
      if (extraContext == null) return null;
      const v =
        typeof extraContext === 'function' ? extraContext() : extraContext;
      const s = v == null ? '' : String(v).trim();
      return s.length ? s : null;
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
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
          instruction: `${prompt}\n\nKeep the answer short: one line or a single short sentence unless the field clearly needs more.`,
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
        await new Promise((r) => setTimeout(r, 280));
        const singleLine = text.replace(/\s+/g, ' ').trim();
        emitValue(onChange, before + singleLine);
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
            'relative flex h-9 min-h-9 w-full min-w-0 rounded-md border border-input bg-transparent dark:bg-input/30 shadow-xs transition-[color,box-shadow]',
            'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
            (disabled || busy) && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <pre
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 z-0 m-0 flex items-center overflow-hidden',
              'whitespace-pre px-3 py-1 font-sans text-base leading-none md:text-sm',
            )}
          >
            <span className="min-w-0 text-left">
              <InlineAiHighlightedText text={strVal} />
            </span>
          </pre>
          <input
            ref={ref}
            {...props}
            type={type}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || busy}
            className={cn(
              'relative z-10 h-full min-h-0 w-full min-w-0 flex-1 bg-transparent',
              'border-0 px-3 py-1 text-base shadow-none outline-none md:text-sm',
              'ring-0 focus-visible:ring-0',
              'text-transparent caret-foreground',
              'placeholder:text-muted-foreground',
              'file:border-0 file:bg-transparent file:text-sm file:font-medium',
              'disabled:pointer-events-none',
            )}
          />
        </div>
        {showHint && (
          <p className="text-[11px] text-muted-foreground">
            Press{' '}
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl</kbd>
            +
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd>
            {' '}to run <span className="font-medium">@Ai</span>.
          </p>
        )}
      </div>
    );
  },
);

AiInput.displayName = 'AiInput';
