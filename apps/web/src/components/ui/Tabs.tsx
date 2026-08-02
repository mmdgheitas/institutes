'use client';

import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface TabItem {
  id: string;
  label: ReactNode;
  badge?: number;
  content: ReactNode;
}

export function Tabs({ tabs, defaultTab, onChange }: { tabs: TabItem[]; defaultTab?: string; onChange?: (id: string) => void }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === current?.id}
            onClick={() => {
              setActive(tab.id);
              onChange?.(tab.id);
            }}
            className={clsx(
              'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab.id === current?.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            )}
          >
            {tab.label}
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[11px] font-bold text-primary-700">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="pt-4">{current?.content}</div>
    </div>
  );
}
