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
import { LogIn, Lock, User, ChevronDown } from 'lucide-react';

const testAccounts = [
  { role: 'Super Admin', username: 'admin', password: 'admin123', name: 'Super Administrator' },
  { role: 'Dept Admin', username: 'fin.admin', password: 'password123', name: 'Finance Department Admin' },
  { role: 'Section Officer', username: 'fin.accoun0.section', password: 'password123', name: 'Accounts - Section Officer' },
  { role: 'Approval Auth', username: 'fin.accoun0.approver', password: 'password123', name: 'Accounts - Approval Authority' },
  { role: 'Dispatcher', username: 'fin.accoun0.dispatch', password: 'password123', name: 'Accounts - Dispatcher' },
  { role: 'Inward Desk', username: 'fin.accoun0.inward', password: 'password123', name: 'Accounts - Inward Desk' },
  { role: 'Dept Admin', username: 'agr.admin', password: 'password123', name: 'Agriculture Department Admin' },
  { role: 'Section Officer', username: 'agr.animal0.section', password: 'password123', name: 'Animal Husbandry - Section Officer' },
  { role: 'Dept Admin', username: 'ops.admin', password: 'password123', name: 'Operations Department Admin' },
  { role: 'Section Officer', username: 'shro.medica0.section', password: 'password123', name: 'Medical Education - Section Officer' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  const rawRedirect = searchParams.get('redirect') || '/dashboard';
  const redirectTo =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      setAuth(response.data.user, response.data.access_token);
      toast.success('Welcome back!', {
        description: `Logged in as ${response.data.user.name}`,
      });
      router.push(redirectTo);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Login failed', {
        description: err.response?.data?.message || 'Invalid username or password',
      });
    } finally {
      setLoading(false);
    }
  };

  const fillTestAccount = (account: (typeof testAccounts)[0]) => {
    setUsername(account.username);
    setPassword(account.password);
    toast.info(`Filled: ${account.name}`);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row text-zinc-100">
      {/* Header - spans full width, transparent over columns */}
      <header className="flex items-center justify-between px-6 py-5 lg:px-10 lg:py-6 border-b border-zinc-800/50 lg:border-b-0 lg:absolute lg:top-0 lg:left-0 lg:right-0 z-10 lg:bg-transparent bg-zinc-950">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="EFMP" className="h-8 w-8 object-contain" />
          </div>
          <span className="text-lg font-semibold text-zinc-100">EFMP</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Back to home
        </Link>
      </header>

      {/* Left column - lighter shade + testimonial */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-end p-12 xl:p-16 lg:min-h-screen bg-zinc-900 lg:border-r border-zinc-800/80">
        <div className="max-w-md">
          <blockquote className="text-zinc-400 italic text-lg leading-relaxed">
            &ldquo;This platform has saved us countless hours and helped us deliver
            file tracking and approvals faster than ever before.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-zinc-500">— Santhigiri Ashram</p>
        </div>
      </div>

      {/* Right column - darker shade + form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-zinc-950">
        <div className="w-full max-w-[400px]">
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
              Sign in to your account
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Enter your credentials to access the e-filing platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-zinc-300">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="Enter your username"
                  className="pl-10 h-12 bg-zinc-900/80 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-500 focus-visible:border-zinc-600"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-zinc-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="pl-10 h-12 bg-zinc-900/80 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-500 focus-visible:border-zinc-600"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-white text-zinc-900 hover:bg-zinc-200 font-medium"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
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

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-zinc-950 px-3 text-zinc-500">Or continue with</span>
            </div>
          </div>

          {/* Test accounts */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowTestAccounts(!showTestAccounts)}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-600 hover:text-zinc-100 transition-colors text-sm font-medium"
            >
              Use a test account
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showTestAccounts ? 'rotate-180' : ''}`}
              />
            </button>
            {showTestAccounts && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-1.5 max-h-64 overflow-y-auto">
                {testAccounts.map((account, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => fillTestAccount(account)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{account.name}</span>
                    <span className="text-xs text-zinc-500 shrink-0">{account.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
