'use client';

import { useState } from 'react';
import { GripVertical, Plus, Pencil, Trash2, MoveUp, MoveDown, Save } from 'lucide-react';
import { Input, Textarea, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { FORM_FIELD_TYPE_FA, OPTION_FIELD_TYPES } from '@/lib/constants';
import { validateFormField } from '@/lib/validation';
import { toPersianDigits } from '@/lib/format';
import type { FormFieldSchema, FormFieldOption } from '@shared/dto';
import type { FormFieldType } from '@shared/enums';

export interface FormBuilderPayload {
  title: string;
  description: string;
  fields: FormFieldSchema[];
  requiresContract: boolean;
  contractText: string;
  requiresOtp: boolean;
  isActive: boolean;
}

const FIELD_TYPES = Object.keys(FORM_FIELD_TYPE_FA) as FormFieldType[];

interface FieldDraft {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string;
  helpText: string;
  options: FormFieldOption[];
  minLength: string;
  maxLength: string;
  min: string;
  max: string;
  pattern: string;
  acceptedMimeTypes: string;
  maxFileSizeMb: string;
}

function emptyDraft(): FieldDraft {
  return {
    key: '',
    label: '',
    type: 'TEXT',
    required: false,
    placeholder: '',
    helpText: '',
    options: [
      { label: '', value: '' },
      { label: '', value: '' },
    ],
    minLength: '',
    maxLength: '',
    min: '',
    max: '',
    pattern: '',
    acceptedMimeTypes: '',
    maxFileSizeMb: '10',
  };
}

function schemaToDraft(field: FormFieldSchema): FieldDraft {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    placeholder: field.placeholder ?? '',
    helpText: field.helpText ?? '',
    options: field.options?.length
      ? field.options.map((o) => ({ ...o }))
      : [
          { label: '', value: '' },
          { label: '', value: '' },
        ],
    minLength: field.minLength != null ? String(field.minLength) : '',
    maxLength: field.maxLength != null ? String(field.maxLength) : '',
    min: field.min != null ? String(field.min) : '',
    max: field.max != null ? String(field.max) : '',
    pattern: field.pattern ?? '',
    acceptedMimeTypes: field.acceptedMimeTypes?.join(', ') ?? '',
    maxFileSizeMb: field.maxFileSizeMb != null ? String(field.maxFileSizeMb) : '10',
  };
}

