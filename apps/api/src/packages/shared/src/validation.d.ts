import type { FormFieldSchema, SubmissionValue } from './dto';
export interface FieldError {
    key: string;
    message: string;
}
export declare function isValidEmail(value: string): boolean;
export declare function isValidMobile(value: string): boolean;
export declare function normalizeDigits(input: string): string;
export declare function normalizeMobile(value: string): string;
export declare function isValidNationalId(value: string): boolean;
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
export declare function validateField(field: FormFieldSchema, rawValue: SubmissionValue): string | null;
export interface FormValidationResult {
    valid: boolean;
    errors: FieldError[];
    sanitized: Record<string, SubmissionValue>;
}
export declare function validateSubmission(fields: FormFieldSchema[], data: Record<string, SubmissionValue>): FormValidationResult;
export declare function validatePassword(password: string): string | null;
export declare function slugifyBasic(input: string): string;
