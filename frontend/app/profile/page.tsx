'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import { useAvatarUrl } from '@/lib/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  Mail,
  Building2,
  Shield,
  Trophy,
  Calendar,
  Clock,
  Edit,
  Camera,
  Save,
  X,
  CheckCircle,
  TrendingUp,
  FileText,
  Award,
  Zap,
  Gauge,
  AlertTriangle,
  Timer,
  FileStack,
  Star,
} from 'lucide-react';
import { ActivityHeatmap } from '@/components/activity-heatmap';
import {
  StaffProfileForm,
  staffProfileFromUser,
  staffProfileToPayload,
  type StaffProfileFormData,
} from '@/components/staff-profile-form';
import api from '@/lib/api';
import { getRoles } from '@/lib/auth-utils';
import { DepartmentProfileLink, DivisionProfileLink } from '@/components/profile-links';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  departmentId?: string;
  divisionId?: string;
  department?: { id?: string; name: string };
  division?: { id?: string; name: string };
  createdAt: string;
  bio?: string;
  phone?: string;
  designation?: string;
  staffId?: string;
  avatar?: string;
  avatarKey?: string | null;
}

interface UserStats {
  filesCreated: number;
  filesProcessed: number;
  filesApproved: number;
  currentStreak?: number;
  achievements: Achievement[];
  recentActivity: Activity[];
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

interface MyPerformance {
  performanceScore: number;
  completedFiles: number;
  redListedFiles: number;
  extensionRequests: number;
  avgProcessingTimeHours: number | null;
  totalFilesCreated: number;
  totalFilesAssigned: number;
}

export default function ProfilePage() {
  const { user, setAuth } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarUrl = useAvatarUrl(profile?.id, profile?.avatarKey ?? user?.avatarKey);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [myPerformance, setMyPerformance] = useState<MyPerformance | null>(null);
  const [activityHeatmap, setActivityHeatmap] = useState<{
    contributions: Record<string, number>;
    totalContributions: number;
    year: number;
  } | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [staffFormData, setStaffFormData] = useState<StaffProfileFormData | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
      fetchPerformance();
    }
  }, [user]);

  const fetchPerformance = async () => {
    if (!user?.id) return;
    setPerformanceLoading(true);
    try {
      const year = new Date().getFullYear();
      const [perfRes, heatmapRes] = await Promise.all([
        api.get('/analytics/my-performance'),
        api.get('/analytics/my-activity-heatmap', { params: { year } }),
      ]);
      setMyPerformance(perfRes.data);
      setActivityHeatmap(heatmapRes.data);
    } catch {
      setMyPerformance(null);
      setActivityHeatmap(null);
    } finally {
      setPerformanceLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await api.get(`/users/${user?.id}`);
      setProfile(response.data);
      setStaffFormData(staffProfileFromUser(response.data));
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get(`/users/${user?.id}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user?.id || !staffFormData) return;
    setSaving(true);
    try {
      await api.put(`/users/${user?.id}`, staffProfileToPayload(staffFormData));
      toast.success('Profile updated successfully');
      setEditing(false);
      fetchProfile();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to update profile', {
        description: err.response?.data?.message,
      });
    } finally {
      setSaving(false);
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
      if (profile) setProfile({ ...profile, avatarKey: userRes.data.avatarKey });
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

  const handleCancel = () => {
    setEditing(false);
    if (profile) setStaffFormData(staffProfileFromUser(profile as unknown as Record<string, unknown>));
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      DEVELOPER: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      SUPER_ADMIN: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
      DEPT_ADMIN: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
      SECTION_OFFICER: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
      INWARD_DESK: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
    };
    return colors[role] || 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-48 bg-gradient-to-r from-primary/20 to-primary/5 rounded-lg animate-pulse" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-8">
      {/* Header Card with Cover */}
      <Card className="overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-primary via-primary/80 to-primary/60 relative">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        </div>
        <CardContent className="relative pt-0 pb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-16">
            {/* Avatar */}
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                <AvatarImage src={avatarUrl ?? profile.avatar} alt={profile.name} />
                <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarLoading}
              >
                {avatarLoading ? (
                  <span className="h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
              <input
                id="profile-avatar-upload"
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={avatarLoading}
              />
            </div>

            {/* User Info */}
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-3xl font-bold">{profile.name}</h1>
                <p className="text-muted-foreground flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {getRoles(profile).map((r) => (
                  <Badge key={r} variant="outline" className={cn('px-3 py-1', getRoleBadgeColor(r))}>
                    <Shield className="h-3 w-3 mr-1" />
                    {r.replace('_', ' ')}
                  </Badge>
                ))}
                {profile.department && (
                  <Badge variant="outline" className="px-3 py-1">
                    <Building2 className="h-3 w-3 mr-1" />
                    {profile.department.name}
                  </Badge>
                )}
                {myPerformance && (
                  <Badge variant="secondary" className="px-3 py-1">
                    <Trophy className="h-3 w-3 mr-1 text-amber-500" />
                    {Array.from({ length: 5 }).map((_, i) => {
                      const normalized = Math.max(
                        0,
                        Math.min(1, (myPerformance.performanceScore || 0) / 100),
                      );
                      const stars = Math.round(normalized * 5);
                      return (
                        <Star
                          key={i}
                          className={cn(
                            'h-3 w-3 inline-block',
                            i < stars ? 'text-amber-500' : 'text-muted-foreground/30',
                          )}
                          fill={i < stars ? 'currentColor' : 'none'}
                        />
                      );
                    })}
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {!editing ? (
                <Button onClick={() => setEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={saving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Files Created</p>
                <p className="text-3xl font-bold">{stats?.filesCreated || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Files Processed</p>
                <p className="text-3xl font-bold">{stats?.filesProcessed || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Rating</p>
                {myPerformance && (
                  <>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const normalized = Math.max(
                          0,
                          Math.min(1, (myPerformance.performanceScore || 0) / 100),
                        );
                        const stars = Math.round(normalized * 5);
                        return (
                          <Star
                            key={i}
                            className={cn(
                              'h-5 w-5',
                              i < stars ? 'text-amber-500' : 'text-muted-foreground/20',
                            )}
                            fill={i < stars ? 'currentColor' : 'none'}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(myPerformance.performanceScore / 20).toFixed(1)} / 5
                    </p>
                  </>
                )}
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Current Streak</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.currentStreak || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="staff">Staff profile</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Personal Information summary */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Your account details and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <p className="text-sm font-medium">{profile.name || [staffFormData?.firstName, staffFormData?.middleName, staffFormData?.lastName].filter(Boolean).join(' ') || '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <p className="text-sm font-medium">{profile.email || staffFormData?.email || '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <p className="text-sm font-medium">{profile.phone || staffFormData?.phone || '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <p className="text-sm font-medium">{profile.designation || staffFormData?.designation || '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Staff ID</Label>
                  <p className="text-sm font-medium">{profile.staffId || staffFormData?.staffId || '—'}</p>
                </div>
                <div className="space-y-2">
                  <Label>Bio</Label>
                  <p className="text-sm font-medium whitespace-pre-wrap">{profile.bio || staffFormData?.bio || '—'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Account Information (Overview) */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your role and department details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Username</p>
                      <p className="text-sm text-muted-foreground">{profile.username}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Role</p>
                      <p className="text-sm text-muted-foreground">{getRoles(profile).map((r) => r.replace('_', ' ')).join(', ')}</p>
                    </div>
                  </div>
                </div>

                {profile.department && (
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Department</p>
                        <p className="text-sm text-muted-foreground">
                          {profile.department.id ? (
                            <DepartmentProfileLink departmentId={profile.department.id} name={profile.department.name} />
                          ) : (
                            profile.department.name
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {profile.division && (
                  <div className="flex items-center justify-between py-3 border-b">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Division</p>
                        <p className="text-sm text-muted-foreground">
                          {profile.department?.id && profile.division?.id ? (
                            <DivisionProfileLink departmentId={profile.department.id} divisionId={profile.division.id} name={profile.division.name} />
                          ) : (
                            profile.division.name
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Member Since</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(profile.createdAt), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Staff profile tab */}
        <TabsContent value="staff" className="space-y-6">
          {staffFormData && (
            <>
              <div className="flex justify-end gap-2">
                {!editing ? (
                  <Button onClick={() => setEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit profile
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => handleSave()} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button variant="outline" onClick={handleCancel} disabled={saving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                )}
              </div>
              <StaffProfileForm
                data={staffFormData}
                onChange={setStaffFormData}
                disabled={!editing}
                onSubmit={handleSave}
                saving={saving}
                submitLabel="Save profile"
                showSubmit={false}
              />
            </>
          )}
        </TabsContent>

        {/* Performance analytics tab */}
        <TabsContent value="performance" className="space-y-6">
          {performanceLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Gauge className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Performance Score</p>
                        <p className="text-2xl font-bold">{myPerformance?.performanceScore ?? '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Files Completed</p>
                        <p className="text-2xl font-bold">{myPerformance?.completedFiles ?? '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Red Listed</p>
                        <p className="text-2xl font-bold">{myPerformance?.redListedFiles ?? '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Timer className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg. Time (hrs)</p>
                        <p className="text-2xl font-bold">
                          {myPerformance?.avgProcessingTimeHours != null
                            ? myPerformance.avgProcessingTimeHours
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <FileStack className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Extension Requests</p>
                        <p className="text-2xl font-bold">{myPerformance?.extensionRequests ?? '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Files Assigned (total)</p>
                        <p className="text-2xl font-bold">{myPerformance?.totalFilesAssigned ?? '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              {activityHeatmap && (
                <Card>
                  <CardHeader>
                    <CardTitle>Activity</CardTitle>
                    <CardDescription>
                      File-related activity in {activityHeatmap.year} — {activityHeatmap.totalContributions} actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ActivityHeatmap
                      contributions={activityHeatmap.contributions}
                      totalContributions={activityHeatmap.totalContributions}
                      year={activityHeatmap.year}
                      scopeLabel="your"
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your recent actions and contributions</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {stats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{activity.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements">
          <Card>
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Your earned badges and milestones</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.achievements && stats.achievements.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {stats.achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Award className="h-6 w-6 text-amber-500" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{achievement.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {achievement.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Earned {formatDistanceToNow(new Date(achievement.earnedAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Award className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No achievements yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Keep working to earn your first achievement!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
