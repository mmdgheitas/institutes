"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidEmail = isValidEmail;
exports.isValidMobile = isValidMobile;
exports.normalizeDigits = normalizeDigits;
exports.normalizeMobile = normalizeMobile;
exports.isValidNationalId = isValidNationalId;
exports.isPlainObject = isPlainObject;
exports.validateField = validateField;
exports.validateSubmission = validateSubmission;
exports.validatePassword = validatePassword;
exports.slugifyBasic = slugifyBasic;
/**
 * Shared, dependency-free validators.
 *
 * The dynamic form validator here is the single source of truth: the web client
 * uses it for instant feedback and the API re-runs the exact same function
 * before persisting a submission, so client and server can never disagree.
 */
const enums_1 = require("./enums");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Iranian mobile numbers, tolerant of +98 / 0098 / leading 0. */
const IR_MOBILE_RE = /^(?:\+98|0098|98|0)?9\d{9}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidEmail(value) {
    return EMAIL_RE.test(value.trim());
}
function isValidMobile(value) {
    return IR_MOBILE_RE.test(normalizeDigits(value).replace(/[\s-]/g, ''));
}
/** Convert Persian/Arabic-Indic digits to ASCII so validation never surprises. */
function normalizeDigits(input) {
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    return input.replace(/[۰-۹٠-٩]/g, (ch) => {
        const p = persian.indexOf(ch);
        if (p > -1)
            return String(p);
        return String(arabic.indexOf(ch));
    });
}
/** Normalize any accepted mobile format to the canonical `09xxxxxxxxx`. */
function normalizeMobile(value) {
    const digits = normalizeDigits(value).replace(/[^\d+]/g, '');
    const stripped = digits.replace(/^(\+98|0098|98)/, '').replace(/^0/, '');
    return `0${stripped}`;
}
/** Iranian national ID checksum (کد ملی). */
function isValidNationalId(value) {
    const id = normalizeDigits(value).replace(/\D/g, '');
    if (id.length !== 10)
        return false;
    if (/^(\d)\1{9}$/.test(id))
        return false;
    const check = Number(id[9]);
    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
        sum += Number(id[i]) * (10 - i);
    }
    const remainder = sum % 11;
    return remainder < 2 ? check === remainder : check === 11 - remainder;
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isEmpty(value) {
    if (value === null || value === undefined)
        return true;
    if (typeof value === 'string')
        return value.trim().length === 0;
    if (Array.isArray(value))
        return value.length === 0;
    if (typeof value === 'boolean')
        return false;
    return false;
}
function isFileValue(value) {
    return (isPlainObject(value) &&
        typeof value.mediaId === 'string' &&
        typeof value.fileName === 'string');
}
/**
 * Validate one dynamic form field value against its schema.
 * Returns `null` when the value is acceptable.
 */
