'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function ChangePasswordPage() {
  const { user, setAuth } = useAuthStore();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');

  const validate = () => {
    if (!passwordData.currentPassword) {
      toast.error('Enter your current password (temporary password from support)');
      return false;
    }
    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return false;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !validate()) return;
    setSaving(true);
    try {
      await api.put(`/users/${user.id}/password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      const updated = await api.get(`/users/${user.id}`);
      const u = updated.data;
      setAuth(
        {
          ...user,
          mustChangePassword: u.mustChangePassword ?? false,
          profileCompletedAt: u.profileCompletedAt ?? null,
        },
        localStorage.getItem('token') || ''
      );
      toast.success('Password changed. Please complete your staff profile.');
      router.replace('/profile/complete');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message || 'Failed to change password. Check current password.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Change temporary password</h1>
        <p className="text-muted-foreground mt-1">
          Enter the temporary password given by your support team, then choose a new password.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Set new password
            </CardTitle>
            <CardDescription>
              You will be asked to complete your staff profile next.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {passwordError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password (temporary)</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => {
                  setPasswordData({ ...passwordData, currentPassword: e.target.value });
                  setPasswordError('');
                }}
                placeholder="Enter temporary password"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => {
                  setPasswordData({ ...passwordData, newPassword: e.target.value });
                  setPasswordError('');
                }}
                placeholder="At least 6 characters"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => {
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value });
                  setPasswordError('');
                }}
                placeholder="Confirm new password"
                required
                autoComplete="new-password"
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Changing...' : 'Change password & continue'}
          </Button>
        </div>
      </form>
    </div>
  );
}
