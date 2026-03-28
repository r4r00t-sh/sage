'use client';

import * as React from 'react';

const AI_TOKEN_SPLIT = /(@ai\b)/gi;

/** Renders plain text with every `@Ai` token highlighted (for mirror-behind-textarea). */
export function InlineAiHighlightedText({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(AI_TOKEN_SPLIT);
  return (
    <>
      {parts.map((part, i) =>
        /^@ai$/i.test(part) ? (
          <mark
            key={i}
            className="rounded-sm bg-violet-500/25 px-1 py-0.5 font-semibold text-violet-900 dark:bg-violet-400/30 dark:text-violet-100"
          >
            {part}
          </mark>
        ) : (
          <span key={i} className="text-foreground">
            {part}
          </span>
        ),
      )}
    </>
  );
}
