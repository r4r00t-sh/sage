'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AssistantFabProps = {
  onClick: () => void;
  className?: string;
};

export function AssistantFab({ onClick, className }: AssistantFabProps) {
  return (
    <Button
      type="button"
      size="icon"
      onClick={onClick}
      title="AI assistant — ask about the current file or the app"
      className={cn(
        'fixed bottom-6 right-6 z-[100] h-14 w-14 rounded-full shadow-lg',
        'bg-gradient-to-br from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500',
        className,
      )}
      aria-label="Open AI assistant"
    >
      <Sparkles className="h-6 w-6" />
    </Button>
  );
}
