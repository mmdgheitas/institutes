'use client';

import { useState } from 'react';
import { GripVertical, Plus, Pencil, Trash2, Save } from 'lucide-react';
import { Input, Textarea, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { QUESTION_TYPE_FA, AUTO_GRADED_QUESTION_TYPES } from '@/lib/constants';
import { toPersianDigits } from '@/lib/format';
import type { QuestionType } from '@shared/enums';
import type { QuizOption } from '@shared/dto';

export interface QuizQuestionDraft {
  id?: string;
  type: QuestionType;
  prompt: string;
  points: string;
  options: QuizOption[];
  correctOptionIds: string[];
  correctText: string;
  explanation: string;
  allowedMimeTypes: string;
}

export interface QuizFormValues {
  title: string;
  description: string;
  timeLimitSeconds: string;
  maxScore: string;
  passingScore: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  antiCheatEnabled: boolean;
  maxFocusLosses: string;
  attemptsAllowed: string;
  opensAt: string;
  closesAt: string;
  isPublished: boolean;
  questions: QuizQuestionDraft[];
}

export function emptyQuizForm(): QuizFormValues {
  return {
    title: '',
    description: '',
    timeLimitSeconds: '1800',
    maxScore: '100',
    passingScore: '50',
    shuffleQuestions: true,
    shuffleOptions: true,
    antiCheatEnabled: true,
    maxFocusLosses: '3',
    attemptsAllowed: '1',
    opensAt: '',
    closesAt: '',
    isPublished: false,
    questions: [],
  };
}

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_FA) as QuestionType[];

const CHOICE_TYPES: QuestionType[] = ['MULTIPLE_CHOICE', 'MULTI_SELECT'];

function emptyQuestion(): QuizQuestionDraft {
  return {
    type: 'MULTIPLE_CHOICE',
    prompt: '',
    points: '1',
    options: [
      { id: crypto.randomUUID?.() ?? Math.random().toString(36), text: '' },
      { id: crypto.randomUUID?.() ?? Math.random().toString(36), text: '' },
    ],
    correctOptionIds: [],
    correctText: '',
    explanation: '',
    allowedMimeTypes: '',
  };
}

export function validateQuizForm(form: QuizFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.title.trim().length < 3) errors.title = 'عنوان آزمون حداقل ۳ کاراکتر است';
  const timeLimit = Number(form.timeLimitSeconds);
  if (!timeLimit || timeLimit < 30 || timeLimit > 86400) errors.timeLimitSeconds = 'مدت آزمون بین ۳۰ ثانیه تا ۲۴ ساعت است';
  if (Number(form.maxScore) <= 0) errors.maxScore = 'نمره کل باید بیشتر از صفر باشد';
  if (Number(form.passingScore) < 0) errors.passingScore = 'نمره قبولی معتبر نیست';
  if (Number(form.maxFocusLosses) < 0) errors.maxFocusLosses = 'حداکثر خروج از آزمون نمی‌تواند منفی باشد';
  if (Number(form.attemptsAllowed) < 1) errors.attemptsAllowed = 'حداقل یک تلاش مجاز است';
  if (form.opensAt && form.closesAt && form.opensAt >= form.closesAt) {
    errors.closesAt = 'زمان پایان باید بعد از شروع باشد';
  }
  const questionErrors: string[] = [];
  form.questions.forEach((question, index) => {
    if (question.prompt.trim().length < 3) questionErrors.push(`سؤال ${index + 1}: متن سؤال را کامل کنید`);
    if (Number(question.points) <= 0) questionErrors.push(`سؤال ${index + 1}: نمره باید بیشتر از صفر باشد`);
    if (CHOICE_TYPES.includes(question.type) && question.options.filter((o) => o.text.trim()).length < 2) {
      questionErrors.push(`سؤال ${index + 1}: حداقل ۲ گزینه لازم است`);
    }
    if (question.type === 'MULTIPLE_CHOICE' && question.correctOptionIds.length !== 1) {
      questionErrors.push(`سؤال ${index + 1}: دقیقاً یک گزینه صحیح انتخاب کنید`);
    }
    if (question.type === 'MULTI_SELECT' && question.correctOptionIds.length < 1) {
      questionErrors.push(`سؤال ${index + 1}: حداقل یک گزینه صحیح انتخاب کنید`);
    }
    if (question.type === 'SHORT_ANSWER' && !question.correctText.trim()) {
      questionErrors.push(`سؤال ${index + 1}: پاسخ صحیح را وارد کنید (با | جدا کنید)`);
    }
  });
  if (questionErrors.length > 0) errors.questions = questionErrors.slice(0, 3).join(' · ');
  return errors;
}

