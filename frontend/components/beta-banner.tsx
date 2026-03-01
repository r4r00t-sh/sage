'use client';

export function BetaBanner() {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-center text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-semibold uppercase tracking-wide dark:bg-amber-500/25">
        Beta
      </span>
      <span>This application is currently in beta. You may encounter issues.</span>
    </div>
  );
}
