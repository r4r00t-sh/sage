'use client';

import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Circle, Square, Diamond, Hexagon, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap = {
  start: Circle,
  task: Square,
  decision: Diamond,
  end: Hexagon,
} as const;

export type WorkflowNodeData = {
  label?: string;
  nodeType?: string;
  description?: string;
  onDelete?: (nodeId: string) => void;
};

function WorkflowNodeComponent({ data, id, selected }: NodeProps<Node<WorkflowNodeData>>) {
  const nodeType = (data?.nodeType as keyof typeof iconMap) ?? 'task';
  const Icon = iconMap[nodeType] ?? Square;

  return (
    <div
      className={cn(
        'rounded-lg border-2 bg-card px-4 py-3 shadow-sm min-w-[160px]',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'
      )}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-muted-foreground" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
              nodeType === 'start' && 'bg-emerald-500/10',
              nodeType === 'task' && 'bg-blue-500/10',
              nodeType === 'decision' && 'bg-amber-500/10',
              nodeType === 'end' && 'bg-slate-500/10'
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4',
                nodeType === 'start' && 'text-emerald-600',
                nodeType === 'task' && 'text-blue-600',
                nodeType === 'decision' && 'text-amber-600',
                nodeType === 'end' && 'text-slate-600'
              )}
            />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{data?.label ?? 'Unnamed'}</p>
            <p className="text-xs text-muted-foreground capitalize">{nodeType}</p>
          </div>
        </div>
        {typeof data?.onDelete === 'function' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(id);
            }}
            className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            aria-label="Delete node"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-muted-foreground" />
    </div>
  );
}

export default memo(WorkflowNodeComponent);
