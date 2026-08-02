'use client';

import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from 'lucide-react';
import { toPersianDigits } from '@/lib/format';
import { clsx } from 'clsx';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 px-1 py-3" aria-label="صفحه‌بندی">
      <p className="text-xs text-slate-500">
        نمایش {toPersianDigits((page - 1) * pageSize + 1)} تا {toPersianDigits(Math.min(page * pageSize, total))} از{' '}
        {toPersianDigits(total)} مورد
      </p>
      <div className="flex items-center gap-1">
        <button
          aria-label="صفحه اول"
          disabled={page === 1}
          onClick={() => onPageChange(1)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
        <button
          aria-label="صفحه قبل"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={clsx(
                'h-8 w-8 rounded-lg text-sm font-medium transition-colors',
                p === page ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {toPersianDigits(p)}
            </button>
          ),
        )}
        <button
          aria-label="صفحه بعد"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          aria-label="صفحه آخر"
          disabled={page === totalPages}
          onClick={() => onPageChange(totalPages)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
