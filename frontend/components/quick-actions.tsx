'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  ArrowLeft,
  Pause,
  Play,
  Send,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
  fileId: string;
  fileNumber: string;
  currentStatus: string;
  isOnHold: boolean;
  userRole: string;
  onActionComplete: () => void;
}

export function QuickActions({
  fileId,
  fileNumber,
  currentStatus,
  isOnHold,
  userRole,
  onActionComplete,
}: QuickActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  
  const [remarks, setRemarks] = useState('');
  const [returnType, setReturnType] = useState<'host' | 'previous'>('previous');
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionDays, setExtensionDays] = useState('1');

  const performAction = async (action: string, data?: Record<string, unknown>) => {
    setLoading(action);
    try {
      await api.post(`/files/${fileId}/action`, {
        action,
        remarks: (data?.remarks as string | undefined) || remarks,
        ...data,
      });
      toast.success(`File ${action} successfully`);
      onActionComplete();
      resetDialogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(`Failed to ${action} file`, {
        description: err.response?.data?.message,
      });
    } finally {
      setLoading(null);
    }
  };

  const resetDialogs = () => {
    setShowRejectDialog(false);
    setShowReturnDialog(false);
    setShowForwardDialog(false);
    setShowHoldDialog(false);
    setShowExtensionDialog(false);
    setRemarks('');
    setExtensionReason('');
  };

  const handleRequestExtension = async () => {
    if (!extensionReason) {
      toast.error('Please select a reason for extension');
      return;
    }
    
    setLoading('extension');
    try {
      await api.post(`/files/${fileId}/request-extra-time`, {
        reason: extensionReason,
        additionalDays: parseInt(extensionDays),
      });
      toast.success('Extension request submitted', {
        description: 'Waiting for originator approval',
      });
      resetDialogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to request extension', {
        description: err.response?.data?.message,
      });
    } finally {
      setLoading(null);
    }
  };

  const canApprove = ['SECTION_OFFICER', 'APPROVAL_AUTHORITY', 'DEPT_ADMIN', 'SUPER_ADMIN'].includes(userRole);
  const canReject = ['SECTION_OFFICER', 'APPROVAL_AUTHORITY', 'DEPT_ADMIN', 'SUPER_ADMIN'].includes(userRole);
  const canHold = ['SECTION_OFFICER', 'DEPT_ADMIN', 'SUPER_ADMIN'].includes(userRole);
  const canReturn = ['SECTION_OFFICER', 'APPROVAL_AUTHORITY', 'DEPT_ADMIN', 'SUPER_ADMIN'].includes(userRole);

  return (
    <>
      {/* Main Action Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-xl border">
        {/* Hold / Release */}
        {canHold && (
          <Button
            variant={isOnHold ? 'default' : 'outline'}
            onClick={() => isOnHold ? performAction('release') : setShowHoldDialog(true)}
            disabled={loading !== null}
            className="gap-2"
          >
            {loading === 'hold' || loading === 'release' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isOnHold ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            {isOnHold ? 'Release' : 'Hold'}
          </Button>
        )}

        {/* Return Options */}
        {canReturn && (
          <Button
            variant="outline"
            onClick={() => setShowReturnDialog(true)}
            disabled={loading !== null}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Return
          </Button>
        )}

        {/* Reject */}
        {canReject && (
          <Button
            variant="outline"
            onClick={() => setShowRejectDialog(true)}
            disabled={loading !== null}
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        )}

        {/* Approve / Forward */}
        {canApprove && (
          <Button
            onClick={() => setShowForwardDialog(true)}
            disabled={loading !== null}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            {loading === 'approve' || loading === 'approve-and-forward' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Approve / Forward
          </Button>
        )}

        {/* Divider */}
        <div className="h-8 w-px bg-border mx-2" />

        {/* Request Extension */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowExtensionDialog(true)}
          disabled={loading !== null}
          className="gap-2 text-muted-foreground"
        >
          <Clock className="h-4 w-4" />
          Request Extension
        </Button>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Reject File
            </DialogTitle>
            <DialogDescription>
              File {fileNumber} will be marked as rejected. This action requires a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason for Rejection *</Label>
              <Textarea
                id="reject-reason"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter the reason for rejection..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => performAction('reject')}
              disabled={!remarks.trim() || loading !== null}
            >
              {loading === 'reject' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Return File
            </DialogTitle>
            <DialogDescription>
              Choose where to return file {fileNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div
                className={cn(
                  "p-4 rounded-lg border-2 cursor-pointer transition-all",
                  returnType === 'previous' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                )}
                onClick={() => setReturnType('previous')}
              >
                <ArrowLeft className="h-6 w-6 mb-2" />
                <h4 className="font-semibold">Previous Desk</h4>
                <p className="text-xs text-muted-foreground">Return to immediate sender for clarification</p>
              </div>
              <div
                className={cn(
                  "p-4 rounded-lg border-2 cursor-pointer transition-all",
                  returnType === 'host' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                )}
                onClick={() => setReturnType('host')}
              >
                <RotateCcw className="h-6 w-6 mb-2" />
                <h4 className="font-semibold">Originator</h4>
                <p className="text-xs text-muted-foreground">Bypass all steps, return to file creator</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="return-remarks">Remarks (Optional)</Label>
              <Textarea
                id="return-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any comments or queries..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => performAction(returnType === 'host' ? 'return_to_host' : 'return_to_previous')}
              disabled={loading !== null}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Return File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hold Dialog */}
      <Dialog open={showHoldDialog} onOpenChange={setShowHoldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pause className="h-5 w-5" />
              Put File on Hold
            </DialogTitle>
            <DialogDescription>
              File {fileNumber} will be paused. The timer may continue depending on policy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hold-reason">Reason for Hold *</Label>
              <Textarea
                id="hold-reason"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Why is this file being put on hold?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHoldDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => performAction('hold')}
              disabled={!remarks.trim() || loading !== null}
            >
              {loading === 'hold' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Put on Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forward/Approve Dialog */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Approve & Forward
            </DialogTitle>
            <DialogDescription>
              {['SECTION_OFFICER', 'APPROVAL_AUTHORITY'].includes(userRole) ? (
                <>
                  Approve file {fileNumber} and automatically forward to the next stage:
                  <br />
                  {userRole === 'SECTION_OFFICER' && (
                    <span className="font-medium">→ Approval Authority in your division</span>
                  )}
                  {userRole === 'APPROVAL_AUTHORITY' && (
                    <span className="font-medium">→ Dispatch Officer in your division</span>
                  )}
                </>
              ) : (
                `Approve file ${fileNumber} and forward to the next stage`
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approve-remarks">Note (Optional)</Label>
              <Textarea
                id="approve-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any approval notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForwardDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={async () => {
                // For SECTION_OFFICER and APPROVAL_AUTHORITY, use the one-click approve-and-forward
                if (['SECTION_OFFICER', 'APPROVAL_AUTHORITY'].includes(userRole)) {
                  setLoading('approve-and-forward');
                  try {
                    const response = await api.post(`/files/${fileId}/approve-and-forward`, {
                      remarks: remarks || undefined,
                    });
                    toast.success('File approved and forwarded successfully', {
                      description: `Forwarded to ${response.data.forwardedTo} (${response.data.forwardedToRole})`,
                    });
                    onActionComplete();
                    resetDialogs();
                  } catch (error: unknown) {
                    const err = error as { response?: { data?: { message?: string } } };
                    toast.error('Failed to approve and forward file', {
                      description: err.response?.data?.message,
                    });
                  } finally {
                    setLoading(null);
                  }
                } else {
                  // For other roles, just approve
                  performAction('approve');
                }
              }}
              disabled={loading !== null}
            >
              {loading === 'approve' || loading === 'approve-and-forward' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Approve & Forward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extension Request Dialog */}
      <Dialog open={showExtensionDialog} onOpenChange={setShowExtensionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Request Time Extension
            </DialogTitle>
            <DialogDescription>
              Request additional time to process file {fileNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Extension Process</p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    1. Your request will be sent to the file originator
                    <br />
                    2. If approved, it goes to Super Admin for final confirmation
                    <br />
                    3. Timer will reset only after both approvals
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason for Extension *</Label>
              <Select value={extensionReason} onValueChange={setExtensionReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="awaiting_external">Awaiting External Data</SelectItem>
                  <SelectItem value="volume_overload">Volume Overload</SelectItem>
                  <SelectItem value="complexity">File Complexity</SelectItem>
                  <SelectItem value="leave">Leave / Absence</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Additional Time Needed</Label>
              <Select value={extensionDays} onValueChange={setExtensionDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">+1 Day</SelectItem>
                  <SelectItem value="3">+3 Days</SelectItem>
                  <SelectItem value="7">+1 Week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtensionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestExtension}
              disabled={!extensionReason || loading !== null}
            >
              {loading === 'extension' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