export function FormBuilder({
  initial,
  submitting,
  onSubmit,
}: {
  initial?: FormBuilderPayload;
  submitting: boolean;
  onSubmit: (payload: FormBuilderPayload) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [requiresContract, setRequiresContract] = useState(initial?.requiresContract ?? false);
  const [contractText, setContractText] = useState(initial?.contractText ?? '');
  const [requiresOtp, setRequiresOtp] = useState(initial?.requiresOtp ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [fields, setFields] = useState<FormFieldSchema[]>(initial?.fields ?? []);
  const [editor, setEditor] = useState<{ index: number | null } | null>(null);
  const [draft, setDraft] = useState<FieldDraft>(emptyDraft());
  const [draftError, setDraftError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openCreate = () => {
    setDraft(emptyDraft());
    setDraftError(null);
    setEditor({ index: null });
  };

  const openEdit = (index: number) => {
    setDraft(schemaToDraft(fields[index]));
    setDraftError(null);
    setEditor({ index });
  };

  const closeEditor = () => {
    setEditor(null);
    setDraftError(null);
  };

  const saveDraft = () => {
    const field: FormFieldSchema = {
      key: draft.key.trim(),
      label: draft.label.trim(),
      type: draft.type,
      required: draft.required,
      placeholder: draft.placeholder.trim() || undefined,
      helpText: draft.helpText.trim() || undefined,
      options:
        OPTION_FIELD_TYPES.includes(draft.type) && draft.options.some((o) => o.label.trim() || o.value.trim())
          ? draft.options
              .filter((o) => o.label.trim() || o.value.trim())
              .map((o) => ({ label: o.label.trim(), value: o.value.trim() || o.label.trim() }))
          : undefined,
      minLength: draft.minLength ? Number(draft.minLength) : undefined,
      maxLength: draft.maxLength ? Number(draft.maxLength) : undefined,
      min: draft.min ? Number(draft.min) : undefined,
      max: draft.max ? Number(draft.max) : undefined,
      pattern: draft.pattern.trim() || undefined,
      acceptedMimeTypes: draft.acceptedMimeTypes
        ? draft.acceptedMimeTypes.split(',').map((m) => m.trim()).filter(Boolean)
        : undefined,
      maxFileSizeMb: draft.maxFileSizeMb ? Number(draft.maxFileSizeMb) : undefined,
      position: 0,
    };

    const validationError = validateFormField(field);
    if (validationError) {
      setDraftError(validationError);
      return;
    }

    setFields((current) => {
      if (editor?.index === null || editor?.index === undefined) return [...current, field];
      return current.map((f, index) => (index === editor.index ? field : f));
    });
    closeEditor();
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  };

  const remove = (index: number) => {
    setFields((current) => current.filter((_, i) => i !== index));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (title.trim().length < 3) nextErrors.title = 'عنوان فرم حداقل ۳ کاراکتر است';
    if (fields.length === 0) nextErrors.fields = 'حداقل یک فیلد اضافه کنید';
    if (requiresContract && contractText.trim().length < 10) {
      nextErrors.contractText = 'متن قرارداد حداقل ۱۰ کاراکتر است';
    }
    for (const field of fields) {
      const fieldError = validateFormField(field);
      if (fieldError) {
        nextErrors.fields = `فیلد «${field.label}»: ${fieldError}`;
        break;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      fields: fields.map((field, index) => ({ ...field, position: index })),
      requiresContract,
      contractText: contractText.trim(),
      requiresOtp,
      isActive,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="عنوان فرم"
          required
          value={title}
          error={errors.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثلاً: پیش‌ثبت‌نام دوره آیلتس"
        />
        <Input
          label="توضیحات کوتاه"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="مثلاً: پس از ثبت، هماهنگ می‌کنیم"
        />
      </div>

      <div className="rounded-card border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-800">فیلدهای فرم ({toPersianDigits(fields.length)})</p>
            <p className="text-xs text-slate-400">فیلدها به همین ترتیب به دانش‌آموز نمایش داده می‌شوند</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            افزودن فیلد
          </Button>
        </div>

        {errors.fields && (
          <p className="border-b border-danger-100 bg-danger-50 px-4 py-2 text-xs text-danger-600">{errors.fields}</p>
        )}

        <div className="flex flex-col gap-2 p-4">
          {fields.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">هنوز فیلدی اضافه نشده است. با «افزودن فیلد» شروع کنید.</p>
          )}
          {fields.map((field, index) => (
            <div key={`${field.key}-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
              <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{field.label}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span dir="ltr">{field.key}</span> · {FORM_FIELD_TYPE_FA[field.type]}
                  {field.required && (
                    <Badge tone="red" className="px-1.5 py-0">
                      الزامی
                    </Badge>
                  )}
                  {field.options && <span>· {toPersianDigits(field.options.length)} گزینه</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => move(index, -1)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200" aria-label="انتقال به بالا">
                  <MoveUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => move(index, 1)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200" aria-label="انتقال به پایین">
                  <MoveDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => openEdit(index)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-primary-600" aria-label="ویرایش فیلد">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => remove(index)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-danger-600" aria-label="حذف فیلد">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 rounded-card border border-slate-200 p-4 sm:grid-cols-2">
        <Switch checked={requiresContract} onChange={setRequiresContract} label="نیاز به پذیرش قرارداد" />
        <Switch checked={requiresOtp} onChange={setRequiresOtp} label="تأیید شماره با کد SMS" />
        <Switch checked={isActive} onChange={setIsActive} label="فرم فعال باشد (پذیرش پاسخ جدید)" />
        {requiresContract && (
          <div className="sm:col-span-2">
            <Textarea
              label="متن قرارداد"
              required
              value={contractText}
              error={errors.contractText}
              onChange={(e) => setContractText(e.target.value)}
              placeholder="متن کامل توافق‌نامه که دانش‌آموز می‌پذیرد…"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={submitting}>
          <Save className="h-4 w-4" />
          {initial ? 'ذخیره تغییرات' : 'ساخت فرم'}
        </Button>
      </div>

      {/* Field editor modal */}
      <Modal
        open={editor !== null}
        onClose={closeEditor}
        title={editor?.index === null ? 'افزودن فیلد' : 'ویرایش فیلد'}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {draftError && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">{draftError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="کلید (key)"
              latin
              required
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              placeholder="english_level"
            />
            <Select label="نوع فیلد" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as FormFieldType })}>
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {FORM_FIELD_TYPE_FA[type]}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="برچسب نمایشی"
            required
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="مثلاً: سطح زبان انگلیسی"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="متن راهنما (placeholder)" value={draft.placeholder} onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })} />
            <Input label="توضیح کمکی (help text)" value={draft.helpText} onChange={(e) => setDraft({ ...draft, helpText: e.target.value })} />
          </div>

          {OPTION_FIELD_TYPES.includes(draft.type) && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-xs font-bold text-slate-600">گزینه‌ها</p>
              <div className="flex flex-col gap-2">
                {draft.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      latin
                      placeholder="مقدار"
                      value={option.value}
                      onChange={(e) =>
                        setDraft({ ...draft, options: draft.options.map((o, i) => (i === index ? { ...o, value: e.target.value } : o)) })
                      }
                    />
                    <Input
                      placeholder="برچسب نمایشی"
                      value={option.label}
                      onChange={(e) =>
                        setDraft({ ...draft, options: draft.options.map((o, i) => (i === index ? { ...o, label: e.target.value } : o)) })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, options: draft.options.filter((_, i) => i !== index) })}
                      className="shrink-0 rounded-lg p-2 text-slate-400 hover:text-danger-600"
                      aria-label="حذف گزینه"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, options: [...draft.options, { label: '', value: '' }] })}
                  className="self-start text-xs font-semibold text-primary-600 hover:underline"
                >
                  + افزودن گزینه
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Switch checked={draft.required} onChange={(v) => setDraft({ ...draft, required: v })} label="فیلد اجباری باشد" />
            {draft.type === 'FILE' && (
              <>
                <Input label="حداکثر حجم (مگابایت)" latin type="number" value={draft.maxFileSizeMb} onChange={(e) => setDraft({ ...draft, maxFileSizeMb: e.target.value })} />
                <div className="sm:col-span-2">
                  <Input
                    label="پسوندهای مجاز (با ویرگول: .pdf,.jpg)"
                    latin
                    value={draft.acceptedMimeTypes}
                    onChange={(e) => setDraft({ ...draft, acceptedMimeTypes: e.target.value })}
                  />
                </div>
              </>
            )}
            {(draft.type === 'TEXT' || draft.type === 'TEXTAREA') && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="حداقل طول" latin type="number" value={draft.minLength} onChange={(e) => setDraft({ ...draft, minLength: e.target.value })} />
                <Input label="حداکثر طول" latin type="number" value={draft.maxLength} onChange={(e) => setDraft({ ...draft, maxLength: e.target.value })} />
              </div>
            )}
            {draft.type === 'NUMBER' && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="حداقل" latin type="number" value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value })} />
                <Input label="حداکثر" latin type="number" value={draft.max} onChange={(e) => setDraft({ ...draft, max: e.target.value })} />
              </div>
            )}
            {draft.type === 'TEXT' && (
              <Input label="الگوی Regex (اختیاری)" latin value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} placeholder="^[0-9]{10}$" />
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={closeEditor}>
              انصراف
            </Button>
            <Button type="button" onClick={saveDraft}>
              {editor?.index === null ? 'افزودن فیلد' : 'ذخیره فیلد'}
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
