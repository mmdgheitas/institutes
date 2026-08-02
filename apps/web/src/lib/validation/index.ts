/**
 * Client-side validation helpers mirroring the API DTO rules
 * (class-validator decorators in the API's dto modules).
 * The server remains the authority — these only give instant Persian feedback.
 */

export const MOBILE_REGEX = /^09\d{9}$/;
export const IBAN_REGEX = /^IR\d{24}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const NATIONAL_ID_REGEX = /^\d{10}$/;

export function validatePhone(phone: string): string | null {
  const normalized = phone.replace(/[\s-]/g, '');
  if (!normalized) return 'شماره موبایل را وارد کنید';
  if (!MOBILE_REGEX.test(normalized)) return 'شماره موبایل معتبر نیست (مثال: 09121234567)';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'رمز عبور را وارد کنید';
  if (password.length < 8) return 'رمز عبور باید حداقل ۸ کاراکتر باشد';
  if (password.length > 128) return 'رمز عبور حداکثر ۱۲۸ کاراکتر است';
  return null;
}

export function validateOtp(code: string): string | null {
  if (!code) return 'کد تأیید را وارد کنید';
  if (!/^\d{4,8}$/.test(code)) return 'کد تأیید باید ۴ تا ۸ رقم باشد';
  return null;
}

export function validateIban(iban: string): string | null {
  const normalized = iban.replace(/\s/g, '').toUpperCase();
  if (!normalized) return 'شماره شبا را وارد کنید';
  if (!IBAN_REGEX.test(normalized)) return 'شماره شبا باید با IR شروع شود و ۲۴ رقم داشته باشد';
  return null;
}

export function validateTime(hhmm: string): string | null {
  if (!TIME_REGEX.test(hhmm)) return 'زمان باید به شکل HH:MM باشد';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return null; // optional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'ایمیل معتبر نیست';
  if (email.length > 160) return 'ایمیل حداکثر ۱۶۰ کاراکتر است';
  return null;
}

/** Validate a single form-builder field definition (client mirror of FormFieldDto). */
export function validateFormField(field: {
  key: string;
  label: string;
  type: string;
  options?: { label: string; value: string }[];
}): string | null {
  if (!field.key.trim()) return 'کلید فیلد را وارد کنید';
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,59}$/.test(field.key.trim())) {
    return 'کلید باید با حرف شروع شود و فقط حروف، عدد و _ داشته باشد';
  }
  if (!field.label.trim()) return 'برچسب فیلد را وارد کنید';
  if (field.label.trim().length > 160) return 'برچسب حداکثر ۱۶۰ کاراکتر است';
  if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
    if (!field.options || field.options.length < 2) {
      return 'فیلدهای انتخابی حداقل به ۲ گزینه نیاز دارند';
    }
    if ((field.options?.length ?? 0) > 50) return 'حداکثر ۵۰ گزینه مجاز است';
    const values = field.options.map((o) => o.value.trim());
    if (values.some((v) => !v)) return 'مقدار همه گزینه‌ها باید پر شود';
    if (new Set(values).size !== values.length) return 'مقادیر گزینه‌ها نباید تکراری باشند';
  }
  return null;
}

export function normalizeMobile(phone: string): string {
  return phone.replace(/[\s-]/g, '');
}

/** Friendly file size label in Persian. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}