export function QuizForm({
  initial,
  submitting,
  onSubmit,
  submitLabel = 'ذخیره آزمون',
}: {
  initial: QuizFormValues;
  submitting: boolean;
  onSubmit: (values: QuizFormValues) => void;
  submitLabel?: string;
}) {
  const [form, setForm] = useState<QuizFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<{ index: number | null } | null>(null);
  const [draft, setDraft] = useState<QuizQuestionDraft>(emptyQuestion());
  const [draftError, setDraftError] = useState<string | null>(null);

  const set = <K extends keyof QuizFormValues>(key: K, value: QuizFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setDraft(emptyQuestion());
    setDraftError(null);
    setEditor({ index: null });
  };

  const openEdit = (index: number) => {
    const question = form.questions[index];
    setDraft({
      ...question,
      points: String(question.points),
      correctText: question.correctText ?? '',
      explanation: question.explanation ?? '',
    });
    setDraftError(null);
    setEditor({ index });
  };

  const saveDraft = () => {
    if (draft.prompt.trim().length < 3) {
      setDraftError('متن سؤال حداقل ۳ کاراکتر است');
      return;
    }
    if (Number(draft.points) <= 0) {
      setDraftError('نمره باید بیشتر از صفر باشد');
      return;
    }
    const cleanOptions = draft.options
      .filter((o) => o.text.trim())
      .map((o) => ({ ...o, text: o.text.trim() }));

    const question: QuizQuestionDraft = {
      ...draft,
      prompt: draft.prompt.trim(),
      points: draft.points,
      options: cleanOptions,
      correctOptionIds: draft.correctOptionIds.filter((id) => cleanOptions.some((o) => o.id === id)),
      correctText: draft.correctText.trim(),
      explanation: draft.explanation.trim(),
      allowedMimeTypes: draft.allowedMimeTypes,
    };

    setForm((current) => {
      if (editor?.index === null || editor?.index === undefined) return { ...current, questions: [...current.questions, question] };
      return {
        ...current,
        questions: current.questions.map((q, index) => (index === editor.index ? question : q)),
      };
    });
    setEditor(null);
    setDraftError(null);
  };

  const removeQuestion = (index: number) => {
    set('questions', form.questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= form.questions.length) return;
    const next = [...form.questions];
    [next[index], next[target]] = [next[target], next[index]];
    set('questions', next);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateQuizForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onSubmit(form);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 p-5">
      {errors.questions && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">{errors.questions}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="عنوان آزمون" required value={form.title} error={errors.title} onChange={(e) => set('title', e.target.value)} placeholder="مثلاً: آزمون میان‌ترم" />
        <Input label="توضیحات" value={form.description} onChange={(e) => set('description', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="مدت (ثانیه)" latin type="number" min={30} max={86400} value={form.timeLimitSeconds} error={errors.timeLimitSeconds} onChange={(e) => set('timeLimitSeconds', e.target.value)} />
          <Input label="نمره کل" latin type="number" min={1} value={form.maxScore} error={errors.maxScore} onChange={(e) => set('maxScore', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="نمره قبولی" latin type="number" min={0} value={form.passingScore} error={errors.passingScore} onChange={(e) => set('passingScore', e.target.value)} />
          <Input label="تعداد تلاش مجاز" latin type="number" min={1} value={form.attemptsAllowed} error={errors.attemptsAllowed} onChange={(e) => set('attemptsAllowed', e.target.value)} />
        </div>
        <Input label="زمان شروع (اختیاری)" latin type="datetime-local" value={form.opensAt} onChange={(e) => set('opensAt', e.target.value)} />
        <Input label="زمان پایان (اختیاری)" latin type="datetime-local" value={form.closesAt} error={errors.closesAt} onChange={(e) => set('closesAt', e.target.value)} />
      </div>

      <div className="grid gap-3 rounded-card border border-slate-200 p-4 sm:grid-cols-2">
        <Switch checked={form.shuffleQuestions} onChange={(v) => set('shuffleQuestions', v)} label="ترتیب سؤال‌ها تصادفی شود" />
        <Switch checked={form.shuffleOptions} onChange={(v) => set('shuffleOptions', v)} label="ترتیب گزینه‌ها تصادفی شود" />
        <Switch checked={form.antiCheatEnabled} onChange={(v) => set('antiCheatEnabled', v)} label="ضد تقلب (ردیابی خروج از برنامه)" />
        {form.antiCheatEnabled && (
          <Input label="حداکثر خروج از آزمون" latin type="number" min={0} value={form.maxFocusLosses} error={errors.maxFocusLosses} onChange={(e) => set('maxFocusLosses', e.target.value)} />
        )}
        <Switch checked={form.isPublished} onChange={(v) => set('isPublished', v)} label="انتشار آزمون (نمایش به دانش‌آموزان)" />
      </div>

      <div className="rounded-card border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-800">سؤال‌ها ({toPersianDigits(form.questions.length)})</p>
            <p className="text-xs text-slate-400">پاسخ صحیح فقط برای شما نمایش داده می‌شود</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            افزودن سؤال
          </Button>
        </div>
        <div className="flex flex-col gap-2 p-4">
          {form.questions.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">هنوز سؤالی اضافه نشده است.</p>
          )}
          {form.questions.map((question, index) => (
            <div key={index} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
              <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-semibold text-slate-800">
                  {toPersianDigits(index + 1)}. {question.prompt}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  {QUESTION_TYPE_FA[question.type]} · {toPersianDigits(Number(question.points))} نمره
                  {AUTO_GRADED_QUESTION_TYPES.includes(question.type) ? (
                    <Badge tone="green" className="px-1.5 py-0">تصحیح خودکار</Badge>
                  ) : (
                    <Badge tone="amber" className="px-1.5 py-0">تصحیح دستی</Badge>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => moveQuestion(index, -1)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200" aria-label="بالا">
                  ↑
                </button>
                <button type="button" onClick={() => moveQuestion(index, 1)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200" aria-label="پایین">
                  ↓
                </button>
                <button type="button" onClick={() => openEdit(index)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-primary-600" aria-label="ویرایش">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => removeQuestion(index)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-danger-600" aria-label="حذف">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={submitting}>
          <Save className="h-4 w-4" />
          {submitLabel}
        </Button>
      </div>

      {/* Question editor */}
      <Modal
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editor?.index === null ? 'افزودن سؤال' : 'ویرایش سؤال'}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {draftError && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">{draftError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="نوع سؤال" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as QuestionType, correctOptionIds: [] })}>
              {QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {QUESTION_TYPE_FA[type]}
                </option>
              ))}
            </Select>
            <Input label="نمره" latin type="number" min={0.1} step="0.1" value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} />
          </div>
          <Textarea label="متن سؤال" required value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} />

          {CHOICE_TYPES.includes(draft.type) && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-xs font-bold text-slate-600">
                گزینه‌ها {draft.type === 'MULTIPLE_CHOICE' ? '— یک گزینه صحیح' : '— چند گزینه صحیح'}:
              </p>
              <div className="flex flex-col gap-2">
                {draft.options.map((option, index) => {
                  const isCorrect = draft.correctOptionIds.includes(option.id);
                  return (
                    <div key={option.id} className="flex items-center gap-2">
                      <input
                        type={draft.type === 'MULTIPLE_CHOICE' ? 'radio' : 'checkbox'}
                        checked={isCorrect}
                        onChange={(e) => {
                          setDraft({
                            ...draft,
                            correctOptionIds:
                              draft.type === 'MULTIPLE_CHOICE'
                                ? e.target.checked
                                  ? [option.id]
                                  : []
                                : e.target.checked
                                  ? [...draft.correctOptionIds, option.id]
                                  : draft.correctOptionIds.filter((id) => id !== option.id),
                          });
                        }}
                        className="h-4 w-4 accent-primary-600"
                        aria-label={`گزینه صحیح ${index + 1}`}
                      />
                      <Input
                        value={option.text}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            options: draft.options.map((o, i) => (i === index ? { ...o, text: e.target.value } : o)),
                          })
                        }
                        placeholder={`گزینه ${toPersianDigits(index + 1)}`}
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
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      options: [...draft.options, { id: crypto.randomUUID?.() ?? Math.random().toString(36), text: '' }],
                    })
                  }
                  className="self-start text-xs font-semibold text-primary-600 hover:underline"
                >
                  + افزودن گزینه
                </button>
              </div>
            </div>
          )}

          {draft.type === 'TRUE_FALSE' && (
            <div className="flex gap-2">
              {['TRUE', 'FALSE'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft({ ...draft, correctText: value })}
                  className={`flex-1 rounded-control border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    draft.correctText === value
                      ? 'border-success-500 bg-success-50 text-success-700'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {value === 'TRUE' ? 'صحیح' : 'غلط'}
                </button>
              ))}
            </div>
          )}

          {draft.type === 'SHORT_ANSWER' && (
            <Input
              label="پاسخ‌های صحیح (با | جدا کنید)"
              latin
              value={draft.correctText}
              onChange={(e) => setDraft({ ...draft, correctText: e.target.value })}
              placeholder="IELTS|آیلتس"
            />
          )}

          {draft.type === 'FILE_UPLOAD' && (
            <Input
              label="پسوندهای مجاز (با ویرگول: .pdf,.jpg)"
              latin
              value={draft.allowedMimeTypes}
              onChange={(e) => setDraft({ ...draft, allowedMimeTypes: e.target.value })}
            />
          )}

          <Textarea label="راهنمای تصحیح / توضیح (اختیاری)" value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} />

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setEditor(null)}>
              انصراف
            </Button>
            <Button type="button" onClick={saveDraft}>
              {editor?.index === null ? 'افزودن سؤال' : 'ذخیره سؤال'}
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
