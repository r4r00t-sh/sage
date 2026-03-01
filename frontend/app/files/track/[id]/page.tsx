'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { UserProfileLink, DepartmentProfileLink, DivisionProfileLink } from '@/components/profile-links';
import {
  ArrowLeft,
  FileText,
  MapPin,
  Clock,
  User,
  Building2,
  Calendar,
  CheckCircle,
  XCircle,
  RotateCcw,
  Pause,
  AlertTriangle,
  Send,
  Eye,
  TrendingUp,
  ArrowRight,
  Route,
  Play,
  Mail,
  Tag,
  Hash,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface FileTracking {
  id: string;
  fileNumber: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  isRedListed: boolean;
  createdAt: string;
  dueDate?: string;
  department: { id: string; name: string; code: string };
  currentDivision?: { id: string; name: string };
  createdBy: { id: string; name: string };
  assignedTo?: { id: string; name: string };
  routingHistory: {
    id: string;
    action: string;
    remarks?: string;
    createdAt: string;
    fromUserId?: string;
    toUserId?: string;
    toDivisionId?: string;
  }[];
}

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; label: string }> = {
  PENDING: { icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-500/10', label: 'Pending' },
  IN_PROGRESS: { icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-500/10', label: 'In Progress' },
  APPROVED: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-500/10', label: 'Approved' },
  REJECTED: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-500/10', label: 'Rejected' },
  RETURNED: { icon: RotateCcw, color: 'text-orange-600', bgColor: 'bg-orange-500/10', label: 'Returned' },
  ON_HOLD: { icon: Pause, color: 'text-gray-600', bgColor: 'bg-gray-500/10', label: 'On Hold' },
  RECALLED: { icon: AlertTriangle, color: 'text-purple-600', bgColor: 'bg-purple-500/10', label: 'Recalled' },
};

const actionConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; borderColor: string; label: string }> = {
  CREATED: { icon: FileText, color: 'text-emerald-600', bgColor: 'bg-emerald-500', borderColor: 'border-emerald-500', label: 'Created' },
  FORWARDED: { icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-500', borderColor: 'border-blue-500', label: 'Forwarded' },
  APPROVED: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-500', borderColor: 'border-green-500', label: 'Approved' },
  REJECTED: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-500', borderColor: 'border-red-500', label: 'Rejected' },
  RETURNED_TO_HOST: { icon: RotateCcw, color: 'text-orange-600', bgColor: 'bg-orange-500', borderColor: 'border-orange-500', label: 'Returned' },
  RETURNED_TO_PREVIOUS: { icon: RotateCcw, color: 'text-orange-600', bgColor: 'bg-orange-500', borderColor: 'border-orange-500', label: 'Returned' },
  ON_HOLD: { icon: Pause, color: 'text-gray-600', bgColor: 'bg-gray-500', borderColor: 'border-gray-500', label: 'On Hold' },
  RELEASED_FROM_HOLD: { icon: Play, color: 'text-blue-600', bgColor: 'bg-blue-500', borderColor: 'border-blue-500', label: 'Released' },
  RECALLED: { icon: AlertTriangle, color: 'text-purple-600', bgColor: 'bg-purple-500', borderColor: 'border-purple-500', label: 'Recalled' },
  DISPATCHED: { icon: Send, color: 'text-green-600', bgColor: 'bg-green-500', borderColor: 'border-green-500', label: 'Dispatched' },
  CLOSED: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-500', borderColor: 'border-green-500', label: 'Closed' },
  OPINION_REQUESTED: { icon: Mail, color: 'text-indigo-600', bgColor: 'bg-indigo-500', borderColor: 'border-indigo-500', label: 'Opinion Requested' },
  CONSULTATION_SENT: { icon: Mail, color: 'text-indigo-600', bgColor: 'bg-indigo-500', borderColor: 'border-indigo-500', label: 'Opinion Requested' },
  OPINION_PROVIDED: { icon: CheckCircle, color: 'text-indigo-600', bgColor: 'bg-indigo-500', borderColor: 'border-indigo-500', label: 'Opinion Provided' },
  CONSULTATION_RETURNED: { icon: RotateCcw, color: 'text-indigo-600', bgColor: 'bg-indigo-500', borderColor: 'border-indigo-500', label: 'Opinion Returned' },
};

const priorityConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  LOW: { color: 'text-slate-600', bgColor: 'bg-slate-500', label: 'Low' },
  NORMAL: { color: 'text-blue-600', bgColor: 'bg-blue-500', label: 'Normal' },
  HIGH: { color: 'text-orange-600', bgColor: 'bg-orange-500', label: 'High' },
  URGENT: { color: 'text-red-600', bgColor: 'bg-red-500', label: 'Urgent' },
};

export default function FileTraceroutePage() {
  const params = useParams();
  const router = useRouter();
  const [file, setFile] = useState<FileTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fileId = params.id as string;

  useEffect(() => {
    fetchFile();
  }, [fileId]);

  // Auto-scroll to the end (current location) when loaded
  useEffect(() => {
    if (file && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          left: scrollRef.current.scrollWidth,
          behavior: 'smooth',
        });
      }, 300);
    }
  }, [file]);

  const fetchFile = async () => {
    try {
      const response = await api.get(`/files/${fileId}`);
      setFile(response.data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to load file', {
        description: err.response?.data?.message || 'File not found',
      });
      router.push('/files/track');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!file) return null;

  const config = statusConfig[file.status] || statusConfig.PENDING;
  const StatusIcon = config.icon;
  const priority = priorityConfig[file.priority] || priorityConfig.NORMAL;

  // Single-column vertical timeline (creation + routing, sorted by date)
  const timelineSteps = [
    {
      id: 'creation',
      action: 'CREATED',
      remarks: `Created by ${file.createdBy.name}`,
      createdAt: file.createdAt,
      isCreation: true,
    },
    ...file.routingHistory.map((entry) => ({
      id: entry.id,
      action: entry.action,
      remarks: entry.remarks,
      createdAt: entry.createdAt,
      isCreation: false,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Back Button - Fixed at top */}
      <div className="px-6 py-4 border-b bg-background">
        <Button variant="ghost" className="-ml-2" onClick={() => router.push('/files/track')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Track Files
        </Button>
      </div>

      {/* Split: Traceroute (flex) | Document Details (fixed min width, always visible) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left - Traceroute: takes remaining space, scrolls horizontally */}
        <div className="flex-1 min-w-0 flex flex-col border-r bg-muted/20">
          <div className="p-6 border-b bg-background">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                  <Route className="h-6 w-6 text-primary" />
                  File Journey Flowchart
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Visual representation of file movement
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono font-semibold px-3 py-1.5 bg-muted rounded-md">
                  {file.fileNumber}
                </code>
                {file.isRedListed && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Red Listed
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Horizontal timeline - scrollable from left (creation) to right (current) */}
          <div className="flex-1 overflow-x-auto">
            <div
              ref={scrollRef}
              className="p-6 inline-flex items-stretch gap-4"
            >
                {timelineSteps.map((step, index) => {
                  const isLast = index === timelineSteps.length - 1;
                  const actionCfg = actionConfig[step.action] || actionConfig.FORWARDED;
                  const ActionIcon = actionCfg.icon;
                  return (
                    <div
                      key={step.id}
                      className="flex flex-col items-stretch w-[220px] sm:w-[260px] flex-shrink-0"
                    >
                      {/* Top icon row with horizontal connector */}
                      <div className="flex items-center mb-3">
                        <div
                          className={cn(
                            'h-12 w-12 rounded-full flex items-center justify-center border-2 bg-background shadow-md',
                            isLast
                              ? `${actionCfg.borderColor} ring-4 ring-offset-2 ring-offset-background`
                              : 'border-muted-foreground/30',
                            isLast && 'animate-pulse',
                          )}
                        >
                          <div
                            className={cn(
                              'h-8 w-8 rounded-full flex items-center justify-center',
                              actionCfg.bgColor,
                            )}
                          >
                            <ActionIcon className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        {!isLast && (
                          <div className="h-0.5 flex-1 bg-muted-foreground/25 ml-2 rounded-full" />
                        )}
                      </div>

                      {/* Card */}
                      <div
                        className={cn(
                          'flex-1 rounded-lg border bg-card p-4 shadow-sm',
                          isLast && `ring-2 ${actionCfg.borderColor}`,
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              actionCfg.color,
                              isLast && actionCfg.bgColor + '/20',
                            )}
                          >
                            {actionCfg?.label ?? step.action}
                          </Badge>
                          {isLast && (
                            <Badge className={cn('text-xs', actionCfg.bgColor, 'text-white')}>
                              <MapPin className="h-3 w-3 mr-1" />
                              Current
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(step.createdAt), 'MMM d, yyyy · h:mm a')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {step.remarks || (step.isCreation ? <>By <UserProfileLink userId={file.createdBy.id} name={file.createdBy.name} /></> : '—')}
                        </p>
                        <p className="text-xs text-muted-foreground/80 mt-2">
                          Step {index + 1} of {timelineSteps.length}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Legend - Fixed at bottom */}
          <div className="border-t px-6 py-3 bg-background">
            <div className="flex items-center justify-center gap-4 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Created</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Forwarded</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Approved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                <span className="text-muted-foreground">Returned</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Rejected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-gray-500" />
                <span className="text-muted-foreground">On Hold</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full animate-ping bg-primary" />
                <span className="text-muted-foreground">Current</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Document Details: fixed min width so full panel is visible without horizontal scroll */}
        <div className="w-[380px] min-w-[380px] max-w-[420px] flex flex-col bg-background overflow-hidden shrink-0">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Document Details
            </h2>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* File Subject */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Subject</label>
                <p className="text-sm font-medium leading-relaxed">{file.subject}</p>
              </div>

              <Separator />

              {/* Status & Priority */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Status</label>
                  <Badge className={`${config.bgColor} ${config.color} border-0 gap-1.5 py-1.5 px-3`}>
                    <StatusIcon className="h-4 w-4" />
                    {config.label}
                  </Badge>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Priority</label>
                  <Badge variant="outline" className={`gap-1.5 ${priority.color}`}>
                    <span className={`h-2 w-2 rounded-full ${priority.bgColor}`} />
                    {priority.label}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Department */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Department
                </label>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{file.department.code}</p>
                  <p className="text-xs text-muted-foreground">
                    <DepartmentProfileLink departmentId={file.department.id} name={file.department.name} />
                  </p>
                </div>
              </div>

              <Separator />

              {/* Current Location */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Current Location
                </label>
                <p className="text-sm font-medium">
                  {file.currentDivision && file.department?.id ? (
                    <DivisionProfileLink departmentId={file.department.id} divisionId={file.currentDivision.id} name={file.currentDivision.name} />
                  ) : file.currentDivision?.name ? (
                    file.currentDivision.name
                  ) : (
                    <span className="text-muted-foreground italic">Not assigned</span>
                  )}
                </p>
              </div>

              <Separator />

              {/* Assigned To */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Assigned To
                </label>
                <p className="text-sm font-medium">
                  {file.assignedTo ? (
                    <UserProfileLink userId={file.assignedTo.id} name={file.assignedTo.name} />
                  ) : (
                    <span className="text-muted-foreground italic">Unassigned</span>
                  )}
                </p>
              </div>

              <Separator />

              {/* Created By */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Created By
                </label>
                <p className="text-sm font-medium">
                  <UserProfileLink userId={file.createdBy.id} name={file.createdBy.name} />
                </p>
              </div>

              <Separator />

              {/* Created Date */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Created Date
                </label>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {format(new Date(file.createdAt), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(file.createdAt), 'h:mm a')} • {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {/* Due Date */}
              {file.dueDate && (
                <>
                  <Separator />
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Due Date
                    </label>
                    <div className={cn(
                      "p-3 rounded-lg border",
                      new Date(file.dueDate) < new Date() 
                        ? 'border-red-500/50 bg-red-500/5' 
                        : 'border-amber-500/50 bg-amber-500/5'
                    )}>
                      <p className={cn(
                        "text-sm font-medium",
                        new Date(file.dueDate) < new Date() 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-amber-600 dark:text-amber-400'
                      )}>
                        {format(new Date(file.dueDate), 'MMM d, yyyy \'at\' h:mm a')}
                      </p>
                      <p className={cn(
                        "text-xs mt-1",
                        new Date(file.dueDate) < new Date() 
                          ? 'text-red-600/80 dark:text-red-400/80' 
                          : 'text-amber-600/80 dark:text-amber-400/80'
                      )}>
                        {new Date(file.dueDate) < new Date() ? 'Overdue' : 'Due ' + formatDistanceToNow(new Date(file.dueDate), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Description */}
              {file.description && (
                <>
                  <Separator />
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Description</label>
                    <div className="text-sm text-muted-foreground prose prose-sm max-w-none" 
                      dangerouslySetInnerHTML={{ __html: file.description }} 
                    />
                  </div>
                </>
              )}

              {/* Action Button */}
              <Separator />
              <Button 
                className="w-full" 
                onClick={() => router.push(`/files/${file.id}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Full File Details
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
