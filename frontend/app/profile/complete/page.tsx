'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import {
  StaffProfileForm,
  staffProfileFromUser,
  staffProfileToPayload,
  getEmptyStaffProfileFormData,
  type StaffProfileFormData,
} from '@/components/staff-profile-form';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function CompleteProfilePage() {
  const { user, setAuth } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<StaffProfileFormData>(getEmptyStaffProfileFormData());

  useEffect(() => {
    if (!user?.id) return;
    api
      .get(`/users/${user.id}`)
      .then((res) => {
        const d = res.data;
        const completedAt = d.profileCompletedAt != null && d.profileCompletedAt !== ''
          ? (typeof d.profileCompletedAt === 'string' ? d.profileCompletedAt : new Date(d.profileCompletedAt).toISOString())
          : null;
        if (completedAt) {
          setAuth({ ...user, ...d, profileCompletedAt: completedAt }, localStorage.getItem('token') || '');
          router.replace('/dashboard');
          return;
        }
        setFormData(staffProfileFromUser(d));
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [user?.id, setAuth, router]);

  const validate = (data: StaffProfileFormData) => {
    if (![data.firstName.trim(), data.lastName.trim()].every(Boolean)) {
      toast.error('First name and last name are required');
      return false;
    }
    if (!data.email?.trim()) {
      toast.error('Official email is required');
      return false;
    }
    if (!data.staffId?.trim()) {
      toast.error('Staff ID is required');
      return false;
    }
    if (!data.designation?.trim()) {
      toast.error('Designation is required');
      return false;
    }
    if (!data.phone?.trim()) {
      toast.error('Primary phone is required');
      return false;
    }
    if (!data.dateOfJoining?.trim()) {
      toast.error('Date of joining is required');
      return false;
    }
    if (!data.emergencyContactName?.trim() || !data.emergencyContactPhone?.trim()) {
      toast.error('Emergency contact name and phone are required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !validate(formData)) return;
    setSaving(true);
    try {
      const payload = staffProfileToPayload(formData) as Record<string, unknown>;
      payload.profileCompletedAt = true;
      await api.put(`/users/${user.id}`, payload);
      const updated = await api.get(`/users/${user.id}`);
      const u = updated.data;
      setAuth(
        {
          ...user,
          name: u.name,
          email: u.email,
          profileCompletedAt: u.profileCompletedAt ?? new Date().toISOString(),
        },
        localStorage.getItem('token') || ''
      );
      toast.success('Profile completed. You can now use the platform.');
      router.replace('/dashboard');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Complete your staff profile</h1>
        <p className="text-muted-foreground mt-1">
          Fill in your details below. You can edit these later from your profile page.
        </p>
      </div>

      <StaffProfileForm
        data={formData}
        onChange={setFormData}
        onSubmit={handleSubmit}
        saving={saving}
        submitLabel="Complete profile"
        markComplete
        showSubmit
      />
    </div>
  );
}
