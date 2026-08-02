/**
 * Persian labels for every domain enum — the single place status text is
 * translated. UI code must use these, never hard-code status strings.
 */
import {
  AttemptStatus,
  BookingStatus,
  CourseLevel,
  CourseType,
  EnrollmentStatus,
  FormFieldType,
  LeadStatus,
  MediaKind,
  MediaStatus,
  PayoutStatus,
  QuestionType,
  TransactionType,
  UserRole,
  VerificationStatus,
} from '@shared/enums';

export const USER_ROLE_FA: Record<UserRole, string> = {
  STUDENT: 'دانش‌آموز',
  TEACHER: 'مدرس',
  INSTITUTE_ADMIN: 'مدیر آموزشگاه',
  SUPER_ADMIN: 'مدیر سامانه',
};

export const VERIFICATION_STATUS_FA: Record<VerificationStatus, string> = {
  UNVERIFIED: 'تأیید نشده',
  PENDING: 'در انتظار بررسی',
  VERIFIED: 'تأیید شده',
  REJECTED: 'رد شده',
};

export const COURSE_TYPE_FA: Record<CourseType, string> = {
  ONLINE: 'آنلاین',
  IN_PERSON: 'حضوری',
  HYBRID: 'ترکیبی',
};

export const COURSE_LEVEL_FA: Record<CourseLevel, string> = {
  BEGINNER: 'مقدماتی',
  INTERMEDIATE: 'متوسط',
  ADVANCED: 'پیشرفته',
  ALL_LEVELS: 'همه سطوح',
};

export const LEAD_STATUS_FA: Record<LeadStatus, string> = {
  NEW: 'جدید',
  CONTACTED: 'تماس گرفته شده',
  INTERVIEWED: 'مصاحبه شده',
  ENROLLED: 'ثبت‌نام شده',
  CANCELLED: 'لغو شده',
};

export const FORM_FIELD_TYPE_FA: Record<FormFieldType, string> = {
  TEXT: 'متن کوتاه',
  TEXTAREA: 'متن بلند',
  NUMBER: 'عدد',
  EMAIL: 'ایمیل',
  PHONE: 'شماره موبایل',
  DATE: 'تاریخ',
  SELECT: 'انتخاب تکی',
  MULTI_SELECT: 'انتخاب چندگانه',
  CHECKBOX: 'چک‌باکس',
  FILE: 'بارگذاری فایل',
  NATIONAL_ID: 'کد ملی',
};

export const QUESTION_TYPE_FA: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'چندگزینه‌ای',
  MULTI_SELECT: 'چند انتخابی',
  TRUE_FALSE: 'صحیح/غلط',
  SHORT_ANSWER: 'پاسخ کوتاه',
  ESSAY: 'تشریحی',
  FILE_UPLOAD: 'بارگذاری فایل',
};

export const ATTEMPT_STATUS_FA: Record<AttemptStatus, string> = {
  IN_PROGRESS: 'در حال انجام',
  SUBMITTED: 'ارسال شده',
  AUTO_SUBMITTED: 'ارسال خودکار',
  GRADED: 'تصحیح شده',
  VOIDED: 'باطل شده',
};

export const ENROLLMENT_STATUS_FA: Record<EnrollmentStatus, string> = {
  ACTIVE: 'فعال',
  COMPLETED: 'تکمیل شده',
  DROPPED: 'انصراف داده',
  SUSPENDED: 'معلق',
};

export const TRANSACTION_TYPE_FA: Record<TransactionType, string> = {
  ENROLLMENT_REVENUE: 'درآمد ثبت‌نام',
  PLATFORM_COMMISSION: 'کارمزد سامانه',
  PAYOUT: 'تسویه حساب',
  REFUND: 'بازگشت وجه',
  ADJUSTMENT: 'اصلاحیه',
};

export const PAYOUT_STATUS_FA: Record<PayoutStatus, string> = {
  NONE: '—',
  REQUESTED: 'درخواست شده',
  APPROVED: 'تأیید شده',
  PAID: 'پرداخت شده',
  REJECTED: 'رد شده',
};

export const MEDIA_KIND_FA: Record<MediaKind, string> = {
  IMAGE: 'تصویر',
  VIDEO: 'ویدئو',
  AUDIO: 'صدا',
  DOCUMENT: 'مدرک',
  PANORAMA_360: 'پانورامای ۳۶۰',
};

export const MEDIA_STATUS_FA: Record<MediaStatus, string> = {
  PENDING_UPLOAD: 'در انتظار بارگذاری',
  UPLOADED: 'بارگذاری شده',
  PROCESSING: 'در حال پردازش',
  READY: 'آماده',
  FAILED: 'ناموفق',
};

export const BOOKING_STATUS_FA: Record<BookingStatus, string> = {
  AVAILABLE: 'آزاد',
  BOOKED: 'رزرو شده',
  CANCELLED: 'لغو شده',
  COMPLETED: 'انجام شده',
};

/** Lead → badge colour (hex), identical to the mobile Kanban colours. */
export const LEAD_COLORS: Record<LeadStatus, string> = {
  NEW: '#3B82F6',
  CONTACTED: '#8B5CF6',
  INTERVIEWED: '#F59E0B',
  ENROLLED: '#16A34A',
  CANCELLED: '#6B7280',
};

export const VERIFICATION_COLORS: Record<VerificationStatus, string> = {
  UNVERIFIED: '#64748B',
  PENDING: '#F59E0B',
  VERIFIED: '#16A34A',
  REJECTED: '#DC2626',
};

export const ATTEMPT_COLORS: Record<AttemptStatus, string> = {
  IN_PROGRESS: '#0EA5E9',
  SUBMITTED: '#F59E0B',
  AUTO_SUBMITTED: '#F59E0B',
  GRADED: '#16A34A',
  VOIDED: '#DC2626',
};

export const ENROLLMENT_COLORS: Record<EnrollmentStatus, string> = {
  ACTIVE: '#16A34A',
  COMPLETED: '#0EA5E9',
  DROPPED: '#6B7280',
  SUSPENDED: '#DC2626',
};

export const PAYOUT_COLORS: Record<PayoutStatus, string> = {
  NONE: '#64748B',
  REQUESTED: '#F59E0B',
  APPROVED: '#0EA5E9',
  PAID: '#16A34A',
  REJECTED: '#DC2626',
};

export const TRANSACTION_COLORS: Record<TransactionType, string> = {
  ENROLLMENT_REVENUE: '#16A34A',
  PLATFORM_COMMISSION: '#F59E0B',
  PAYOUT: '#DC2626',
  REFUND: '#0EA5E9',
  ADJUSTMENT: '#64748B',
};

/** Form field types that need `options` (SELECT / MULTI_SELECT). */
export const OPTION_FIELD_TYPES: FormFieldType[] = [
  FormFieldType.SELECT,
  FormFieldType.MULTI_SELECT,
];

/** Question types the API can auto-grade. */
export const AUTO_GRADED_QUESTION_TYPES: QuestionType[] = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.MULTI_SELECT,
  QuestionType.TRUE_FALSE,
  QuestionType.SHORT_ANSWER,
];
