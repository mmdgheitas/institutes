'use client';

import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToasts } from '@/stores/toasts';

const kindStyles = {
  success: { icon: CheckCircle2, accent: 'text-success-600', bg: 'bg-success-50' },
  error: { icon: XCircle, accent: 'text-danger-600', bg: 'bg-danger-50' },
  info: { icon: Info, accent: 'text-secondary-600', bg: 'bg-secondary-50' },
  warning: { icon: AlertTriangle, accent: 'text-warning-600', bg: 'bg-warning-50' },
};

export function ToastViewport() {
  const { toasts, dismiss } = useToasts();

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((toast) => {
        const style = kindStyles[toast.kind];
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex animate-fade-in items-start gap-3 rounded-card border border-slate-200 bg-white p-3.5 shadow-pop ${style.bg}`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.accent}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-xs leading-5 text-slate-600">{toast.description}</p>}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="بستن اعلان"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
