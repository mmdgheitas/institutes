'use client';

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import type { RevenuePoint } from '@shared/dto';
import { toPersianDigits, formatIRRCompact } from '@/lib/format';

/** Month label: 'YYYY-MM' → Jalali short month name. */
function monthLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const label = new Intl.DateTimeFormat('fa-IR', { month: 'short' }).format(date);
  return label.replace('‏', '').trim();
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const chartData = data.map((point) => ({
    ...point,
    label: monthLabel(point.period),
  }));

  return (
    <div dir="ltr" className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => toPersianDigits(v)} />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(v: number) => formatIRRCompact(v)}
            width={72}
          />
          <Tooltip
            formatter={(value: number | string, name: string) => [
              formatIRRCompact(Number(value)),
              name === 'gross' ? 'درآمد ناخالص' : name === 'commission' ? 'کارمزد' : name === 'net' ? 'درآمد خالص' : name,
            ]}
            labelFormatter={(label) => toPersianDigits(String(label))}
            contentStyle={{ direction: 'rtl', borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }}
          />
          <Legend formatter={(value) => (value === 'gross' ? 'درآمد ناخالص' : value === 'commission' ? 'کارمزد' : 'درآمد خالص')} />
          <Bar dataKey="gross" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="commission" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line type="monotone" dataKey="net" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
