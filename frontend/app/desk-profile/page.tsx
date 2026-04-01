'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { FileText, Clock, LogIn, TrendingUp, AlertCircle, Calendar } from 'lucide-react';

type Period = 'hour' | 'day' | 'week' | 'month' | 'year';

interface DeskVolume {
  totalFilesOnDesk?: number;
  incomingInPeriod?: number;
  outgoingInPeriod?: number;
  optimumVolume?: number;
  redListedFiles?: number;
  redListedInPeriod?: number;
  extensionRequestsTotal?: number;
  extensionRequestsInPeriod?: number;
}

interface DeskVolumeAverages {
  averageFilesOnDesk?: number;
  averageIncoming?: number;
  averageOutgoing?: number;
  averageRedListed?: number;
}

interface DeskTimeStats {
  optimumTimePerFileSeconds?: number;
  averageTimePerFileSeconds?: number;
  timeToProcessOptimumVolumeSeconds?: number;
}

interface LoginStatusRow {
  status?: string;
}

interface LoginTimeParts {
  hours?: number;
  minutes?: number;
}

export default function DeskProfilePage() {
  const [period, setPeriod] = useState<Period>('day');
  const [volume, setVolume] = useState<DeskVolume | null>(null);
  const [volumeAvg, setVolumeAvg] = useState<DeskVolumeAverages | null>(null);
  const [timeStats, setTimeStats] = useState<DeskTimeStats | null>(null);
  const [loginStatus, setLoginStatus] = useState<LoginStatusRow | null>(null);
  const [loginToday, setLoginToday] = useState<LoginTimeParts | null>(null);
  const [loginPeriod, setLoginPeriod] = useState<LoginTimeParts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [v, va, t, ls, lt, lp] = await Promise.all([
          api.get('/desk-profile/volume', { params: { period } }),
          api.get('/desk-profile/volume/averages', { params: { period } }),
          api.get('/desk-profile/time', { params: { period } }),
          api.get('/desk-profile/login/status'),
          api.get('/desk-profile/login/time-today'),
          api.get('/desk-profile/login/time-period', { params: { period } }),
        ]);
        setVolume(v.data);
        setVolumeAvg(va.data);
        setTimeStats(t.data);
        setLoginStatus(ls.data);
        setLoginToday(lt.data);
        setLoginPeriod(lp.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [period]);

  if (loading && !volume) {
    return (
      <div className="container py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Desk Profile</h1>
          <p className="text-muted-foreground">Volume, time, and login metrics</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hour">Hour</SelectItem>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Files on desk</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{volume?.totalFilesOnDesk ?? '-'}</div>
            <p className="text-xs text-muted-foreground">Current total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incoming ({period})</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{volume?.incomingInPeriod ?? '-'}</div>
            <p className="text-xs text-muted-foreground">Outgoing: {volume?.outgoingInPeriod ?? '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimum volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{volume?.optimumVolume ?? '-'}</div>
            <p className="text-xs text-muted-foreground">Target per period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Red-listed files</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{volume?.redListedFiles ?? '-'}</div>
            <p className="text-xs text-muted-foreground">In period: {volume?.redListedInPeriod ?? '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Extension requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{volume?.extensionRequestsTotal ?? '-'}</div>
            <p className="text-xs text-muted-foreground">In period: {volume?.extensionRequestsInPeriod ?? '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume averages ({period})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Avg on desk: {volumeAvg?.averageFilesOnDesk?.toFixed(1) ?? '-'}</p>
            <p className="text-sm">Avg incoming: {volumeAvg?.averageIncoming?.toFixed(1) ?? '-'}</p>
            <p className="text-sm">Avg outgoing: {volumeAvg?.averageOutgoing?.toFixed(1) ?? '-'}</p>
            <p className="text-sm">Avg red-listed: {volumeAvg?.averageRedListed?.toFixed(1) ?? '-'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time parameters
            </CardTitle>
            <CardDescription>Optimum and actual processing time</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Optimum time per file: {timeStats?.optimumTimePerFileSeconds != null ? `${timeStats.optimumTimePerFileSeconds}s` : 'Not set'}</p>
            <p className="text-sm">Average time per file: {timeStats?.averageTimePerFileSeconds != null ? `${Math.round(timeStats.averageTimePerFileSeconds)}s` : '-'}</p>
            <p className="text-sm">Time for optimum volume: {timeStats?.timeToProcessOptimumVolumeSeconds != null ? `${Math.round(timeStats.timeToProcessOptimumVolumeSeconds / 60)} min` : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              Login
            </CardTitle>
            <CardDescription>Current status and login time</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">Status: {loginStatus?.status ?? '-'}</p>
            <p className="text-sm">Login time today: {loginToday?.hours ?? 0}h {loginToday?.minutes ?? 0}m</p>
            <p className="text-sm">Login time ({period}): {loginPeriod?.hours ?? 0}h {loginPeriod?.minutes ?? 0}m</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
