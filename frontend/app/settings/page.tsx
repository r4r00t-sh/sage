'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { getRoles } from '@/lib/auth-utils';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import api from '@/lib/api';
import { 
  Settings, 
  User, 
  Lock, 
  Palette, 
  Loader2, 
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Shield,
  Building2,
  MapPin,
  Camera,
  Upload,
  Languages,
} from 'lucide-react';
import { useLocaleStore } from '@/lib/store';
import { getTranslation } from '@/lib/i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAvatarUrl } from '@/lib/avatar';

export default function SettingsPage() {
  const router = useRouter();
  const { user, setAuth } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocaleStore();
  const t = (key: string) => getTranslation(locale, key);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarUrl = useAvatarUrl(user?.id, user?.avatarKey);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      fetchUserDetails();
    }
  }, [user]);

  const fetchUserDetails = async () => {
    try {
      const response = await api.get(`/users/${user?.id}`);
      setEmail(response.data.email || '');
      if (user && response.data.avatarKey !== undefined) {
        setAuth({ ...user, avatarKey: response.data.avatarKey }, localStorage.getItem('token') || '');
      }
    } catch (error) {
      console.error('Failed to fetch user details');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a JPEG, PNG, GIF, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB.');
      return;
    }
    setAvatarLoading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await api.post(`/users/${user.id}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const userRes = await api.get(`/users/${user.id}`);
      setAuth({ ...user, avatarKey: userRes.data.avatarKey }, localStorage.getItem('token') || '');
      toast.success('Avatar updated successfully');
      e.target.value = '';
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to upload avatar');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.put(`/users/${user?.id}`, { name, email });
      toast.success('Profile updated successfully');
      if (user) {
        setAuth({ ...user, name, email }, localStorage.getItem('token') || '');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);

    try {
      await api.put(`/users/${user?.id}/password`, {
        currentPassword,
        newPassword,
      });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'destructive';
      case 'DEPT_ADMIN': return 'default';
      case 'SECTION_OFFICER': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <Button variant="ghost" className="mb-8 -ml-2 h-11 px-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-5 w-5" />
          {t('back')}
        </Button>
        
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Settings className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('settings')}</h1>
            <p className="text-muted-foreground text-lg mt-2">
              {t('manageAccountPreferences')}
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal layout: Main content + Sidebar side by side */}
      <div className="flex flex-col xl:flex-row gap-10 xl:gap-12">
        {/* Main Settings - wider area */}
        <div className="flex-1 min-w-0 space-y-10">
          {/* Profile + Password side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Profile Settings */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl flex items-center gap-3">
                  <User className="h-6 w-6" />
                  {t('profileInformation')}
                </CardTitle>
                <CardDescription className="text-base">
                  Update your personal information and details
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Avatar upload */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                  <label className="relative group cursor-pointer block" htmlFor="avatar-upload">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={avatarUrl ?? undefined} alt={user?.name} />
                      <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      {avatarLoading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                      ) : (
                        <Camera className="h-8 w-8 text-white" />
                      )}
                    </span>
                  </label>
                  <input
                    id="avatar-upload"
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={avatarLoading}
                  />
                  <div>
                    <p className="font-medium">Profile photo</p>
                    <p className="text-sm text-muted-foreground mb-2">JPEG, PNG, GIF or WebP. Max 2MB.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={avatarLoading}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {avatarLoading ? 'Uploading...' : 'Change photo'}
                    </Button>
                  </div>
                </div>
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="username" className="text-base font-medium">Username</Label>
                    <Input 
                      id="username" 
                      value={user?.username || ''} 
                      disabled 
                      className="h-12 bg-muted text-base"
                    />
                    <p className="text-sm text-muted-foreground">
                      Username cannot be changed after account creation
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-base font-medium">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-base font-medium">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="h-12 text-base"
                    />
                  </div>
                  <Button type="submit" size="lg" disabled={loading} className="min-w-[160px] h-12 text-base">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Password Settings */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl flex items-center gap-3">
                  <Lock className="h-6 w-6" />
                  {t('changePassword')}
                </CardTitle>
                <CardDescription className="text-base">
                  Update your account password to keep it secure
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <form onSubmit={handleChangePassword} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="currentPassword" className="text-base font-medium">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="h-12 text-base"
                    />
                  </div>
                  <Separator className="my-6" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor="newPassword" className="text-base font-medium">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="h-12 text-base"
                      />
                      <p className="text-sm text-muted-foreground">
                        At least 6 characters
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="confirmPassword" className="text-base font-medium">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="h-12 text-base"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    size="lg" 
                    disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword} 
                    className="min-w-[180px] h-12 text-base"
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Language */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl flex items-center gap-3">
                <Languages className="h-6 w-6" />
                {t('language')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('languageDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    className={`flex flex-row items-center gap-5 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      locale === 'en' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted-foreground/20'
                    }`}
                    onClick={() => setLocale('en')}
                  >
                    <div className="h-14 w-14 shrink-0 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">En</span>
                    </div>
                    <div>
                      <span className="font-semibold text-base block">{t('english')}</span>
                      <span className="text-sm text-muted-foreground">Default</span>
                    </div>
                  </div>
                  <div
                    className={`flex flex-row items-center gap-5 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      locale === 'ml' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted-foreground/20'
                    }`}
                    onClick={() => setLocale('ml')}
                  >
                    <div className="h-14 w-14 shrink-0 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400" style={locale === 'ml' ? { fontFamily: 'Manjari, sans-serif' } : undefined}>മ</span>
                    </div>
                    <div>
                      <span className="font-semibold text-base block" style={locale === 'ml' ? { fontFamily: 'Manjari, sans-serif' } : undefined}>{t('malayalam')}</span>
                      <span className="text-sm text-muted-foreground">Manjari font</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance - full width, more spacious */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl flex items-center gap-3">
                <Palette className="h-6 w-6" />
                {t('appearance')}
              </CardTitle>
              <CardDescription className="text-base">
                Customize how the application looks on your device
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-6">
                <Label className="text-base font-medium">{t('colorTheme')}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div
                    className={`flex flex-row items-center gap-5 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      theme === 'light' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted-foreground/20'
                    }`}
                    onClick={() => setTheme('light')}
                  >
                    <div className="h-14 w-14 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Sun className="h-7 w-7 text-amber-600" />
                    </div>
                    <div>
                      <span className="font-semibold text-base block">{t('light')}</span>
                      <span className="text-sm text-muted-foreground">Bright, clean interface</span>
                    </div>
                  </div>
                  <div
                    className={`flex flex-row items-center gap-5 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      theme === 'dark' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted-foreground/20'
                    }`}
                    onClick={() => setTheme('dark')}
                  >
                    <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-800 flex items-center justify-center">
                      <Moon className="h-7 w-7 text-slate-200" />
                    </div>
                    <div>
                      <span className="font-semibold text-base block">{t('dark')}</span>
                      <span className="text-sm text-muted-foreground">Easy on the eyes</span>
                    </div>
                  </div>
                  <div
                    className={`flex flex-row items-center gap-5 p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      theme === 'system' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted-foreground/20'
                    }`}
                    onClick={() => setTheme('system')}
                  >
                    <div className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-amber-100 to-slate-800 flex items-center justify-center">
                      <Monitor className="h-7 w-7 text-slate-600" />
                    </div>
                    <div>
                      <span className="font-semibold text-base block">{t('system')}</span>
                      <span className="text-sm text-muted-foreground">Match your device</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Account info + Help */}
        <div className="xl:w-[360px] xl:shrink-0 space-y-8">
          {/* Account Info */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">{t('accountDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-lg truncate">{user?.name}</p>
                  <p className="text-muted-foreground truncate">@{user?.username}</p>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">{t('role')}</p>
                    <Badge variant={getRoleBadgeVariant(getRoles(user)[0] || '')} className="text-sm">
                      {getRoles(user).map((r) => r.replace('_', ' ')).join(', ')}
                    </Badge>
                  </div>
                </div>

                {user?.departmentId && (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground mb-1">{t('department')}</p>
                      <p className="font-medium">Finance</p>
                    </div>
                  </div>
                )}

                {user?.divisionId && (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground mb-1">{t('division')}</p>
                      <p className="font-medium">Budget Section</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card className="bg-muted/50 overflow-hidden">
            <CardContent className="p-8">
              <h3 className="font-semibold text-lg mb-3">{t('needHelp')}</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                If you&apos;re having trouble with your account or have questions, contact your system administrator.
              </p>
              <Button variant="outline" size="lg" className="w-full h-12">
                {t('contactSupport')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
