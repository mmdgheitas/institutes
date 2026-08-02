/**
 * Client-side response types. Where the shared package already defines the
 * contract (dto.ts) we re-export it; these types cover the raw database-row
 * shapes the API returns for dashboard endpoints (snake_case columns).
 */
import type {
  CourseSummary,
  FormFieldSchema,
  FormSchema,
  Paginated,
  QuizAnswerValue,
  QuizQuestionAuthoring,
  QuizSummary,
  SubmissionRecord,
} from '@shared/dto';
import type {
  BookingStatus,
  LeadStatus,
  MediaKind,
  MediaStatus,
  PayoutStatus,
  TransactionType,
  VerificationStatus,
} from '@shared/enums';

export type { Paginated };

/* --------------------------------------------------------- institutes --- */

/** Raw institutes row (`selectAll`), snake_case — used by dashboard endpoints. */
export interface InstituteRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string;
  city: string;
  province: string | null;
  postal_code: string | null;
  latitude: number;
  longitude: number;
  rating: number;
  review_count: number;
  verification_status: VerificationStatus;
  verified_at: string | null;
  is_active: boolean;
  is_published: boolean;
  free_pre_registration: boolean;
  commission_percent: number;
  skills: string[];
  amenities: string[];
  working_hours: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  has_online_courses: boolean;
  has_active_discount: boolean;
  min_price: number | null;
  course_count: number;
  /** Present only on GET /institutes/mine. */
  is_owner?: boolean;
}

export interface VerificationDoc {
  id: string;
  doc_type: string;
  status: VerificationStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  url: string | null;
  title: string | null;
}

export interface PendingVerification {
  id: string;
  doc_type: string;
  created_at: string;
  institute_id: string;
  institute_name: string;
  city: string;
  document_url: string | null;
}

export interface InstructorRow {
  id: string;
  institute_id: string;
  user_id: string | null;
  full_name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  years_of_experience: number | null;
  specialties: string[];
  rating: number;
  review_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/* ----------------------------------------------------------- courses --- */

export interface CourseRow extends CourseSummary {
  description: string | null;
}

export interface ClassroomRow {
  id: string;
  institute_id: string;
  name: string;
  capacity: number;
  created_at: string;
}

export interface TimetableEntry {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  course_id: string;
  course_title: string;
  course_type: string;
  classroom_id: string | null;
  classroom_name: string | null;
}

/* ------------------------------------------------------------- forms --- */

export interface FormRow extends FormSchema {
  requiresOtp: boolean;
  submissionCount?: number;
}

export interface SlotRow {
  id: string;
  instituteId: string;
  courseId: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  status: BookingStatus;
  location: string | null;
}

export interface LeadDetail extends SubmissionRecord {
  email: string | null;
  formTitle: string;
  formFields: FormFieldSchema[];
  courseTitle: string | null;
  events: {
    id: string;
    fromStatus: LeadStatus | null;
    toStatus: LeadStatus | null;
    note: string | null;
    actorName: string | null;
    createdAt: string;
  }[];
  booking: {
    startsAt: string;
    endsAt: string;
    location: string | null;
    status: BookingStatus;
  } | null;
}

/* -------------------------------------------------------------- LMS ---- */

export interface QuizAuthoring extends QuizSummary {
  questions: QuizQuestionAuthoring[];
}

export interface AttemptRow {
  id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
  focus_loss_count: number;
  full_name: string;
  phone: string;
  pending_manual: number;
}

export interface CourseEnrollmentRow {
  id: string;
  status: string;
  progress_percent: number;
  enrolled_at: string;
  student_id: string;
  full_name: string;
  phone: string;
  email: string | null;
}

/* ---------------------------------------------------------- storage --- */

export interface MediaRow {
  id: string;
  institute_id: string | null;
  uploader_id: string | null;
  kind: MediaKind;
  status: MediaStatus;
  purpose: string;
  object_key: string;
  url: string | null;
  thumbnail_url: string | null;
  hls_url: string | null;
  mime_type: string;
  size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  title: string | null;
  position: number;
  is_public: boolean;
  created_at: string;
}

/* ---------------------------------------------------------- finance --- */

export interface PayoutRow {
  id: string;
  institute_id: string;
  amount: number;
  status: PayoutStatus;
  iban: string | null;
  note: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface AdminPayoutRow {
  id: string;
  amount: number;
  status: PayoutStatus;
  iban: string | null;
  created_at: string;
  institute_id: string;
  institute_name: string;
}

export interface WalletTransactionRow {
  id: string;
  institute_id: string;
  amount: number;
  type: TransactionType;
  payout_status: PayoutStatus;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

/* ------------------------------------------------------ notifications --- */

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: string;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

/* ----------------------------------------------------------- quiz ---- */

export interface QuizAnswerStored {
  question_id: string;
  value: QuizAnswerValue;
  client_updated_at: string;
  is_correct: boolean | null;
  awarded_points: number | null;
  needs_manual_grade: boolean;
  feedback: string | null;
}
