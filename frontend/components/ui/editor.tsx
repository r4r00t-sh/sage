'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Quote,
  Undo,
  Redo,
  SpellCheck,
  Loader2,
} from 'lucide-react';
import { checkGrammar, extractTextFromHTML, applySuggestion, GrammarError } from '@/lib/grammar-check';
import { toast } from 'sonner';
import { ASSISTANT_ENABLED } from '@/lib/feature-flags';
import {
  containsAiToken,
  findLastAiDirective,
  plainTextToEditorHtml,
  requestInlineCompose,
} from '@/lib/inline-ai';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface EditorInlineAiOptions {
  fileId?: string | null;
  fieldHint?: string;
  extraContext?: string | null | (() => string | null | undefined);
}

interface EditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
  /** Ctrl/Cmd+Enter runs @Ai on plain-text content (see hint below field). */
  inlineAi?: EditorInlineAiOptions | null;
}

const Editor = React.forwardRef<HTMLDivElement, EditorProps>(
  (
    {
      value,
      onChange,
      placeholder,
      disabled,
      className,
      minHeight = '200px',
      inlineAi,
    },
    ref,
  ) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = React.useState(!value);
    const [isCheckingGrammar, setIsCheckingGrammar] = React.useState(false);
    const [grammarErrors, setGrammarErrors] = React.useState<GrammarError[]>([]);
    const [showGrammarPanel, setShowGrammarPanel] = React.useState(false);
    const [aiBusy, setAiBusy] = React.useState(false);

    React.useEffect(() => {
      if (editorRef.current && value !== undefined && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
        setIsEmpty(!value || value === '<br>' || value === '');
      }
    }, [value]);

    const handleInput = () => {
      if (editorRef.current) {
        const content = editorRef.current.innerHTML;
        const textContent = editorRef.current.textContent || '';
        setIsEmpty(!textContent.trim());
        onChange?.(content);
      }
    };

    const execCommand = (command: string, value?: string) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      handleInput();
    };

    const resolveExtra = (): string | null => {
      if (!inlineAi?.extraContext) return null;
      const v =
        typeof inlineAi.extraContext === 'function'
          ? inlineAi.extraContext()
          : inlineAi.extraContext;
      const s = v == null ? '' : String(v).trim();
      return s.length ? s : null;
    };

    const handleKeyDown = async (e: React.KeyboardEvent) => {
      if (
        inlineAi &&
        ASSISTANT_ENABLED &&
        !disabled &&
        !aiBusy &&
        (e.ctrlKey || e.metaKey) &&
        e.key === 'Enter' &&
        editorRef.current
      ) {
        const plain = extractTextFromHTML(editorRef.current.innerHTML);
        const m = findLastAiDirective(plain);
        if (m) {
          e.preventDefault();
          const snapshot = editorRef.current.innerHTML;
          const { before, prompt } = m;
          setAiBusy(true);
          const thinkingHtml = plainTextToEditorHtml(`${before}Thinking…`);
          editorRef.current.innerHTML = thinkingHtml;
          onChange?.(thinkingHtml);
          handleInput();
          try {
            const text = await requestInlineCompose({
              instruction: prompt,
              fieldHint: inlineAi.fieldHint,
              fileId: inlineAi.fileId ?? null,
              extraContext: resolveExtra(),
            });
            if (!text.trim()) {
              toast.error('AI returned empty text');
              editorRef.current.innerHTML = snapshot;
              onChange?.(snapshot);
              handleInput();
              return;
            }
            const midHtml = plainTextToEditorHtml(`${before}Writing…`);
            editorRef.current.innerHTML = midHtml;
            onChange?.(midHtml);
            handleInput();
            await new Promise((r) => setTimeout(r, 320));
            const finalHtml = plainTextToEditorHtml(before + text);
            editorRef.current.innerHTML = finalHtml;
            onChange?.(finalHtml);
            handleInput();
          } catch (err) {
            const ax = err as { response?: { data?: { message?: string } } };
            toast.error('AI compose failed', {
              description:
                ax.response?.data?.message ??
                'Check GEMINI_API_KEY and try again.',
            });
            editorRef.current.innerHTML = snapshot;
            onChange?.(snapshot);
            handleInput();
          } finally {
            setAiBusy(false);
          }
          return;
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        execCommand('insertHTML', '&emsp;');
      }
    };

    const handleGrammarCheck = async () => {
      if (!editorRef.current) return;

      const htmlContent = editorRef.current.innerHTML;
      const textContent = extractTextFromHTML(htmlContent);

      if (!textContent.trim()) {
        toast.info('No text to check');
        return;
      }

      setIsCheckingGrammar(true);
      setShowGrammarPanel(true);

      try {
        const result = await checkGrammar(textContent);
        setGrammarErrors(result.errors);

        if (result.hasErrors) {
          toast.info(`Found ${result.errors.length} grammar issue(s)`);
        } else {
          toast.success('No grammar issues found!');
        }
      } catch (error) {
        toast.error('Failed to check grammar. Please try again.');
        console.error('Grammar check error:', error);
      } finally {
        setIsCheckingGrammar(false);
      }
    };

    const handleApplySuggestion = (error: GrammarError, replacement: string) => {
      if (!editorRef.current || !value) return;

      const htmlContent = editorRef.current.innerHTML;
      const updated = applySuggestion(htmlContent, error.offset, error.length, replacement);
      
      editorRef.current.innerHTML = updated;
      onChange?.(updated);
      
      // Remove the error from the list
      setGrammarErrors(prev => prev.filter(e => e !== error));
      
      toast.success('Suggestion applied');
    };

    return (
      <div
        className={cn(
          'rounded-md border border-input bg-background',
          disabled && 'opacity-50 cursor-not-allowed',
          aiBusy && !disabled && 'opacity-90',
          className,
        )}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('bold')}
            disabled={disabled || aiBusy}
            aria-label="Bold"
          >
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('italic')}
            disabled={disabled || aiBusy}
            aria-label="Italic"
          >
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('underline')}
            disabled={disabled || aiBusy}
            aria-label="Underline"
          >
            <Underline className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('formatBlock', 'h1')}
            disabled={disabled || aiBusy}
            aria-label="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('formatBlock', 'h2')}
            disabled={disabled || aiBusy}
            aria-label="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('formatBlock', 'blockquote')}
            disabled={disabled || aiBusy}
            aria-label="Quote"
          >
            <Quote className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('insertUnorderedList')}
            disabled={disabled || aiBusy}
            aria-label="Bullet List"
          >
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('insertOrderedList')}
            disabled={disabled || aiBusy}
            aria-label="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('justifyLeft')}
            disabled={disabled || aiBusy}
            aria-label="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('justifyCenter')}
            disabled={disabled || aiBusy}
            aria-label="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('justifyRight')}
            disabled={disabled || aiBusy}
            aria-label="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('undo')}
            disabled={disabled || aiBusy}
            aria-label="Undo"
          >
            <Undo className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={false}
            onPressedChange={() => execCommand('redo')}
            disabled={disabled || aiBusy}
            aria-label="Redo"
          >
            <Redo className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <Popover open={showGrammarPanel} onOpenChange={setShowGrammarPanel}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGrammarCheck}
                disabled={disabled || aiBusy || isCheckingGrammar}
                className="h-8 w-8 p-0"
                aria-label="Check Grammar"
              >
                {isCheckingGrammar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SpellCheck className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <div className="p-3 border-b">
                <h4 className="font-semibold text-sm">Grammar Check</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {grammarErrors.length > 0
                    ? `${grammarErrors.length} issue(s) found`
                    : 'No issues found'}
                </p>
              </div>
              {grammarErrors.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="p-3 space-y-3">
                    {grammarErrors.map((error, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-3 space-y-2 bg-muted/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-destructive">
                              {error.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {error.rule.description}
                            </p>
                          </div>
                        </div>
                        {error.replacements.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium">Suggestions:</p>
                            <div className="flex flex-wrap gap-1">
                              {error.replacements.slice(0, 3).map((replacement, idx) => (
                                <Button
                                  key={idx}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleApplySuggestion(error, replacement)}
                                >
                                  {replacement}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {isCheckingGrammar ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Checking grammar...</span>
                    </div>
                  ) : (
                    <p>No grammar issues found!</p>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Editor Content */}
        <div
          className={cn(
            'relative',
            inlineAi &&
              ASSISTANT_ENABLED &&
              !disabled &&
              !aiBusy &&
              containsAiToken(extractTextFromHTML(value || '')) &&
              'rounded-b-md bg-violet-500/[0.07] ring-2 ring-violet-500/35 ring-inset transition-[background-color,box-shadow] dark:bg-violet-400/[0.08]',
          )}
        >
          <div
            ref={editorRef}
            contentEditable={!disabled && !aiBusy}
            spellCheck={true}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            className={cn(
              'prose prose-sm dark:prose-invert max-w-none p-3 outline-none',
              'focus:ring-0 overflow-auto',
              '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2',
              '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2',
              '[&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic',
              '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6',
              disabled && 'cursor-not-allowed',
            )}
            style={{ minHeight }}
            suppressContentEditableWarning
          />
          {isEmpty && placeholder && (
            <div
              className="pointer-events-none absolute left-3 top-3 text-muted-foreground"
              aria-hidden
            >
              {placeholder}
            </div>
          )}
        </div>
        {inlineAi &&
          ASSISTANT_ENABLED &&
          !disabled &&
          findLastAiDirective(extractTextFromHTML(value || '')) &&
          !aiBusy && (
            <p className="border-t bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground leading-snug">
              Press{' '}
              <kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">
                Ctrl
              </kbd>
              +
              <kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>{' '}
              to run <span className="font-medium">@Ai</span>. Rich formatting before{' '}
              <span className="font-medium">@Ai</span> is turned into plain paragraphs when
              the reply is inserted.
            </p>
          )}
      </div>
    );
  }
);

Editor.displayName = 'Editor';

export { Editor };

