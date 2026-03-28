'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AiTextarea } from '@/components/ai-textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  AlertTriangle,
  Loader2,
  FileText,
  User,
  Clock,
  Building2,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserProfileLink, DepartmentProfileLink } from '@/components/profile-links';

interface RecallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    id: string;
    fileNumber: string;
    subject: string;
    status: string;
    currentLocation?: string;
    currentOfficer?: string;
    overdueDays?: number;
    createdBy?: { id: string; name: string };
    department?: { id: string; name: string };
  };
  onRecallComplete: () => void;
}

export function RecallModal({
  open,
  onOpenChange,
  file,
  onRecallComplete,
}: RecallModalProps) {
  const [loading, setLoading] = useState(false);
  const [destination, setDestination] = useState<'holding' | 'originator' | 'next'>('holding');
  const [reason, setReason] = useState('');

  const handleRecall = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the recall');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/files/${file.id}/recall`, {
        destination,
        reason,
      });
      toast.success('File recalled successfully', {
        description: `File ${file.fileNumber} has been moved to ${
          destination === 'holding' ? 'your holding desk' :
          destination === 'originator' ? 'the originator' :
          'the next stage'
        }`,
      });
      onRecallComplete();
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Failed to recall file', {
        description: err.response?.data?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">System Override: Recall File</DialogTitle>
              <DialogDescription>
                <code className="font-mono bg-muted px-2 py-0.5 rounded">{file.fileNumber}</code>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Status */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Current Location:</span>
              </div>
              <span className="font-medium">{file.currentLocation || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">With Officer:</span>
              </div>
              <span className="font-medium">{file.currentOfficer || 'Unassigned'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Status:</span>
              </div>
              <Badge variant={file.overdueDays && file.overdueDays > 0 ? 'destructive' : 'secondary'}>
                {file.status}
                {file.overdueDays && file.overdueDays > 0 && ` (-${file.overdueDays} days)`}
              </Badge>
            </div>
          </div>

          {/* Destination Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Where do you want to move this file?</Label>
            <RadioGroup value={destination} onValueChange={(v) => setDestination(v as 'next' | 'holding' | 'originator')}>
              <div
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  destination === 'holding' ? 'border-primary bg-primary/5' : 'border-muted'
                )}
                onClick={() => setDestination('holding')}
              >
                <RadioGroupItem value="holding" id="holding" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="holding" className="font-semibold cursor-pointer">
                    My Holding Desk
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    File will be moved to your personal holding desk for review and reassignment
                  </p>
                </div>
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>

              <div
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  destination === 'originator' ? 'border-primary bg-primary/5' : 'border-muted'
                )}
                onClick={() => setDestination('originator')}
              >
                <RadioGroupItem value="originator" id="originator" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="originator" className="font-semibold cursor-pointer">
                    Return to Originator
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Send back to{' '}
                    {file.createdBy ? (
                      <UserProfileLink userId={file.createdBy.id} name={file.createdBy.name} />
                    ) : (
                      'original creator'
                    )}
                    {file.department && (
                      <> ({file.department.id ? <DepartmentProfileLink departmentId={file.department.id} name={file.department.name} /> : file.department.name})</>
                    )}
                    {!file.department && ' (Department)'}
                  </p>
                </div>
                <User className="h-5 w-5 text-muted-foreground" />
              </div>

              <div
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  destination === 'next' ? 'border-primary bg-primary/5' : 'border-muted'
                )}
                onClick={() => setDestination('next')}
              >
                <RadioGroupItem value="next" id="next" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="next" className="font-semibold cursor-pointer">
                    Forward to Next Stage
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Skip current desk and move directly to the next hierarchy level
                  </p>
                </div>
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
            </RadioGroup>
          </div>

          {/* Mandatory Reason */}
          <div className="space-y-2">
            <Label htmlFor="recall-reason" className="text-base font-semibold">
              Reason for Recall *
            </Label>
            <AiTextarea
              id="recall-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Document the reason… (@Ai + Ctrl+Enter)"
              rows={4}
              className="resize-none"
              fileId={file.id}
              fieldHint="Recall — audit reason"
              extraContext={() =>
                `File ${file.fileNumber}. Subject: ${file.subject}`
              }
            />
            <p className="text-xs text-muted-foreground">
              This reason will be logged in the audit trail and visible to all parties
            </p>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleRecall}
            disabled={!reason.trim() || loading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Execute Recall
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