function validateField(field, rawValue) {
    if (isEmpty(rawValue)) {
        return field.required ? `${field.label} is required` : null;
    }
    switch (field.type) {
        case enums_1.FormFieldType.TEXT:
        case enums_1.FormFieldType.TEXTAREA: {
            if (typeof rawValue !== 'string')
                return `${field.label} must be text`;
            const text = rawValue.trim();
            if (field.minLength != null && text.length < field.minLength) {
                return `${field.label} must be at least ${field.minLength} characters`;
            }
            if (field.maxLength != null && text.length > field.maxLength) {
                return `${field.label} must be at most ${field.maxLength} characters`;
            }
            if (field.pattern) {
                let re;
                try {
                    re = new RegExp(field.pattern);
                }
                catch {
                    return null; // A broken admin-supplied pattern must not block a student.
                }
                if (!re.test(text))
                    return `${field.label} has an invalid format`;
            }
            return null;
        }
        case enums_1.FormFieldType.NUMBER: {
            const num = typeof rawValue === 'number' ? rawValue : Number(normalizeDigits(String(rawValue)));
            if (!Number.isFinite(num))
                return `${field.label} must be a number`;
            if (field.min != null && num < field.min) {
                return `${field.label} must be at least ${field.min}`;
            }
            if (field.max != null && num > field.max) {
                return `${field.label} must be at most ${field.max}`;
            }
            return null;
        }
        case enums_1.FormFieldType.EMAIL:
            if (typeof rawValue !== 'string' || !isValidEmail(rawValue)) {
                return `${field.label} must be a valid email address`;
            }
            return null;
        case enums_1.FormFieldType.PHONE:
            if (typeof rawValue !== 'string' || !isValidMobile(rawValue)) {
                return `${field.label} must be a valid mobile number`;
            }
            return null;
        case enums_1.FormFieldType.NATIONAL_ID:
            if (typeof rawValue !== 'string' || !isValidNationalId(rawValue)) {
                return `${field.label} must be a valid national ID`;
            }
            return null;
        case enums_1.FormFieldType.DATE: {
            if (typeof rawValue !== 'string' || !DATE_RE.test(rawValue)) {
                return `${field.label} must be a date (YYYY-MM-DD)`;
            }
            const parsed = new Date(`${rawValue}T00:00:00Z`);
            if (Number.isNaN(parsed.getTime())) {
                return `${field.label} is not a real date`;
            }
            return null;
        }
        case enums_1.FormFieldType.SELECT: {
            if (typeof rawValue !== 'string')
                return `${field.label} must be a single choice`;
            const allowed = (field.options ?? []).map((o) => o.value);
            if (!allowed.includes(rawValue))
                return `${field.label} has an unsupported option`;
            return null;
        }
        case enums_1.FormFieldType.MULTI_SELECT: {
            if (!Array.isArray(rawValue))
                return `${field.label} must be a list of choices`;
            const allowed = new Set((field.options ?? []).map((o) => o.value));
            const invalid = rawValue.filter((v) => !allowed.has(v));
            if (invalid.length)
                return `${field.label} has unsupported options: ${invalid.join(', ')}`;
            return null;
        }
        case enums_1.FormFieldType.CHECKBOX:
            if (typeof rawValue !== 'boolean')
                return `${field.label} must be true or false`;
            if (field.required && rawValue !== true)
                return `${field.label} must be accepted`;
            return null;
        case enums_1.FormFieldType.FILE:
            if (!isFileValue(rawValue))
                return `${field.label} must be an uploaded file`;
            return null;
        default:
            return null;
    }
}
/** Validate a whole dynamic submission against a form's field schema. */
function validateSubmission(fields, data) {
    const errors = [];
    const sanitized = {};
    for (const field of fields) {
        const value = Object.prototype.hasOwnProperty.call(data, field.key)
            ? data[field.key]
            : null;
        const message = validateField(field, value);
        if (message) {
            errors.push({ key: field.key, message });
            continue;
        }
        sanitized[field.key] = sanitizeValue(field, value);
    }
    return { valid: errors.length === 0, errors, sanitized };
}
function sanitizeValue(field, value) {
    if (isEmpty(value))
        return null;
    switch (field.type) {
        case enums_1.FormFieldType.TEXT:
        case enums_1.FormFieldType.TEXTAREA:
            return typeof value === 'string' ? value.trim() : value;
        case enums_1.FormFieldType.NUMBER:
            return typeof value === 'number' ? value : Number(normalizeDigits(String(value)));
        case enums_1.FormFieldType.EMAIL:
            return typeof value === 'string' ? value.trim().toLowerCase() : value;
        case enums_1.FormFieldType.PHONE:
            return typeof value === 'string' ? normalizeMobile(value) : value;
        case enums_1.FormFieldType.NATIONAL_ID:
            return typeof value === 'string' ? normalizeDigits(value).replace(/\D/g, '') : value;
        default:
            return value;
    }
}
/** Password policy shared by registration and password-reset flows. */
function validatePassword(password) {
    if (password.length < 8)
        return 'Password must be at least 8 characters';
    if (password.length > 128)
        return 'Password must be at most 128 characters';
    if (!/[a-z]/.test(password))
        return 'Password must contain a lowercase letter';
    if (!/[A-Z]/.test(password))
        return 'Password must contain an uppercase letter';
    if (!/\d/.test(password))
        return 'Password must contain a digit';
    return null;
}
/** URL-safe slug generator (ASCII + Persian letters preserved as transliterated dashes). */
function slugifyBasic(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}
//# sourceMappingURL=validation.js.map