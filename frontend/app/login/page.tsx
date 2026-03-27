'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { toast } from 'sonner';
import { LogIn, Lock, User, ChevronDown, Smartphone } from 'lucide-react';
import { GITHUB_RELEASES_URL } from '@/lib/api';
import { AuthLeftPanel } from '@/components/auth-left-panel';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, clearLastVisitedPath } = useAuthStore();

  // Default landing page: Dashboard. Only use redirect param when explicitly provided (e.g. after login from protected page).
  const redirectParam = searchParams.get('redirect');
  const redirectTo =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      setAuth(response.data.user, response.data.access_token);
      // Clear last visited path after successful login
      clearLastVisitedPath();
      toast.success('Welcome back!', {
        description: `Logged in as ${response.data.user.name}`,
      });
      if (response.data.user.mustChangePassword) {
        router.push('/profile/change-password');
      } else if (!response.data.user.profileCompletedAt) {
        router.push('/profile/complete');
      } else {
        router.push(redirectTo);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const msg = err.response?.data?.message || err.message || 'Invalid username or password';
      toast.error('Login failed', {
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-zinc-50 text-zinc-900">
      {/* Header - spans full width, transparent over columns */}
      <header className="flex items-center justify-between px-6 py-5 lg:px-10 lg:py-6 border-b border-zinc-200 lg:border-b-0 lg:absolute lg:top-0 lg:left-0 lg:right-0 z-10 lg:bg-transparent bg-zinc-50">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png?v=2" alt="SAGE" className="h-14 w-14 object-contain" />
        </Link>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
              aria-haspopup="true"
              aria-expanded="false"
            >
              <Smartphone className="h-4 w-4" />
              Download
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 py-1 min-w-[140px] rounded-lg border border-zinc-200 bg-white shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              >
                For Android
              </a>
              <button
                type="button"
                className="block w-full px-4 py-2 text-left text-sm text-zinc-400 cursor-default"
                onClick={(e) => e.preventDefault()}
              >
                For iOS
              </button>
            </div>
          </div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </header>

      {/* Left column - Unicorn Studio background covers fully; acrylic overlay + text on top */}
      <div className="hidden lg:flex lg:w-1/2 lg:min-h-screen lg:border-r border-zinc-200">
        <AuthLeftPanel />
      </div>

      {/* Right column - light background + form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-zinc-50">
        <div className="w-full max-w-[400px]">
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
              Sign in to your account
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Enter your credentials to access the e-filing platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-zinc-300">
                {/* label color adjusted via base text color */}
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="Enter your username"
                  className="pl-10 h-12 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-500 focus-visible:border-zinc-500"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-zinc-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="pl-10 h-12 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-zinc-500 focus-visible:border-zinc-500"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-zinc-900 text-white hover:bg-zinc-800 font-medium"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign in
                </span>
              )}
            </Button>
          </form>

          <p className="mt-10 text-xs text-zinc-500 leading-relaxed">
            By signing in, you agree to our{' '}
            <Link href="#" className="underline underline-offset-2 hover:text-zinc-400">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="#" className="underline underline-offset-2 hover:text-zinc-400">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
