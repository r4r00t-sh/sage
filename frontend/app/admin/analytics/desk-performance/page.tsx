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
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
  AlertTriangle,
  Gauge,
  Clock,
  FileText,
  BarChart3,
  Map,
  Calendar,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { hasRole } from '@/lib/auth-utils';

interface ExecutiveDashboard {
  ticker: {
    globalBacklogCount: number;
    avgProcessingSpeedHours: number;
    totalThroughputToday: number;
  };
  leaderboard: Array<{
    deskId: string;
    deskName: string;
    deskCode: string;
    department: string;
    velocityScore: number;
    overallScore: number;
    category: string;
  }>;
  watchlist: Array<{
    deskId: string;
    deskName: string;
    deskCode: string;
    department: string;
    reason: string;
  }>;
}

interface HeatmapData {
  timeRange: 'daily' | 'weekly';
  period: { from: string; to: string };
  heatmapData: Array<{
    deskId: string;
    deskName: string;
    deskCode: string;
    timeSlots: Array<{
      time: string;
      fbr: number;
      color: 'green' | 'yellow' | 'red';
      inflow: number;
      outflow: number;
    }>;
  }>;
}

interface AgingBucket {
  totalPending: number;
  buckets: {
    fresh: { label: string; count: number; files: any[] };
    standard: { label: string; count: number; files: any[] };
    delayed: { label: string; count: number; files: any[] };
    critical: { label: string; count: number; files: any[] };
  };
}

interface RedListMorgue {
  total: number;
  byEscalationLevel: {
    level1: { count: number; files: any[] };
    level2: { count: number; files: any[] };
    level3: { count: number; files: any[] };
  };
  byReason: Array<{ reason: string; count: number; files: any[] }>;
  allFiles: any[];
}

