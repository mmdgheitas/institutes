export declare const UserRole: {
    readonly STUDENT: "STUDENT";
    readonly TEACHER: "TEACHER";
    readonly INSTITUTE_ADMIN: "INSTITUTE_ADMIN";
    readonly SUPER_ADMIN: "SUPER_ADMIN";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const VerificationStatus: {
    readonly UNVERIFIED: "UNVERIFIED";
    readonly PENDING: "PENDING";
    readonly VERIFIED: "VERIFIED";
    readonly REJECTED: "REJECTED";
};
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];
export declare const CourseType: {
    readonly ONLINE: "ONLINE";
    readonly IN_PERSON: "IN_PERSON";
    readonly HYBRID: "HYBRID";
};
export type CourseType = (typeof CourseType)[keyof typeof CourseType];
export declare const CourseLevel: {
    readonly BEGINNER: "BEGINNER";
    readonly INTERMEDIATE: "INTERMEDIATE";
    readonly ADVANCED: "ADVANCED";
    readonly ALL_LEVELS: "ALL_LEVELS";
};
export type CourseLevel = (typeof CourseLevel)[keyof typeof CourseLevel];
export declare const LeadStatus: {
    readonly NEW: "NEW";
    readonly CONTACTED: "CONTACTED";
    readonly INTERVIEWED: "INTERVIEWED";
    readonly ENROLLED: "ENROLLED";
    readonly CANCELLED: "CANCELLED";
};
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];
export declare const LEAD_STATUS_ORDER: LeadStatus[];
export declare const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]>;
export declare const FormFieldType: {
    readonly TEXT: "TEXT";
    readonly TEXTAREA: "TEXTAREA";
    readonly NUMBER: "NUMBER";
    readonly EMAIL: "EMAIL";
    readonly PHONE: "PHONE";
    readonly DATE: "DATE";
    readonly SELECT: "SELECT";
    readonly MULTI_SELECT: "MULTI_SELECT";
    readonly CHECKBOX: "CHECKBOX";
    readonly FILE: "FILE";
    readonly NATIONAL_ID: "NATIONAL_ID";
};
export type FormFieldType = (typeof FormFieldType)[keyof typeof FormFieldType];
export declare const QuestionType: {
    readonly MULTIPLE_CHOICE: "MULTIPLE_CHOICE";
    readonly MULTI_SELECT: "MULTI_SELECT";
    readonly TRUE_FALSE: "TRUE_FALSE";
    readonly SHORT_ANSWER: "SHORT_ANSWER";
    readonly ESSAY: "ESSAY";
    readonly FILE_UPLOAD: "FILE_UPLOAD";
};
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];
export declare const AUTO_GRADED_TYPES: QuestionType[];
export declare const AttemptStatus: {
    readonly IN_PROGRESS: "IN_PROGRESS";
    readonly SUBMITTED: "SUBMITTED";
    readonly AUTO_SUBMITTED: "AUTO_SUBMITTED";
    readonly GRADED: "GRADED";
    readonly VOIDED: "VOIDED";
};
export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];
export declare const EnrollmentStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly COMPLETED: "COMPLETED";
    readonly DROPPED: "DROPPED";
    readonly SUSPENDED: "SUSPENDED";
};
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];
export declare const TransactionType: {
    readonly ENROLLMENT_REVENUE: "ENROLLMENT_REVENUE";
    readonly PLATFORM_COMMISSION: "PLATFORM_COMMISSION";
    readonly PAYOUT: "PAYOUT";
    readonly REFUND: "REFUND";
    readonly ADJUSTMENT: "ADJUSTMENT";
};
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];
export declare const PayoutStatus: {
    readonly NONE: "NONE";
    readonly REQUESTED: "REQUESTED";
    readonly APPROVED: "APPROVED";
    readonly PAID: "PAID";
    readonly REJECTED: "REJECTED";
};
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];
export declare const MediaKind: {
    readonly IMAGE: "IMAGE";
    readonly VIDEO: "VIDEO";
    readonly AUDIO: "AUDIO";
    readonly DOCUMENT: "DOCUMENT";
    readonly PANORAMA_360: "PANORAMA_360";
};
export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];
export declare const MediaStatus: {
    readonly PENDING_UPLOAD: "PENDING_UPLOAD";
    readonly UPLOADED: "UPLOADED";
    readonly PROCESSING: "PROCESSING";
    readonly READY: "READY";
    readonly FAILED: "FAILED";
};
export type MediaStatus = (typeof MediaStatus)[keyof typeof MediaStatus];
export declare const LiveClassProvider: {
    readonly ADOBE_CONNECT: "ADOBE_CONNECT";
    readonly BIG_BLUE_BUTTON: "BIG_BLUE_BUTTON";
};
export type LiveClassProvider = (typeof LiveClassProvider)[keyof typeof LiveClassProvider];
export declare const BookingStatus: {
    readonly AVAILABLE: "AVAILABLE";
    readonly BOOKED: "BOOKED";
    readonly CANCELLED: "CANCELLED";
    readonly COMPLETED: "COMPLETED";
};
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];
export declare const CATEGORY_SLUGS: readonly ["languages", "programming", "music", "arts", "academic-tutoring", "test-prep", "business", "sports"];
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];
