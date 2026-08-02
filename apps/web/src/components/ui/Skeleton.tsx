import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={twMerge(clsx('animate-skeleton-pulse rounded-lg bg-slate-200/70', className))}
    />
  );
}

export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

/** Grid of card-shaped skeletons used by list pages. */
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
