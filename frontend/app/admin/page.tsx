'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { hasAnyRole } from '@/lib/auth-utils';

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // Redirect to appropriate admin page based on user role
    if (user) {
      if (hasAnyRole(user, ['DEVELOPER', 'SUPER_ADMIN', 'DEPT_ADMIN'])) {
        // Default to analytics for admins
        router.replace('/admin/analytics');
      } else {
        // Non-admin users shouldn't be here, redirect to dashboard
        router.replace('/dashboard');
      }
    }
  }, [user, router]);

  // Show loading state while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

