import { describe, expect, it } from 'vitest';
import {
  validatePhone,
  validatePassword,
  validateOtp,
  validateIban,
  validateTime,
  validateEmail,
  validateFormField,
  normalizeMobile,
  formatBytes,
} from '@/lib/validation';

describe('validatePhone (mirrors API MOBILE_REGEX 09\\d{9})', () => {
  it('accepts valid iranian mobiles', () => {
    expect(validatePhone('09121234567')).toBeNull();
    expect(validatePhone('09120000001')).toBeNull();
  });

  it('rejects invalid numbers', () => {
    expect(validatePhone('')).not.toBeNull();
    expect(validatePhone('02188776655')).not.toBeNull();
    expect(validatePhone('19121234567')).not.toBeNull();
    expect(validatePhone('0912123456')).not.toBeNull();
  });
});

describe('validatePassword (API: min 8, max 128)', () => {
  it('accepts long enough passwords', () => {
    expect(validatePassword('Password123')).toBeNull();
  });

  it('rejects short or empty passwords', () => {
    expect(validatePassword('')).not.toBeNull();
    expect(validatePassword('1234567')).not.toBeNull();
  });
});

describe('validateOtp (API: length 4-8)', () => {
  it('accepts 4-8 digit codes', () => {
    expect(validateOtp('11111')).toBeNull();
    expect(validateOtp('1234')).toBeNull();
    expect(validateOtp('12345678')).toBeNull();
  });

  it('rejects wrong lengths and non-digits', () => {
    expect(validateOtp('')).not.toBeNull();
    expect(validateOtp('123')).not.toBeNull();
    expect(validateOtp('123456789')).not.toBeNull();
    expect(validateOtp('abcde')).not.toBeNull();
  });
});

describe('validateIban (API: IR + 24 digits)', () => {
  it('accepts valid iranian ibans', () => {
    expect(validateIban('IR820540102680020817909002')).toBeNull();
    expect(validateIban('IR820540102680020817909002'.replace(/(.{4})/g, '$1 ').trim())).toBeNull();
  });

  it('rejects invalid ibans', () => {
    expect(validateIban('')).not.toBeNull();
    expect(validateIban('IR82054010268002081790900')).not.toBeNull();
    expect(validateIban('DE89370400440532013000')).not.toBeNull();
    expect(validateIban('IR82054010268002081790900X')).not.toBeNull();
  });
});

describe('validateTime (API TIME_REGEX HH:mm)', () => {
  it('accepts valid times', () => {
    expect(validateTime('09:00')).toBeNull();
    expect(validateTime('23:59')).toBeNull();
  });

  it('rejects invalid times', () => {
    expect(validateTime('24:00')).not.toBeNull();
    expect(validateTime('9:00')).not.toBeNull();
    expect(validateTime('09-00')).not.toBeNull();
  });
});

describe('validateEmail', () => {
  it('accepts valid emails and empty (optional)', () => {
    expect(validateEmail('sara@example.com')).toBeNull();
    expect(validateEmail('')).toBeNull();
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('not-an-email')).not.toBeNull();
  });
});

describe('validateFormField (mirrors FormFieldDto rules)', () => {
  it('requires a valid key and label', () => {
    expect(validateFormField({ key: '', label: 'x', type: 'TEXT' })).not.toBeNull();
    expect(validateFormField({ key: '1bad', label: 'x', type: 'TEXT' })).not.toBeNull();
    expect(validateFormField({ key: 'english_level', label: 'سطح زبان', type: 'TEXT' })).toBeNull();
  });

  it('requires at least 2 options with unique values for SELECT', () => {
    expect(
      validateFormField({
        key: 'level',
        label: 'Level',
        type: 'SELECT',
        options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
      }),
    ).toBeNull();

    expect(
      validateFormField({
        key: 'level',
        label: 'Level',
        type: 'SELECT',
        options: [{ label: 'A', value: 'a' }],
      }),
    ).not.toBeNull();

    expect(
      validateFormField({
        key: 'level',
        label: 'Level',
        type: 'SELECT',
        options: [
          { label: 'A', value: 'dup' },
          { label: 'B', value: 'dup' },
        ],
      }),
    ).not.toBeNull();
  });
});

describe('normalizeMobile', () => {
  it('strips spaces and dashes', () => {
    expect(normalizeMobile('0912 123 4567')).toBe('09121234567');
    expect(normalizeMobile('0912-123-4567')).toBe('09121234567');
  });
});

describe('formatBytes', () => {
  it('formats bytes to readable units', () => {
    expect(formatBytes(512)).toContain('بایت');
    expect(formatBytes(2048)).toContain('کیلوبایت');
    expect(formatBytes(5 * 1024 * 1024)).toContain('مگابایت');
    expect(formatBytes(null)).toBe('—');
  });
});
