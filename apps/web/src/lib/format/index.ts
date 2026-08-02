/**
 * Persian (fa-IR) formatting helpers: digits, numbers, currency and Jalali dates.
 * All UI text renders through these so formatting can never drift.
 */

/** Convert any digits in a string to Persian digits (۰-۹). */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/** Format a number with thousands separators in Persian digits. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('fa-IR').format(value);
}

/** Format an amount in IRR. Amounts are integers — the API stores no decimals. */
export function formatIRR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${formatNumber(Math.round(value))} تومان`;
}

/** Compact amount for dashboard cards: ۱۲/۵ میلیون تومان */
export function formatIRRCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${formatNumber(Number((value / 1_000_000_000).toFixed(1)))} میلیارد تومان`;
  if (abs >= 1_000_000) return `${formatNumber(Number((value / 1_000_000).toFixed(1)))} میلیون تومان`;
  if (abs >= 1_000) return `${formatNumber(Number((value / 1_000).toFixed(0)))} هزار تومان`;
  return formatIRR(value);
}

/** Format a percentage with one decimal in Persian digits + Persian separator. */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const fixed = value.toFixed(digits).replace('.', '٫');
  return `${toPersianDigits(fixed)}٪`;
}

/** 15:30 → ۱۵:۳۰ (kept RTL-safe: use <span dir="ltr"> at call sites). */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return '—';
  return toPersianDigits(hhmm);
}

/** "2026-08-02T10:00:00Z" → Jalali date string, e.g. «۱۱ مرداد ۱۴۰۵». */
export function formatJalaliDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/** Short form: ۱۴۰۵/۰۵/۱۱ */
export function formatJalaliShort(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Jalali date + time: «۱۱ مرداد ۱۴۰۵، ۱۴:۳۰». */
export function formatJalaliDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Relative time: «۵ دقیقه پیش», «۲ روز پیش». */
export function formatRelative(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' });

  const minutes = Math.round(diffMs / 60_000);
  const hours = Math.round(diffMs / 3_600_000);
  const days = Math.round(diffMs / 86_400_000);
  const weeks = Math.round(diffMs / 604_800_000);
  const months = Math.round(diffMs / 2_592_000_000);
  const years = Math.round(diffMs / 31_536_000_000);

  if (abs < 60_000) return rtf.format(Math.round(diffMs / 1_000), 'second');
  if (abs < 3_600_000) return rtf.format(minutes, 'minute');
  if (abs < 86_400_000) return rtf.format(hours, 'hour');
  if (abs < 604_800_000) return rtf.format(days, 'day');
  if (abs < 2_592_000_000) return rtf.format(weeks, 'week');
  if (abs < 31_536_000_000) return rtf.format(months, 'month');
  return rtf.format(years, 'year');
}

/** Local Gregorian ISO date-time for <input type="datetime-local">. */
export function toLocalInputValue(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parse a datetime-local value back into an ISO string. */
export function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}

/** Weekday index (0=Sunday, matching the API) → Persian weekday name. */
export const WEEKDAYS_FA = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
];

/** API dayOfWeek (0 = Sunday) → Persian label. */
export function weekdayFa(dayOfWeek: number): string {
  return WEEKDAYS_FA[((dayOfWeek % 7) + 7) % 7] ?? '—';
}
