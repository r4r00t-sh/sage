'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  FileText,
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  Building2,
  Target,
  Award,
  Timer,
  Zap,
  Activity,
  PieChart,
  Calendar,
  Gauge,
  GitBranch,
} from 'lucide-react';
import { ActivityHeatmap } from '@/components/activity-heatmap';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { hasRole, hasGodRole } from '@/lib/auth-utils';
import { format } from 'date-fns';

interface DashboardAnalytics {
  summary: {
    totalFiles: number;
    pendingFiles: number;
    inProgressFiles: number;
    completedFiles: number;
    rejectedFiles: number;
    redListedFiles: number;
    onHoldFiles: number;
    totalUsers: number;
    activeUsersToday: number;
    avgProcessingTimeHours: number | null;
    completionRate: number;
    redListRate: number;
  };
  filesByPriority: { priority: string; count: number }[];
  filesByPriorityCategory: { category: string; count: number }[];
  extensionStats: { status: string; count: number }[];
}

interface UserPerformance {
  id: string;
  name: string;
  username: string;
  role: string;
  department: string;
  division: string;
  currentPoints: number;
  basePoints: number;
  streakMonths: number;
  totalFilesAssigned: number;
  completedFiles: number;
  redListedFiles: number;
  performanceScore: number;
}

interface DepartmentAnalytics {
  id: string;
  name: string;
  code: string;
  totalFiles: number;
  totalUsers: number;
  pendingFiles: number;
  completedFiles: number;
  redListedFiles: number;
  avgProcessingTimeHours: number | null;
  avgUserPoints: number;
  efficiency: number;
}

interface BottleneckData {
  userBottlenecks: { userId: string; userName: string; department: string; pendingFiles: number }[];
  divisionBottlenecks: { divisionId: string; divisionName: string; department: string; pendingFiles: number }[];
  overdueFiles: {
    id: string;
    fileNumber: string;
    subject: string;
    assignedTo: string;
    daysOverdue: number;
  }[];
}

