'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CHAT_ENABLED } from '@/lib/feature-flags';

export default function ChatSectionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!CHAT_ENABLED) {
      router.replace('/dashboard');
    }
  }, [router]);

  if (!CHAT_ENABLED) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground text-sm">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
