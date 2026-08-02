import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Compass className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">صفحه پیدا نشد</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">آدرس وارد شده وجود ندارد یا منتقل شده است.</p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-control bg-primary-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          بازگشت به داشبورد
        </Link>
      </div>
    </main>
  );
}
