'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, useChatStore } from '@/lib/store';
import { AppSidebar } from '@/components/app-sidebar';
import { Navbar } from '@/components/navbar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { PresenceClient } from '@/components/presence-client';
import { ToastConsumer } from '@/components/toast-consumer';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthUserThemeSync } from '@/components/auth-user-theme-sync';
import { ChatFab } from '@/components/chat-fab';
import { ChatSidebar } from '@/components/chat-sidebar';
import { CommandPalette } from '@/components/command-palette';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { BreadcrumbNav } from '@/components/breadcrumb-nav';
import { PageTransition } from '@/components/page-transition';
import { BetaBanner } from '@/components/beta-banner';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

const publicRoutes = ['/login', '/docs'];
const changePasswordPath = '/profile/change-password';
const completeProfilePath = '/profile/complete';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setLastVisitedPath, logout } = useAuthStore();
  const { isChatOpen: chatOpen, setChatOpen, openChatWithUserId, clearOpenChatWithUserId } = useChatStore();
  const [mounted, setMounted] = useState(false);
  const isPublicRoute = publicRoutes.includes(pathname);
  const isChangePasswordRoute = pathname === changePasswordPath;
  const isCompleteProfileRoute = pathname === completeProfilePath;
  const isOnboardingRoute = isChangePasswordRoute || isCompleteProfileRoute;
  const isAuthenticated = !!user;
  const mustChangePassword = isAuthenticated && user?.mustChangePassword === true;
  const mustCompleteProfile =
    isAuthenticated && (user?.profileCompletedAt == null || user?.profileCompletedAt === '');

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Track last visited path for authenticated users (skip when must complete profile)
  useEffect(() => {
    if (mounted && isAuthenticated && !isPublicRoute && pathname && !mustCompleteProfile) {
      setLastVisitedPath(pathname);
    }
  }, [mounted, isAuthenticated, isPublicRoute, pathname, mustCompleteProfile, setLastVisitedPath]);

  // Redirect: first change temporary password (if required), then complete staff profile
  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    if (mustChangePassword && !isChangePasswordRoute) {
      router.replace(changePasswordPath);
      return;
    }
    if (!mustChangePassword && mustCompleteProfile && !isCompleteProfileRoute) {
      router.replace(completeProfilePath);
    }
  }, [
    mounted,
    isAuthenticated,
    mustChangePassword,
    mustCompleteProfile,
    isChangePasswordRoute,
    isCompleteProfileRoute,
    router,
  ]);

  // Redirect unauthenticated users to login when they try to access protected routes
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated && !isPublicRoute) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`;
      router.replace(loginUrl);
    }
  }, [mounted, isAuthenticated, isPublicRoute, pathname, router]);

  // Logged-in users should not stay on /login (e.g. after submit or restored session)
  useEffect(() => {
    if (!mounted || !isAuthenticated || pathname !== '/login') return;
    if (mustChangePassword) {
      router.replace(changePasswordPath);
      return;
    }
    if (mustCompleteProfile) {
      router.replace(completeProfilePath);
      return;
    }
    router.replace('/dashboard');
  }, [
    mounted,
    isAuthenticated,
    pathname,
    mustChangePassword,
    mustCompleteProfile,
    router,
  ]);

  // Floating chat FAB + sidebar: render in portal so they're always on top and visible
  const chatWidget =
    mounted &&
    typeof document !== 'undefined' &&
    isAuthenticated &&
    !isPublicRoute &&
    !isOnboardingRoute
      ? createPortal(
          <>
            <ChatFab onClick={() => setChatOpen(true)} />
            <ChatSidebar open={chatOpen} onOpenChange={setChatOpen} openWithUserId={openChatWithUserId} clearOpenWithUserId={clearOpenChatWithUserId} />
          </>,
          document.body
        )
      : null;

  const handleOnboardingLogout = () => {
    logout();
    router.push('/login');
  };

  // Single ThemeProvider for the whole app shell so it does not remount on login → dashboard
  // (remounting used to blank the UI because ThemeProvider returned null until mounted).
  let shell: ReactNode;

  if (isAuthenticated && isOnboardingRoute) {
    shell = (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-start pt-12 pb-12 px-4 relative">
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOnboardingLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
        <ToastConsumer />
        <PageTransition>{children}</PageTransition>
      </div>
    );
  } else if (isAuthenticated && !isPublicRoute) {
    shell = (
      <>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="bg-muted/30">
            <BetaBanner />
            <Navbar />
            <main className="flex flex-1 flex-col">
              <PresenceClient />
              <ToastConsumer />
              <div className="flex flex-1 flex-col gap-3 p-4 md:p-5">
                <BreadcrumbNav />
                <PageTransition>{children}</PageTransition>
              </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
        {chatWidget}
        <CommandPalette />
        <KeyboardShortcuts />
      </>
    );
  } else if (!isAuthenticated && !isPublicRoute) {
    shell = (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  } else {
    shell = <PageTransition>{children}</PageTransition>;
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="efiling-theme">
      <AuthUserThemeSync />
      {shell}
    </ThemeProvider>
  );
}

