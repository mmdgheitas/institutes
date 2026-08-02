import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const baseControl =
  'w-full rounded-control border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-600/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const normalBorder = 'border-slate-300 hover:border-slate-400 focus:border-primary-600';
const errorBorder = 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20';

interface FieldShellProps {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  id: string;
  children: React.ReactNode;
}

export function FieldShell({ label, error, hint, required, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ms-1 text-danger-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  /** Render Latin content LTR (phones, IBANs, lat/lng, URLs). */
  latin?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, latin, required, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id}>
      <input
        ref={ref}
        id={id}
        dir={latin ? 'ltr' : undefined}
        className={twMerge(clsx(baseControl, error ? errorBorder : normalBorder, className))}
        {...props}
      />
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, required, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id}>
      <textarea
        ref={ref}
        id={id}
        className={twMerge(clsx(baseControl, 'min-h-24 resize-y', error ? errorBorder : normalBorder, className))}
        {...props}
      />
    </FieldShell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, required, className, id: idProp, children, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id}>
      <select
        ref={ref}
        id={id}
        className={twMerge(clsx(baseControl, 'cursor-pointer appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E")] bg-[position:left_0.75rem_center] bg-no-repeat pe-9 ps-9', error ? errorBorder : normalBorder, className))}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});