export default function AnalyticsDashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');
  
  const [dashboardData, setDashboardData] = useState<DashboardAnalytics | null>(null);
  const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([]);
  const [departmentAnalytics, setDepartmentAnalytics] = useState<DepartmentAnalytics[]>([]);
  const [bottleneckData, setBottleneckData] = useState<BottleneckData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activityScope, setActivityScope] = useState<'user' | 'department'>('user');
  const [activityYear, setActivityYear] = useState(new Date().getFullYear());
  const [activityData, setActivityData] = useState<{
    contributions: Record<string, number>;
    totalContributions: number;
    year: number;
  } | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchActivityHeatmap = async () => {
    setActivityLoading(true);
    try {
      const res = await api.get('/analytics/activity-heatmap', {
        params: { scope: activityScope, year: activityYear },
      });
      setActivityData(res.data);
    } catch {
      setActivityData({ contributions: {}, totalContributions: 0, year: activityYear });
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityHeatmap();
  }, [activityScope, activityYear]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [dashRes, userRes, bottleRes] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/analytics/users'),
        api.get('/analytics/bottlenecks'),
      ]);
      
      setDashboardData(dashRes.data);
      setUserPerformance(userRes.data);
      setBottleneckData(bottleRes.data);
      
      // Only super admin can see all departments
      if (hasGodRole(user)) {
        const deptRes = await api.get('/analytics/departments');
        setDepartmentAnalytics(deptRes.data);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to load analytics', {
        description: err.response?.data?.message || 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (type: string) => {
    setExporting(true);
    try {
      const response = await api.get(`/analytics/report/export?type=${type}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `efiling-report-${type}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report exported successfully');
    } catch {
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const summary = dashboardData?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive insights into file processing and user performance
          </p>
        </div>
        
        <div className="flex gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={() => router.push('/admin/analytics/desk-performance')}
          >
            <Gauge className="mr-2 h-4 w-4" />
            Desk Performance
          </Button>
          
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          
          <Select onValueChange={exportReport} disabled={exporting}>
            <SelectTrigger className="w-[160px]">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="summary">Summary Report</SelectItem>
              <SelectItem value="detailed">Detailed Files</SelectItem>
              <SelectItem value="user_performance">User Performance</SelectItem>
              <SelectItem value="department">Department Report</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Files</p>
                <p className="text-3xl font-bold text-blue-600">{summary?.totalFiles || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.completionRate || 0}% completion rate
                </p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                <FileText className="h-7 w-7 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{summary?.pendingFiles || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  + {summary?.inProgressFiles || 0} in progress
                </p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-7 w-7 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Red Listed</p>
                <p className="text-3xl font-bold text-red-600">{summary?.redListedFiles || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.redListRate || 0}% of total
                </p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Processing</p>
                <p className="text-3xl font-bold text-green-600">
                  {summary?.avgProcessingTimeHours ? `${summary.avgProcessingTimeHours}h` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.completedFiles || 0} completed
                </p>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-green-500/20 flex items-center justify-center">
                <Timer className="h-7 w-7 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-[700px]">
          <TabsTrigger value="overview" className="gap-2">
            <PieChart className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <Building2 className="h-4 w-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="bottlenecks" className="gap-2">
            <Activity className="h-4 w-4" />
            Bottlenecks
          </TabsTrigger>
        </TabsList>

        {/* Activity Tab - GitHub-style contribution heatmap */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                File activity
              </CardTitle>
              <CardDescription>
                Contributions from file actions (create, forward, approve, etc.). View by user or department.
              </CardDescription>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Select
                  value={activityScope}
                  onValueChange={(v) => setActivityScope(v as 'user' | 'department')}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">My activity</SelectItem>
                    <SelectItem value="department">My department</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={String(activityYear)}
                  onValueChange={(v) => setActivityYear(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(
                      (y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={fetchActivityHeatmap}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(activityData || activityLoading) && (
                <ActivityHeatmap
                  contributions={activityData?.contributions ?? {}}
                  totalContributions={activityData?.totalContributions ?? 0}
                  year={activityData?.year ?? activityYear}
                  scopeLabel={activityScope === 'user' ? 'My activity' : 'Department'}
                  loading={activityLoading}
                />
              )}
              {!activityData && !activityLoading && (
                <p className="text-muted-foreground py-8 text-center">No activity data.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Files by Priority */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Files by Priority
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboardData?.filesByPriority.map((item) => (
                  <div key={item.priority} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{item.priority.toLowerCase()}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <Progress 
                      value={(item.count / (summary?.totalFiles || 1)) * 100} 
                      className={cn(
                        "h-2",
                        item.priority === 'URGENT' && '[&>div]:bg-red-500',
                        item.priority === 'HIGH' && '[&>div]:bg-orange-500',
                        item.priority === 'NORMAL' && '[&>div]:bg-blue-500',
                        item.priority === 'LOW' && '[&>div]:bg-slate-500',
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Files by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Files by Priority Category
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboardData?.filesByPriorityCategory.map((item) => (
                  <div key={item.category} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{item.category.toLowerCase()}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <Progress 
                      value={(item.count / (summary?.totalFiles || 1)) * 100}
                      className={cn(
                        "h-2",
                        item.category === 'IMMEDIATE' && '[&>div]:bg-red-500',
                        item.category === 'URGENT' && '[&>div]:bg-orange-500',
                        item.category === 'ROUTINE' && '[&>div]:bg-blue-500',
                        item.category === 'PROJECT' && '[&>div]:bg-green-500',
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Active Users */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="relative">
                    <div className="text-center">
                      <p className="text-5xl font-bold text-primary">
                        {summary?.activeUsersToday || 0}
                      </p>
                      <p className="text-muted-foreground mt-2">Active Today</p>
                    </div>
                    <div className="absolute -right-16 top-1/2 -translate-y-1/2">
                      <p className="text-2xl font-semibold text-muted-foreground">
                        / {summary?.totalUsers || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Users</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <Progress 
                    value={((summary?.activeUsersToday || 0) / (summary?.totalUsers || 1)) * 100}
                    className="h-3"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Extension Requests Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Extension Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {dashboardData?.extensionStats.map((stat) => (
                    <div 
                      key={stat.status} 
                      className={cn(
                        "p-4 rounded-lg text-center",
                        stat.status === 'pending' && 'bg-amber-500/10',
                        stat.status === 'approved' && 'bg-green-500/10',
                        stat.status === 'denied' && 'bg-red-500/10',
                      )}
                    >
                      <p className="text-2xl font-bold">{stat.count}</p>
                      <p className="text-xs text-muted-foreground capitalize">{stat.status}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Performance Leaderboard</CardTitle>
              <CardDescription>Top performers based on file processing and points</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Rank</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Red Listed</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userPerformance.slice(0, 20).map((user, index) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm",
                          index === 0 && 'bg-yellow-500 text-white',
                          index === 1 && 'bg-gray-400 text-white',
                          index === 2 && 'bg-orange-600 text-white',
                          index > 2 && 'bg-muted',
                        )}>
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{user.department || '-'}</p>
                          <p className="text-xs text-muted-foreground">{user.division || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Award className="h-4 w-4 text-primary" />
                          <span className="font-medium">{user.currentPoints}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600">
                          {user.completedFiles}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {user.redListedFiles > 0 ? (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600">
                            {user.redListedFiles}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600">
                            0
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress 
                            value={user.performanceScore} 
                            className="w-16 h-2"
                          />
                          <span className="font-medium w-8">{user.performanceScore}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-6">
          {hasGodRole(user) ? (
            <div className="grid gap-4">
              {departmentAnalytics.map((dept) => (
                <Card key={dept.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{dept.name}</h3>
                          <p className="text-sm text-muted-foreground">{dept.code}</p>
                        </div>
                      </div>
                      <Badge 
                        variant="outline"
                        className={cn(
                          dept.efficiency >= 80 && 'bg-green-500/10 text-green-600',
                          dept.efficiency >= 50 && dept.efficiency < 80 && 'bg-amber-500/10 text-amber-600',
                          dept.efficiency < 50 && 'bg-red-500/10 text-red-600',
                        )}
                      >
                        {dept.efficiency}% Efficiency
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{dept.totalFiles}</p>
                        <p className="text-xs text-muted-foreground">Total Files</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-amber-500/10">
                        <p className="text-2xl font-bold text-amber-600">{dept.pendingFiles}</p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-green-500/10">
                        <p className="text-2xl font-bold text-green-600">{dept.completedFiles}</p>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-red-500/10">
                        <p className="text-2xl font-bold text-red-600">{dept.redListedFiles}</p>
                        <p className="text-xs text-muted-foreground">Red Listed</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-blue-500/10">
                        <p className="text-2xl font-bold text-blue-600">{dept.totalUsers}</p>
                        <p className="text-xs text-muted-foreground">Users</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-purple-500/10">
                        <p className="text-2xl font-bold text-purple-600">{dept.avgUserPoints}</p>
                        <p className="text-xs text-muted-foreground">Avg Points</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Department-wide analytics are only available to Super Admins.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Bottlenecks Tab */}
        <TabsContent value="bottlenecks" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* User Bottlenecks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <Users className="h-5 w-5" />
                  User Bottlenecks
                </CardTitle>
                <CardDescription>Users with most pending files</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bottleneckData?.userBottlenecks.map((item, index) => (
                    <div 
                      key={item.userId}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{item.userName}</p>
                          <p className="text-xs text-muted-foreground">{item.department}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                        {item.pendingFiles} pending
                      </Badge>
                    </div>
                  ))}
                  {(!bottleneckData?.userBottlenecks || bottleneckData.userBottlenecks.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No bottlenecks detected</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Division Bottlenecks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <Building2 className="h-5 w-5" />
                  Division Bottlenecks
                </CardTitle>
                <CardDescription>Divisions with most pending files</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bottleneckData?.divisionBottlenecks.map((item, index) => (
                    <div 
                      key={item.divisionId}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{item.divisionName}</p>
                          <p className="text-xs text-muted-foreground">{item.department}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
                        {item.pendingFiles} pending
                      </Badge>
                    </div>
                  ))}
                  {(!bottleneckData?.divisionBottlenecks || bottleneckData.divisionBottlenecks.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No bottlenecks detected</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overdue Files */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Overdue Files
              </CardTitle>
              <CardDescription>Files that have exceeded their due dates</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Number</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Days Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bottleneckData?.overdueFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <code className="text-sm font-mono">{file.fileNumber}</code>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {file.subject}
                      </TableCell>
                      <TableCell>{file.assignedTo || 'Unassigned'}</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            file.daysOverdue && file.daysOverdue > 7 
                              ? 'bg-red-500/20 text-red-600' 
                              : 'bg-amber-500/20 text-amber-600'
                          )}
                        >
                          {file.daysOverdue || 0} days
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!bottleneckData?.overdueFiles || bottleneckData.overdueFiles.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No overdue files
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