export default function DeskPerformancePage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('executive');
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly'>('daily');
  
  const [executiveDashboard, setExecutiveDashboard] = useState<ExecutiveDashboard | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [agingBuckets, setAgingBuckets] = useState<AgingBucket | null>(null);
  const [redListMorgue, setRedListMorgue] = useState<RedListMorgue | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab, timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'executive') {
        const res = await api.get('/analytics/executive-dashboard');
        setExecutiveDashboard(res.data);
      } else if (activeTab === 'heatmap') {
        const res = await api.get(`/analytics/heatmap?timeRange=${timeRange}`);
        setHeatmapData(res.data);
      } else if (activeTab === 'aging') {
        const res = await api.get('/analytics/aging-buckets');
        setAgingBuckets(res.data);
      } else if (activeTab === 'morgue') {
        const res = await api.get('/analytics/redlist-morgue');
        setRedListMorgue(res.data);
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ELITE':
        return 'bg-green-500/20 text-green-600';
      case 'HIGH_VOLUME_LOW_SPEED':
        return 'bg-blue-500/20 text-blue-600';
      case 'BALANCED':
        return 'bg-amber-500/20 text-amber-600';
      case 'AT_RISK':
        return 'bg-orange-500/20 text-orange-600';
      case 'RED_LISTED':
        return 'bg-red-500/20 text-red-600';
      default:
        return 'bg-muted';
    }
  };

  if (loading && !executiveDashboard && !heatmapData && !agingBuckets && !redListMorgue) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Desk Performance Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive desk-level performance metrics and bottleneck detection
          </p>
        </div>
        
        <div className="flex gap-3">
          {activeTab === 'heatmap' && (
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as 'daily' | 'weekly')}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          )}
          
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="executive" className="gap-2">
            <Gauge className="h-4 w-4" />
            Executive Dashboard
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="gap-2">
            <Map className="h-4 w-4" />
            Heatmap
          </TabsTrigger>
          <TabsTrigger value="aging" className="gap-2">
            <Clock className="h-4 w-4" />
            Aging Buckets
          </TabsTrigger>
          <TabsTrigger value="morgue" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Red-List Morgue
          </TabsTrigger>
        </TabsList>

        {/* Executive Dashboard Tab */}
        <TabsContent value="executive" className="space-y-6">
          {executiveDashboard && (
            <>
              {/* Ticker */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Global Backlog
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{executiveDashboard.ticker.globalBacklogCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Pending files across all desks</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Avg Processing Speed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">
                      {executiveDashboard.ticker.avgProcessingSpeedHours.toFixed(1)}h
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Average handling time</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Throughput Today
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{executiveDashboard.ticker.totalThroughputToday}</p>
                    <p className="text-xs text-muted-foreground mt-1">Files completed today</p>
                  </CardContent>
                </Card>
              </div>

              {/* Leaderboard */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Top 5 Desks by Velocity Score
                  </CardTitle>
                  <CardDescription>Fastest processing desks</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Rank</TableHead>
                        <TableHead>Desk</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Velocity Score</TableHead>
                        <TableHead className="text-right">Overall Score</TableHead>
                        <TableHead className="text-right">Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executiveDashboard.leaderboard.map((desk, index) => (
                        <TableRow key={desk.deskId}>
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
                              <p className="font-medium">{desk.deskName}</p>
                              <p className="text-xs text-muted-foreground">{desk.deskCode}</p>
                            </div>
                          </TableCell>
                          <TableCell>{desk.department}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="bg-green-500/10 text-green-600">
                              {desk.velocityScore.toFixed(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Progress value={desk.overallScore} className="w-16 h-2" />
                            <span className="ml-2 font-medium">{desk.overallScore.toFixed(1)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={getCategoryColor(desk.category)}>
                              {desk.category.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Watchlist */}
              {executiveDashboard.watchlist.length > 0 && (
                <Card className="border-red-500/20 bg-red-500/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      Red-Listed Desks Watchlist
                    </CardTitle>
                    <CardDescription>Desks requiring immediate attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {executiveDashboard.watchlist.map((desk) => (
                        <div
                          key={desk.deskId}
                          className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                        >
                          <div>
                            <p className="font-medium">{desk.deskName} ({desk.deskCode})</p>
                            <p className="text-xs text-muted-foreground">{desk.department}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="bg-red-500/20 text-red-600">
                              Red-Listed
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">{desk.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Heatmap Tab */}
        <TabsContent value="heatmap" className="space-y-6">
          {heatmapData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  Bottleneck Heatmap
                </CardTitle>
                <CardDescription>
                  Flow Balance Ratio visualization - Green: Balanced, Yellow: Slight Accumulation, Red: Severe Bottleneck
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-full space-y-4">
                    {heatmapData.heatmapData.map((desk) => (
                      <div key={desk.deskId} className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium">{desk.deskName}</p>
                          <p className="text-xs text-muted-foreground">({desk.deskCode})</p>
                        </div>
                        <div className="flex gap-1">
                          {desk.timeSlots.map((slot, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex-1 h-12 rounded border-2 flex flex-col items-center justify-center text-xs",
                                slot.color === 'green' && 'bg-green-500/20 border-green-500',
                                slot.color === 'yellow' && 'bg-yellow-500/20 border-yellow-500',
                                slot.color === 'red' && 'bg-red-500/20 border-red-500',
                              )}
                              title={`${slot.time}: FBR=${slot.fbr}, In=${slot.inflow}, Out=${slot.outflow}`}
                            >
                              <span className="font-medium">{slot.fbr.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aging Buckets Tab */}
        <TabsContent value="aging" className="space-y-6">
          {agingBuckets && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card className={cn("border-green-500/20", agingBuckets.buckets.fresh.count > 0 && "bg-green-500/5")}>
                  <CardHeader>
                    <CardTitle className="text-sm">Fresh (0-24h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{agingBuckets.buckets.fresh.count}</p>
                  </CardContent>
                </Card>

                <Card className={cn("border-blue-500/20", agingBuckets.buckets.standard.count > 0 && "bg-blue-500/5")}>
                  <CardHeader>
                    <CardTitle className="text-sm">Standard (24-48h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{agingBuckets.buckets.standard.count}</p>
                  </CardContent>
                </Card>

                <Card className={cn("border-orange-500/20", agingBuckets.buckets.delayed.count > 0 && "bg-orange-500/5")}>
                  <CardHeader>
                    <CardTitle className="text-sm">Delayed (48-72h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{agingBuckets.buckets.delayed.count}</p>
                  </CardContent>
                </Card>

                <Card className={cn("border-red-500/20", agingBuckets.buckets.critical.count > 0 && "bg-red-500/5")}>
                  <CardHeader>
                    <CardTitle className="text-sm">Critical (72h+)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{agingBuckets.buckets.critical.count}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Files by Age Category</CardTitle>
                  <CardDescription>Total pending: {agingBuckets.totalPending}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="critical" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="critical">Critical (72h+)</TabsTrigger>
                      <TabsTrigger value="delayed">Delayed (48-72h)</TabsTrigger>
                      <TabsTrigger value="standard">Standard (24-48h)</TabsTrigger>
                      <TabsTrigger value="fresh">Fresh (0-24h)</TabsTrigger>
                    </TabsList>

                    {(['critical', 'delayed', 'standard', 'fresh'] as const).map((bucket) => (
                      <TabsContent key={bucket} value={bucket}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>File Number</TableHead>
                              <TableHead>Subject</TableHead>
                              <TableHead>Desk</TableHead>
                              <TableHead className="text-right">Age (Hours)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {agingBuckets.buckets[bucket].files.map((file: any) => (
                              <TableRow key={file.fileId}>
                                <TableCell>
                                  <code className="text-sm font-mono">{file.fileNumber}</code>
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate">
                                  {file.subject}
                                </TableCell>
                                <TableCell>{file.desk?.name || '-'}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline">
                                    {file.ageHours.toFixed(1)}h
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                            {agingBuckets.buckets[bucket].files.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                  No files in this category
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Red-List Morgue Tab */}
        <TabsContent value="morgue" className="space-y-6">
          {redListMorgue && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Total Red-Listed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-red-600">{redListMorgue.total}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Level 1</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{redListMorgue.byEscalationLevel.level1.count}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Level 2</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{redListMorgue.byEscalationLevel.level2.count}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Level 3</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-red-600">
                      {redListMorgue.byEscalationLevel.level3.count}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Red-Listed Files (Sorted by Criticality)</CardTitle>
                  <CardDescription>Files requiring immediate intervention</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Number</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Current Desk</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Days Overdue</TableHead>
                        <TableHead className="text-right">Criticality</TableHead>
                        <TableHead className="text-right">Escalation</TableHead>
                        <TableHead>Action Owner</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {redListMorgue.allFiles.map((file: any) => (
                        <TableRow key={file.fileId}>
                          <TableCell>
                            <code className="text-sm font-mono">{file.fileNumber}</code>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {file.subject}
                          </TableCell>
                          <TableCell>{file.currentDesk?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{file.reason || 'UNKNOWN'}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="bg-red-500/10 text-red-600">
                              {file.daysOverdue}d
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
                              {file.criticalityScore?.toFixed(1) || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                file.escalationLevel === 3 && 'bg-red-500/20 text-red-600',
                                file.escalationLevel === 2 && 'bg-orange-500/20 text-orange-600',
                                file.escalationLevel === 1 && 'bg-yellow-500/20 text-yellow-600',
                              )}
                            >
                              Level {file.escalationLevel || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>{file.actionOwner || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {redListMorgue.allFiles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No red-listed files
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

