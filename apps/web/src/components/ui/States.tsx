import type { ReactNode } from 'react';
import { Inbox, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 py-16 text-center ${className ?? ''}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <div>
        <p className="font-semibold text-slate-800">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'خطا در دریافت اطلاعات',
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 px-6 py-16 text-center ${className ?? ''}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-500">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div>
        <p className="font-semibold text-slate-800">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          تلاش دوباره
        </Button>
      )}
    </div>
  );
}

export function PageLoading({ label = 'در حال بارگذاری…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
