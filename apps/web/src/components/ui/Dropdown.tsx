'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface DropdownItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  divider?: boolean;
}

export function Dropdown({
  trigger,
  items,
  align = 'end',
  width = 'w-56',
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={clsx(
            'absolute z-40 mt-1.5 overflow-hidden rounded-card border border-slate-200 bg-white py-1 shadow-pop animate-fade-in',
            width,
            align === 'end' ? 'end-0' : 'start-0',
          )}
        >
          {items.map((item, index) => (
            <div key={item.id}>
              {item.divider && index > 0 && <div className="my-1 border-t border-slate-100" />}
              <button
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={clsx(
                  'flex w-full items-center gap-2.5 px-3.5 py-2 text-start text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  item.danger ? 'text-danger-600 hover:bg-danger-50' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                {item.icon && <span className="text-slate-400">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
