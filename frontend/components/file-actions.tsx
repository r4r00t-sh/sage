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
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  CheckCircle,
  XCircle,
  RotateCcw,
  Pause,
  Clock,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { hasRole, hasGodRole } from '@/lib/auth-utils';

interface FileActionsProps {
  fileId: string;
  fileNumber: string;
  currentStatus: string;
  onActionComplete?: () => void;
}

type ActionType = 'approve' | 'reject' | 'return' | 'hold' | 'extra_time' | 'recall';

interface ActionConfig {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  requiresRemarks: boolean;
  requiresDays?: boolean;
}

const actionConfigs: Record<ActionType, ActionConfig> = {
  approve: {
    title: 'Approve File',
    description: 'Mark this file as approved',
    icon: CheckCircle,
    color: 'text-green-600',
    requiresRemarks: false,
  },
  reject: {
    title: 'Reject File',
    description: 'Reject this file with a reason',
    icon: XCircle,
    color: 'text-red-600',
    requiresRemarks: true,
  },
  return: {
    title: 'Return File',
    description: 'Return this file to the previous handler',
    icon: RotateCcw,
    color: 'text-orange-600',
    requiresRemarks: true,
  },
  hold: {
    title: 'Put on Hold',
    description: 'Put this file on hold temporarily',
    icon: Pause,
    color: 'text-yellow-600',
    requiresRemarks: true,
  },
  extra_time: {
    title: 'Request Extra Time',
    description: 'Request additional days to process this file',
    icon: Clock,
    color: 'text-blue-600',
    requiresRemarks: true,
    requiresDays: true,
  },
  recall: {
    title: 'Recall File',
    description: 'Recall this file (Super Admin only)',
    icon: AlertTriangle,
    color: 'text-purple-600',
    requiresRemarks: true,
  },
};

export function FileActions({
  fileId,
  fileNumber,
  currentStatus,
  onActionComplete,
}: FileActionsProps) {
  const { user } = useAuthStore();
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [remarks, setRemarks] = useState('');
  const [additionalDays, setAdditionalDays] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    if (!actionType) return;

    const config = actionConfigs[actionType];
    if (config.requiresRemarks && !remarks.trim()) {
      toast.error('Please provide remarks');
      return;
    }

    setLoading(true);
    try {
      let endpoint = '';
      let payload: Record<string, unknown> = {};

      switch (actionType) {
        case 'approve':
          endpoint = `/files/${fileId}/action`;
          payload = { action: 'approve', remarks };
          break;
        case 'reject':
          endpoint = `/files/${fileId}/action`;
          payload = { action: 'reject', remarks };
          break;
        case 'return':
          endpoint = `/files/${fileId}/action`;
          payload = { action: 'return', remarks };
          break;
        case 'hold':
          endpoint = `/files/${fileId}/action`;
          payload = { action: 'hold', remarks };
          break;
        case 'extra_time':
          endpoint = `/files/${fileId}/request-extra-time`;
          payload = { additionalDays, remarks };
          break;
        case 'recall':
          endpoint = `/files/${fileId}/recall`;
          payload = { remarks };
          break;
      }

      await api.post(endpoint, payload);
      toast.success(`File ${actionType.replace('_', ' ')} successful`);
      setActionType(null);
      setRemarks('');
      setAdditionalDays(1);
      onActionComplete?.();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error('Action failed', {
        description: err.response?.data?.message || 'An error occurred',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderActionButton = (type: ActionType, variant: 'default' | 'outline' | 'destructive' = 'outline') => {
    const config = actionConfigs[type];
    const Icon = config.icon;

    // Hide recall for non-super admins
    if (type === 'recall' && !hasGodRole(user)) return null;

    return (
      <Button
        key={type}
        variant={variant}
        size="sm"
        onClick={() => setActionType(type)}
        className="gap-2"
      >
        <Icon className={`h-4 w-4 ${config.color}`} />
        {config.title.replace('File', '').trim()}
      </Button>
    );
  };

  const config = actionType ? actionConfigs[actionType] : null;
  const Icon = config?.icon;

  return (
    <>
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {renderActionButton('approve', 'default')}
        {renderActionButton('return')}
        {renderActionButton('reject', 'destructive')}
        {renderActionButton('hold')}
        {renderActionButton('extra_time')}
        {renderActionButton('recall', 'destructive')}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {Icon && <Icon className={`h-5 w-5 ${config?.color}`} />}
              {config?.title}
            </DialogTitle>
            <DialogDescription>
              {config?.description} for file{' '}
              <span className="font-mono font-semibold">{fileNumber}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {config?.requiresDays && (
              <div className="space-y-2">
                <Label htmlFor="days">Additional Days</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={30}
                  value={additionalDays}
                  onChange={(e) => setAdditionalDays(parseInt(e.target.value) || 1)}
                  disabled={loading}
                />
              </div>
            )}

            {(config?.requiresRemarks || actionType === 'approve') && (
              <div className="space-y-2">
                <Label htmlFor="remarks">
                  Remarks {config?.requiresRemarks ? '*' : '(Optional)'}
                </Label>
                <AiTextarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter your remarks… (@Ai + Ctrl+Enter)"
                  rows={3}
                  disabled={loading}
                  fileId={fileId}
                  fieldHint={`Remarks for ${actionType ?? 'action'}`}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionType(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={loading}
              variant={actionType === 'reject' || actionType === 'recall' ? 'destructive' : 'default'}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

