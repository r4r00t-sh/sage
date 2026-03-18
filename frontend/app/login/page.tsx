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
import { LogIn, Lock, User, ChevronDown, Smartphone, Building2, LifeBuoy, UserCircle } from 'lucide-react';
import { GITHUB_RELEASES_URL } from '@/lib/api';
import { AuthLeftPanel } from '@/components/auth-left-panel';

// Must match backend seed (prisma/seed.ts). All use password123 except Super Admin (admin123).
type TestAccount = {
  role: string;
  username: string;
  password: string;
  name: string;
  department: string;
  division: string;
  /** Support Panel = view/respond to all tickets (SUPER_ADMIN only in this list). Others get My Tickets only. */
  supportAccess: 'Support Panel + My Tickets' | 'My Tickets only';
  email: string;
};
const testAccounts: TestAccount[] = [
  {
    role: 'Super Admin',
    username: 'admin',
    password: 'admin123',
    name: 'Super Administrator',
    department: '—',
    division: '—',
    supportAccess: 'Support Panel + My Tickets',
    email: 'admin@example.com',
  },
  // General Administration
  {
    role: 'GEN Dept Admin',
    username: 'gen.admin',
    password: 'password123',
    name: 'General Administration Admin',
    department: 'General Administration',
    division: 'GEN Main Division',
    supportAccess: 'My Tickets only',
    email: 'gen.admin@example.com',
  },
  {
    role: 'GEN Section Officer',
    username: 'gen.section',
    password: 'password123',
    name: 'General Administration Section Officer',
    department: 'General Administration',
    division: 'GEN Main Division',
    supportAccess: 'My Tickets only',
    email: 'gen.section@example.com',
  },
  {
    role: 'GEN Inward Desk',
    username: 'gen.inward',
    password: 'password123',
    name: 'General Administration Inward Desk',
    department: 'General Administration',
    division: 'GEN Main Division',
    supportAccess: 'My Tickets only',
    email: 'gen.inward@example.com',
  },
  {
    role: 'GEN Dispatcher',
    username: 'gen.dispatch',
    password: 'password123',
    name: 'General Administration Dispatcher',
    department: 'General Administration',
    division: 'GEN Main Division',
    supportAccess: 'My Tickets only',
    email: 'gen.dispatch@example.com',
  },
  {
    role: 'GEN Approval Authority',
    username: 'gen.approver',
    password: 'password123',
    name: 'General Administration Approval Authority',
    department: 'General Administration',
    division: 'GEN Main Division',
    supportAccess: 'My Tickets only',
    email: 'gen.approver@example.com',
  },
  // Finance
  {
    role: 'Finance Dept Admin',
    username: 'fin.admin',
    password: 'password123',
    name: 'Finance Department Admin',
    department: 'Finance',
    division: 'FIN Main Division',
    supportAccess: 'My Tickets only',
    email: 'fin.admin@example.com',
  },
  {
    role: 'Finance Section Officer',
    username: 'fin.section',
    password: 'password123',
    name: 'Finance Section Officer',
    department: 'Finance',
    division: 'FIN Main Division',
    supportAccess: 'My Tickets only',
    email: 'fin.section@example.com',
  },
  {
    role: 'Finance Inward Desk',
    username: 'fin.inward',
    password: 'password123',
    name: 'Finance Inward Desk',
    department: 'Finance',
    division: 'FIN Main Division',
    supportAccess: 'My Tickets only',
    email: 'fin.inward@example.com',
  },
  {
    role: 'Finance Dispatcher',
    username: 'fin.dispatch',
    password: 'password123',
    name: 'Finance Dispatcher',
    department: 'Finance',
    division: 'FIN Main Division',
    supportAccess: 'My Tickets only',
    email: 'fin.dispatch@example.com',
  },
  {
    role: 'Finance Approval Authority',
    username: 'fin.approver',
    password: 'password123',
    name: 'Finance Approval Authority',
    department: 'Finance',
    division: 'FIN Main Division',
    supportAccess: 'My Tickets only',
    email: 'fin.approver@example.com',
  },
  // Human Resources
  {
    role: 'HR Dept Admin',
    username: 'hr.admin',
    password: 'password123',
    name: 'Human Resources Admin',
    department: 'Human Resources',
    division: 'HR Main Division',
    supportAccess: 'My Tickets only',
    email: 'hr.admin@example.com',
  },
  {
    role: 'HR Section Officer',
    username: 'hr.section',
    password: 'password123',
    name: 'Human Resources Section Officer',
    department: 'Human Resources',
    division: 'HR Main Division',
    supportAccess: 'My Tickets only',
    email: 'hr.section@example.com',
  },
  {
    role: 'HR Inward Desk',
    username: 'hr.inward',
    password: 'password123',
    name: 'Human Resources Inward Desk',
    department: 'Human Resources',
    division: 'HR Main Division',
    supportAccess: 'My Tickets only',
    email: 'hr.inward@example.com',
  },
  {
    role: 'HR Dispatcher',
    username: 'hr.dispatch',
    password: 'password123',
    name: 'Human Resources Dispatcher',
    department: 'Human Resources',
    division: 'HR Main Division',
    supportAccess: 'My Tickets only',
    email: 'hr.dispatch@example.com',
  },
  {
    role: 'HR Approval Authority',
    username: 'hr.approver',
    password: 'password123',
    name: 'Human Resources Approval Authority',
    department: 'Human Resources',
    division: 'HR Main Division',
    supportAccess: 'My Tickets only',
    email: 'hr.approver@example.com',
  },
  // Operations
  {
    role: 'OPS Dept Admin',
    username: 'ops.admin',
    password: 'password123',
    name: 'Operations Department Admin',
    department: 'Operations',
    division: 'OPS Main Division',
    supportAccess: 'My Tickets only',
    email: 'ops.admin@example.com',
  },
  {
    role: 'OPS Section Officer',
    username: 'ops.section',
    password: 'password123',
    name: 'Operations Section Officer',
    department: 'Operations',
    division: 'OPS Main Division',
    supportAccess: 'My Tickets only',
    email: 'ops.section@example.com',
  },
  {
    role: 'OPS Inward Desk',
    username: 'ops.inward',
    password: 'password123',
    name: 'Operations Inward Desk',
    department: 'Operations',
    division: 'OPS Main Division',
    supportAccess: 'My Tickets only',
    email: 'ops.inward@example.com',
  },
  {
    role: 'OPS Dispatcher',
    username: 'ops.dispatch',
    password: 'password123',
    name: 'Operations Dispatcher',
    department: 'Operations',
    division: 'OPS Main Division',
    supportAccess: 'My Tickets only',
    email: 'ops.dispatch@example.com',
  },
  {
    role: 'OPS Approval Authority',
    username: 'ops.approver',
    password: 'password123',
    name: 'Operations Approval Authority',
    department: 'Operations',
    division: 'OPS Main Division',
    supportAccess: 'My Tickets only',
    email: 'ops.approver@example.com',
  },
  // IT Services
  {
    role: 'IT Dept Admin',
    username: 'it.admin',
    password: 'password123',
    name: 'IT Services Admin',
    department: 'IT Services',
    division: 'IT Main Division',
    supportAccess: 'My Tickets only',
    email: 'it.admin@example.com',
  },
  {
    role: 'IT Section Officer',
    username: 'it.section',
    password: 'password123',
    name: 'IT Services Section Officer',
    department: 'IT Services',
    division: 'IT Main Division',
    supportAccess: 'My Tickets only',
    email: 'it.section@example.com',
  },
  {
    role: 'IT Inward Desk',
    username: 'it.inward',
    password: 'password123',
    name: 'IT Services Inward Desk',
    department: 'IT Services',
    division: 'IT Main Division',
    supportAccess: 'My Tickets only',
    email: 'it.inward@example.com',
  },
  {
    role: 'IT Dispatcher',
    username: 'it.dispatch',
    password: 'password123',
    name: 'IT Services Dispatcher',
    department: 'IT Services',
    division: 'IT Main Division',
    supportAccess: 'My Tickets only',
    email: 'it.dispatch@example.com',
  },
  {
    role: 'IT Approval Authority',
    username: 'it.approver',
    password: 'password123',
    name: 'IT Services Approval Authority',
    department: 'IT Services',
    division: 'IT Main Division',
    supportAccess: 'My Tickets only',
    email: 'it.approver@example.com',
  },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTestAccounts, setShowTestAccounts] = useState(false);
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

  const fillTestAccount = (account: TestAccount) => {
    setUsername(account.username);
    setPassword(account.password);
    toast.info(`Filled: ${account.name}`);
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

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-zinc-50 px-3 text-zinc-500">Or continue with</span>
            </div>
          </div>

          {/* Test accounts */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowTestAccounts(!showTestAccounts)}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 hover:text-zinc-900 transition-colors text-sm font-medium"
            >
              Use a test account
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showTestAccounts ? 'rotate-180' : ''}`}
              />
            </button>
            {showTestAccounts && (
              <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2 max-h-[28rem] overflow-y-auto">
                <p className="text-xs text-zinc-500 px-1 pb-1 border-b border-zinc-200 mb-2">
                  Click to fill. Password: <code className="text-zinc-700">password123</code> (Super Admin: <code className="text-zinc-700">admin123</code>)
                </p>
                {testAccounts.map((account, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => fillTestAccount(account)}
                    className="w-full text-left px-3 py-3 rounded-md text-sm text-zinc-800 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex flex-col gap-1.5 border border-transparent hover:border-zinc-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{account.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono shrink-0">
                        {account.username}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <UserCircle className="h-3 w-3" />
                        {account.role}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {account.department} {account.division !== '—' ? ` · ${account.division}` : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                      <span className="flex items-center gap-1" title="Profile: view in sidebar after login">
                        <User className="h-3 w-3" />
                        Profile: name, email, stats in app
                      </span>
                      <span className="flex items-center gap-1" title={account.supportAccess}>
                        <LifeBuoy className="h-3 w-3" />
                        Support: {account.supportAccess}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 truncate">{account.email}</span>
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
