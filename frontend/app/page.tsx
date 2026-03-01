'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function Home() {
  const { user, lastVisitedPath } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      // Redirect to last visited path or dashboard
      const redirectTo = lastVisitedPath || '/dashboard';
      router.push(redirectTo);
    } else {
      router.push('/login');
    }
  }, [user, lastVisitedPath, router]);

  return null;
}
