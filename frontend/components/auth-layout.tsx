'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, useChatStore } from '@/lib/store';
import { AppSidebar } from '@/components/app-sidebar';
import { Navbar } from '@/components/navbar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { PresenceClient } from '@/components/presence-client';
import { ToastConsumer } from '@/components/toast-consumer';
import { ThemeProvider } from '@/components/theme-provider';
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
  const mustCompleteProfile = isAuthenticated && (mustChangePassword || user?.profileCompletedAt == null || user?.profileCompletedAt === '');

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

  // Redirect: first change temp password, then complete staff profile
  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    if (mustChangePassword && !isChangePasswordRoute) {
      router.replace(changePasswordPath);
      return;
    }
    if (!mustChangePassword && (user?.profileCompletedAt == null || user?.profileCompletedAt === '') && !isCompleteProfileRoute) {
      router.replace(completeProfilePath);
    }
  }, [mounted, isAuthenticated, mustChangePassword, user?.profileCompletedAt, isChangePasswordRoute, isCompleteProfileRoute, router]);

  // Redirect unauthenticated users to login when they try to access protected routes
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated && !isPublicRoute) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`;
      router.replace(loginUrl);
    }
  }, [mounted, isAuthenticated, isPublicRoute, pathname, router]);

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

  // Onboarding (change password / complete profile): only the form on a blank background, no sidebar/nav
  if (isAuthenticated && isOnboardingRoute) {
    const handleLogout = () => {
      logout();
      router.push('/login');
    };
    return (
      <ThemeProvider defaultTheme="system" storageKey="efiling-theme">
        <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-start pt-12 pb-12 px-4 relative">
          <div className="absolute top-4 right-4">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
          <ToastConsumer />
          <PageTransition>{children}</PageTransition>
        </div>
      </ThemeProvider>
    );
  }

  // Show full layout only if authenticated and not on public routes
  if (isAuthenticated && !isPublicRoute) {
    return (
      <ThemeProvider defaultTheme="system" storageKey="efiling-theme">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="bg-muted/30">
            <BetaBanner />
            <Navbar />
            <main className="flex flex-1 flex-col">
              <PresenceClient />
              <ToastConsumer />
              {/* Content container with proper spacing */}
              <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <BreadcrumbNav />
                <PageTransition>{children}</PageTransition>
              </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
        {chatWidget}
        <CommandPalette />
        <KeyboardShortcuts />
      </ThemeProvider>
    );
  }

  // Not authenticated on a protected route: show nothing while redirecting to login
  if (!isAuthenticated && !isPublicRoute) {
    return (
      <ThemeProvider defaultTheme="system" storageKey="efiling-theme">
        <div className="flex min-h-screen items-center justify-center bg-muted/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </ThemeProvider>
    );
  }

  // Public routes (login, etc.) - no sidebar/navbar, no presence/toast
  return (
    <ThemeProvider defaultTheme="system" storageKey="efiling-theme">
      <PageTransition>{children}</PageTransition>
    </ThemeProvider>
  );
}

