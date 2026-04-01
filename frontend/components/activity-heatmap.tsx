'use client';

import { useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format, startOfYear, addDays, isWithinInterval } from 'date-fns';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

export interface ActivityHeatmapProps {
  contributions: Record<string, number>;
  totalContributions: number;
  year: number;
  scopeLabel?: string;
  loading?: boolean;
}

export function ActivityHeatmap({
  contributions,
  totalContributions,
  year,
  scopeLabel = 'activity',
  loading = false,
}: ActivityHeatmapProps) {
  const { grid, monthLabels } = useMemo(() => {
    const jan1 = startOfYear(new Date(year, 0, 1));
    const dec31 = new Date(year, 11, 31);
    const start = new Date(jan1);
    while (start.getDay() !== 0) {
      start.setDate(start.getDate() - 1);
    }
    const numWeeks = 53;
    const grid: { date: Date; count: number; inYear: boolean }[][] = [];
    for (let row = 0; row < 7; row++) {
      const week: { date: Date; count: number; inYear: boolean }[] = [];
      for (let col = 0; col < numWeeks; col++) {
        const date = addDays(start, col * 7 + row);
        const inYear = isWithinInterval(date, { start: jan1, end: dec31 });
        const key = format(date, 'yyyy-MM-dd');
        const count = inYear ? (contributions[key] ?? 0) : 0;
        week.push({ date, count, inYear });
      }
      grid.push(week);
    }
    const monthLabels: (string | null)[] = [];
    let lastMonth = -1;
    for (let col = 0; col < numWeeks; col++) {
      const date = addDays(start, col * 7);
      const m = date.getMonth();
      if (m !== lastMonth && date.getFullYear() === year) {
        monthLabels[col] = MONTHS[m];
        lastMonth = m;
      } else {
        monthLabels[col] = null;
      }
    }
    return { grid, monthLabels };
  }, [year, contributions]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 animate-pulse">
        <div className="h-6 w-64 bg-muted rounded mb-4" />
        <div className="h-4 w-48 bg-muted rounded mb-6" />
        <div className="flex gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              {Array.from({ length: 53 }).map((_, j) => (
                <div key={j} className="w-3 h-3 rounded-sm bg-muted" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{totalContributions}</span>
            {' '}contributions in the last year
          </p>
        </div>

        <div className="flex gap-0.5 overflow-x-auto pb-2">
          <div className="flex flex-col gap-0.5 pr-2 shrink-0">
            <div className="h-3" />
            {WEEKDAYS.map((d) => (
              <span key={d} className="h-3 flex items-center text-xs text-muted-foreground">
                {d}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-0.5">
            {/* Month row */}
            <div className="flex gap-0.5 mb-0.5">
              {monthLabels.map((label, col) => (
                <div key={col} className="w-3 h-3 flex items-center">
                  {label ? (
                    <span className="text-[10px] text-muted-foreground -ml-0.5">{label}</span>
                  ) : null}
                </div>
              ))}
            </div>
            {/* Grid */}
            <div className="flex gap-0.5">
              {Array.from({ length: 53 }).map((_, col) => (
                <div key={col} className="flex flex-col gap-0.5">
                  {Array.from({ length: 7 }).map((_, row) => {
                    const { date, count, inYear } = grid[row][col];
                    const level = getLevel(count);
                    const dateStr = format(date, 'MMM d, yyyy');
                    return (
                      <Tooltip key={`${row}-${col}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'w-3 h-3 rounded-sm transition-all duration-150 cursor-default',
                              'hover:ring-2 hover:ring-primary/50 hover:ring-offset-1 hover:scale-110 hover:z-10',
                              !inYear && 'opacity-40',
                              level === 0 && 'bg-muted',
                              level === 1 && 'bg-emerald-300 dark:bg-emerald-600',
                              level === 2 && 'bg-emerald-400 dark:bg-emerald-500',
                              level === 3 && 'bg-emerald-500 dark:bg-emerald-400',
                              level === 4 && 'bg-emerald-600 dark:bg-emerald-300',
                            )}
                            aria-label={`${dateStr}: ${count} contributions`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="font-medium">
                          {count === 0
                            ? `No contributions on ${dateStr}`
                            : `${count} contribution${count !== 1 ? 's' : ''} on ${dateStr}`}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={cn(
                  'w-3 h-3 rounded-sm',
                  level === 0 && 'bg-muted',
                  level === 1 && 'bg-emerald-300 dark:bg-emerald-600',
                  level === 2 && 'bg-emerald-400 dark:bg-emerald-500',
                  level === 3 && 'bg-emerald-500 dark:bg-emerald-400',
                  level === 4 && 'bg-emerald-600 dark:bg-emerald-300',
                )}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
