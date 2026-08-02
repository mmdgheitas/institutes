import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeTone = 'slate' | 'blue' | 'violet' | 'amber' | 'green' | 'red' | 'cyan';

const toneClasses: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  green: 'bg-green-50 text-green-700 ring-green-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Optional dot colour (hex) in front of the label. */
  dot?: string;
}

export function Badge({ tone = 'slate', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
          toneClasses[tone],
          className,
        ),
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
      {children}
    </span>
  );
}

/** Map a hex colour to the closest badge tone (for enum→badge helpers). */
export function hexToTone(hex: string): BadgeTone {
  switch (hex) {
    case '#3B82F6':
    case '#2563EB':
    case '#0EA5E9':
      return 'blue';
    case '#8B5CF6':
      return 'violet';
    case '#F59E0B':
      return 'amber';
    case '#16A34A':
      return 'green';
    case '#DC2626':
    case '#EF4444':
      return 'red';
    default:
      return 'slate';
  }
}
