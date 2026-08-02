import { describe, expect, it } from 'vitest';
import {
  toPersianDigits,
  formatNumber,
  formatIRR,
  formatIRRCompact,
  formatPercent,
  formatTime,
  formatJalaliDate,
  formatRelative,
  weekdayFa,
  WEEKDAYS_FA,
} from '@/lib/format';

describe('toPersianDigits', () => {
  it('converts latin digits to persian digits', () => {
    expect(toPersianDigits('09121234567')).toBe('۰۹۱۲۱۲۳۴۵۶۷');
    expect(toPersianDigits(123)).toBe('۱۲۳');
  });

  it('leaves non-digit characters untouched', () => {
    expect(toPersianDigits('IR820')).toBe('IR۸۲۰');
  });
});

describe('formatNumber', () => {
  it('adds thousands separators in persian digits', () => {
    expect(formatNumber(1_250_000)).toBe('۱٬۲۵۰٬۰۰۰');
  });

  it('handles null/undefined/NaN as dash', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
    expect(formatNumber(Number.NaN)).toBe('—');
  });
});

describe('formatIRR', () => {
  it('renders amounts with the تومان suffix', () => {
    expect(formatIRR(5_000_000)).toBe('۵٬۰۰۰٬۰۰۰ تومان');
  });

  it('rounds fractional amounts (API never sends decimals)', () => {
    expect(formatIRR(1500.6)).toBe('۱٬۵۰۱ تومان');
  });
});

describe('formatIRRCompact', () => {
  it('compacts millions', () => {
    expect(formatIRRCompact(12_500_000)).toBe('۱۲٫۵ میلیون تومان');
  });

  it('compacts billions', () => {
    expect(formatIRRCompact(2_000_000_000)).toBe('۲ میلیارد تومان');
  });

  it('falls back to plain IRR for small amounts', () => {
    expect(formatIRRCompact(950_000)).toBe('۹۵۰ هزار تومان');
  });
});

describe('formatPercent', () => {
  it('renders a percent with one decimal', () => {
    expect(formatPercent(12.345)).toBe('۱۲٫۳٪');
  });
});

describe('formatTime', () => {
  it('converts HH:mm to persian digits', () => {
    expect(formatTime('17:30')).toBe('۱۷:۳۰');
  });
});

describe('formatJalaliDate', () => {
  it('renders a gregorian date as a persian calendar date', () => {
    // 2026-08-02 is 11 Mordad 1405.
    expect(formatJalaliDate('2026-08-02T10:00:00Z')).toContain('۱۴۰۵');
    expect(formatJalaliDate('2026-08-02T10:00:00Z')).toContain('مرداد');
  });

  it('handles null and invalid dates', () => {
    expect(formatJalaliDate(null)).toBe('—');
    expect(formatJalaliDate('not-a-date')).toBe('—');
  });
});

describe('formatRelative', () => {
  it('renders minutes ago', () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelative(iso)).toContain('پیش');
  });
});

describe('weekdayFa', () => {
  it('maps 0 = Sunday to یکشنبه (API convention)', () => {
    expect(WEEKDAYS_FA[0]).toBe('یکشنبه');
    expect(WEEKDAYS_FA[6]).toBe('شنبه');
    expect(weekdayFa(0)).toBe('یکشنبه');
    expect(weekdayFa(6)).toBe('شنبه');
  });

  it('handles out-of-range values', () => {
    expect(weekdayFa(9)).toBe('سه‌شنبه'); // 9 % 7 = 2
    expect(weekdayFa(-1)).toBe('شنبه'); // wraps
  });
});
