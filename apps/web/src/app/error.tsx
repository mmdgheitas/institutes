'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled page error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-500">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">خطایی رخ داد</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          در هنگام نمایش این صفحه خطایی پیش آمد. می‌توانید دوباره تلاش کنید.
        </p>
        <Button className="mt-5" onClick={reset}>
          تلاش دوباره
        </Button>
      </div>
    </main>
  );
}
