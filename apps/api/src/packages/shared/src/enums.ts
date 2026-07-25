/**
 * Domain enumerations shared between the NestJS API and the Next.js clients.
 * Keep these in sync with `apps/api/prisma/schema.prisma`.
 */

export const UserRole = {
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  INSTITUTE_ADMIN: 'INSTITUTE_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const VerificationStatus = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type VerificationStatus =
  (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const CourseType = {
  ONLINE: 'ONLINE',
  IN_PERSON: 'IN_PERSON',
  HYBRID: 'HYBRID',
} as const;
export type CourseType = (typeof CourseType)[keyof typeof CourseType];

export const CourseLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  ALL_LEVELS: 'ALL_LEVELS',
} as const;
export type CourseLevel = (typeof CourseLevel)[keyof typeof CourseLevel];

/** Kanban columns for the institute CRM lead board. */
export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  INTERVIEWED: 'INTERVIEWED',
  ENROLLED: 'ENROLLED',
  CANCELLED: 'CANCELLED',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.INTERVIEWED,
  LeadStatus.ENROLLED,
  LeadStatus.CANCELLED,
];

/**
 * Allowed lead transitions. A lead may always be cancelled, may move one step
 * forward, or be pulled one step back (except out of a terminal state).
 */
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['CONTACTED', 'CANCELLED'],
  CONTACTED: ['INTERVIEWED', 'ENROLLED', 'NEW', 'CANCELLED'],
  INTERVIEWED: ['ENROLLED', 'CONTACTED', 'CANCELLED'],
  ENROLLED: ['CANCELLED'],
  CANCELLED: ['NEW'],
};

export const FormFieldType = {
  TEXT: 'TEXT',
  TEXTAREA: 'TEXTAREA',
  NUMBER: 'NUMBER',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  DATE: 'DATE',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  CHECKBOX: 'CHECKBOX',
  FILE: 'FILE',
  NATIONAL_ID: 'NATIONAL_ID',
} as const;
export type FormFieldType = (typeof FormFieldType)[keyof typeof FormFieldType];

export const QuestionType = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  MULTI_SELECT: 'MULTI_SELECT',
  TRUE_FALSE: 'TRUE_FALSE',
  SHORT_ANSWER: 'SHORT_ANSWER',
  ESSAY: 'ESSAY',
  FILE_UPLOAD: 'FILE_UPLOAD',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

/** Question types the engine can grade without a human in the loop. */
export const AUTO_GRADED_TYPES: QuestionType[] = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.MULTI_SELECT,
  QuestionType.TRUE_FALSE,
  QuestionType.SHORT_ANSWER,
];

export const AttemptStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  AUTO_SUBMITTED: 'AUTO_SUBMITTED',
  GRADED: 'GRADED',
  VOIDED: 'VOIDED',
} as const;
export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

export const EnrollmentStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  DROPPED: 'DROPPED',
  SUSPENDED: 'SUSPENDED',
} as const;
export type EnrollmentStatus =
  (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export const TransactionType = {
  ENROLLMENT_REVENUE: 'ENROLLMENT_REVENUE',
  PLATFORM_COMMISSION: 'PLATFORM_COMMISSION',
  PAYOUT: 'PAYOUT',
  REFUND: 'REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const PayoutStatus = {
  NONE: 'NONE',
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
} as const;
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];

export const MediaKind = {
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  DOCUMENT: 'DOCUMENT',
  PANORAMA_360: 'PANORAMA_360',
} as const;
export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];

export const MediaStatus = {
  PENDING_UPLOAD: 'PENDING_UPLOAD',
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type MediaStatus = (typeof MediaStatus)[keyof typeof MediaStatus];

export const LiveClassProvider = {
  ADOBE_CONNECT: 'ADOBE_CONNECT',
  BIG_BLUE_BUTTON: 'BIG_BLUE_BUTTON',
} as const;
export type LiveClassProvider =
  (typeof LiveClassProvider)[keyof typeof LiveClassProvider];

export const BookingStatus = {
  AVAILABLE: 'AVAILABLE',
  BOOKED: 'BOOKED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

/** Categories used for map pin icons and discovery filters. */
export const CATEGORY_SLUGS = [
  'languages',
  'programming',
  'music',
  'arts',
  'academic-tutoring',
  'test-prep',
  'business',
  'sports',
] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];
