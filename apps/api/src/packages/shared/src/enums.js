"use strict";
/**
 * Domain enumerations shared between the NestJS API and the Next.js clients.
 * Keep these in sync with `apps/api/prisma/schema.prisma`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_SLUGS = exports.BookingStatus = exports.LiveClassProvider = exports.MediaStatus = exports.MediaKind = exports.PayoutStatus = exports.TransactionType = exports.EnrollmentStatus = exports.AttemptStatus = exports.AUTO_GRADED_TYPES = exports.QuestionType = exports.FormFieldType = exports.LEAD_TRANSITIONS = exports.LEAD_STATUS_ORDER = exports.LeadStatus = exports.CourseLevel = exports.CourseType = exports.VerificationStatus = exports.UserRole = void 0;
exports.UserRole = {
    STUDENT: 'STUDENT',
    TEACHER: 'TEACHER',
    INSTITUTE_ADMIN: 'INSTITUTE_ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN',
};
exports.VerificationStatus = {
    UNVERIFIED: 'UNVERIFIED',
    PENDING: 'PENDING',
    VERIFIED: 'VERIFIED',
    REJECTED: 'REJECTED',
};
exports.CourseType = {
    ONLINE: 'ONLINE',
    IN_PERSON: 'IN_PERSON',
    HYBRID: 'HYBRID',
};
exports.CourseLevel = {
    BEGINNER: 'BEGINNER',
    INTERMEDIATE: 'INTERMEDIATE',
    ADVANCED: 'ADVANCED',
    ALL_LEVELS: 'ALL_LEVELS',
};
/** Kanban columns for the institute CRM lead board. */
exports.LeadStatus = {
    NEW: 'NEW',
    CONTACTED: 'CONTACTED',
    INTERVIEWED: 'INTERVIEWED',
    ENROLLED: 'ENROLLED',
    CANCELLED: 'CANCELLED',
};
exports.LEAD_STATUS_ORDER = [
    exports.LeadStatus.NEW,
    exports.LeadStatus.CONTACTED,
    exports.LeadStatus.INTERVIEWED,
    exports.LeadStatus.ENROLLED,
    exports.LeadStatus.CANCELLED,
];
/**
 * Allowed lead transitions. A lead may always be cancelled, may move one step
 * forward, or be pulled one step back (except out of a terminal state).
 */
exports.LEAD_TRANSITIONS = {
    NEW: ['CONTACTED', 'CANCELLED'],
    CONTACTED: ['INTERVIEWED', 'ENROLLED', 'NEW', 'CANCELLED'],
    INTERVIEWED: ['ENROLLED', 'CONTACTED', 'CANCELLED'],
    ENROLLED: ['CANCELLED'],
    CANCELLED: ['NEW'],
};
exports.FormFieldType = {
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
};
exports.QuestionType = {
    MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
    MULTI_SELECT: 'MULTI_SELECT',
    TRUE_FALSE: 'TRUE_FALSE',
    SHORT_ANSWER: 'SHORT_ANSWER',
    ESSAY: 'ESSAY',
    FILE_UPLOAD: 'FILE_UPLOAD',
};
/** Question types the engine can grade without a human in the loop. */
exports.AUTO_GRADED_TYPES = [
    exports.QuestionType.MULTIPLE_CHOICE,
    exports.QuestionType.MULTI_SELECT,
    exports.QuestionType.TRUE_FALSE,
    exports.QuestionType.SHORT_ANSWER,
];
exports.AttemptStatus = {
    IN_PROGRESS: 'IN_PROGRESS',
    SUBMITTED: 'SUBMITTED',
    AUTO_SUBMITTED: 'AUTO_SUBMITTED',
    GRADED: 'GRADED',
    VOIDED: 'VOIDED',
};
exports.EnrollmentStatus = {
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    DROPPED: 'DROPPED',
    SUSPENDED: 'SUSPENDED',
};
exports.TransactionType = {
    ENROLLMENT_REVENUE: 'ENROLLMENT_REVENUE',
    PLATFORM_COMMISSION: 'PLATFORM_COMMISSION',
    PAYOUT: 'PAYOUT',
    REFUND: 'REFUND',
    ADJUSTMENT: 'ADJUSTMENT',
};
exports.PayoutStatus = {
    NONE: 'NONE',
    REQUESTED: 'REQUESTED',
    APPROVED: 'APPROVED',
    PAID: 'PAID',
    REJECTED: 'REJECTED',
};
exports.MediaKind = {
    IMAGE: 'IMAGE',
    VIDEO: 'VIDEO',
    AUDIO: 'AUDIO',
    DOCUMENT: 'DOCUMENT',
    PANORAMA_360: 'PANORAMA_360',
};
exports.MediaStatus = {
    PENDING_UPLOAD: 'PENDING_UPLOAD',
    UPLOADED: 'UPLOADED',
    PROCESSING: 'PROCESSING',
    READY: 'READY',
    FAILED: 'FAILED',
};
exports.LiveClassProvider = {
    ADOBE_CONNECT: 'ADOBE_CONNECT',
    BIG_BLUE_BUTTON: 'BIG_BLUE_BUTTON',
};
exports.BookingStatus = {
    AVAILABLE: 'AVAILABLE',
    BOOKED: 'BOOKED',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED',
};
/** Categories used for map pin icons and discovery filters. */
exports.CATEGORY_SLUGS = [
    'languages',
    'programming',
    'music',
    'arts',
    'academic-tutoring',
    'test-prep',
    'business',
    'sports',
];
//# sourceMappingURL=enums.js.map