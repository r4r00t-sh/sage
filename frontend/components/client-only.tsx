'use client';

import { useState, useEffect } from 'react';

/**
 * Renders children only after mount. On server and initial client paint, shows a minimal
 * loading state. Prevents any client-only code (stores, theme, etc.) from running during SSR,
 * avoiding 500s from localStorage/document access.
 */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
