'use client';

import { memo } from 'react';
import {
  BaseEdge,
  EdgeToolbar,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import { Trash2 } from 'lucide-react';

export type WorkflowEdgeData = {
  onDelete?: (edgeId: string) => void;
};

function WorkflowEdgeComponent({ id, data, selected, ...props }: EdgeProps<Edge<WorkflowEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath(props);

  return (
    <>
      <BaseEdge id={id} path={edgePath} interactionWidth={20} {...props} />
      <EdgeToolbar edgeId={id} x={labelX} y={labelY} isVisible alignX="center" alignY="center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data?.onDelete?.(id);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete connection"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </EdgeToolbar>
    </>
  );
}

export default memo(WorkflowEdgeComponent);
