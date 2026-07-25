/**
 * Kysely table typings — the hand-written mirror of `migrations/*.sql`.
 *
 * Prisma is intentionally not used: PostGIS geography columns have no Prisma
 * native type and every discovery query is raw spatial SQL anyway. Kysely gives
 * full type-safety over the same SQL with zero codegen/binaries.
 */
import type {
  ColumnType,
  Generated,
  Insertable,
  JSONColumnType,
  Selectable,
  Updateable,
} from 'kysely';

export type UserRoleDb = 'STUDENT' | 'TEACHER' | 'INSTITUTE_ADMIN' | 'SUPER_ADMIN';
export type VerificationStatusDb = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type CourseTypeDb = 'ONLINE' | 'IN_PERSON' | 'HYBRID';
export type CourseLevelDb = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';
export type LeadStatusDb = 'NEW' | 'CONTACTED' | 'INTERVIEWED' | 'ENROLLED' | 'CANCELLED';
export type QuestionTypeDb =
  | 'MULTIPLE_CHOICE'
  | 'MULTI_SELECT'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'ESSAY'
  | 'FILE_UPLOAD';
export type AttemptStatusDb =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'AUTO_SUBMITTED'
  | 'GRADED'
  | 'VOIDED';
export type EnrollmentStatusDb = 'ACTIVE' | 'COMPLETED' | 'DROPPED' | 'SUSPENDED';
export type TransactionTypeDb =
  | 'ENROLLMENT_REVENUE'
  | 'PLATFORM_COMMISSION'
  | 'PAYOUT'
  | 'REFUND'
  | 'ADJUSTMENT';
export type PayoutStatusDb = 'NONE' | 'REQUESTED' | 'APPROVED' | 'PAID' | 'REJECTED';
export type MediaKindDb = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'PANORAMA_360';
export type MediaStatusDb =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';
export type LiveClassProviderDb = 'ADOBE_CONNECT' | 'BIG_BLUE_BUTTON';
export type BookingStatusDb = 'AVAILABLE' | 'BOOKED' | 'CANCELLED' | 'COMPLETED';

/** `timestamptz` — select as Date, insert/update accepting Date or ISO string. */
type Timestamp = ColumnType<Date, Date | string, Date | string>;
type TimestampAuto = ColumnType<Date, Date | string | undefined, Date | string>;
/** `numeric` is returned by pg as a string to avoid float precision loss. */
type Numeric = ColumnType<string, number | string, number | string>;

export interface UsersTable {
  id: Generated<string>;
  phone: string;
  email: string | null;
  password_hash: string | null;
  full_name: string;
  role: ColumnType<UserRoleDb, UserRoleDb | undefined, UserRoleDb>;
  avatar_url: string | null;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  phone_verified: ColumnType<boolean, boolean | undefined, boolean>;
  last_login_at: Timestamp | null;
  created_at: TimestampAuto;
  updated_at: TimestampAuto;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  revoked_at: Timestamp | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: TimestampAuto;
}

export interface OtpCodesTable {
  id: Generated<string>;
  user_id: string | null;
  phone: string;
  code_hash: string;
  purpose: string;
  expires_at: Timestamp;
  consumed_at: Timestamp | null;
  attempts: ColumnType<number, number | undefined, number>;
  created_at: TimestampAuto;
}

export interface CategoriesTable {
  id: Generated<string>;
  slug: string;
  name: string;
  name_fa: string | null;
  icon: ColumnType<string, string | undefined, string>;
  color: ColumnType<string, string | undefined, string>;
  position: ColumnType<number, number | undefined, number>;
  created_at: TimestampAuto;
}

export interface InstitutesTable {
  id: Generated<string>;
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
  /** geography(Point,4326) — never selected directly; maintained by trigger. */
  location: ColumnType<never, never, never> | null;
  rating: ColumnType<number, number | undefined, number>;
  review_count: ColumnType<number, number | undefined, number>;
  verification_status: ColumnType<
    VerificationStatusDb,
    VerificationStatusDb | undefined,
    VerificationStatusDb
  >;
  verified_at: Timestamp | null;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  is_published: ColumnType<boolean, boolean | undefined, boolean>;
  free_pre_registration: ColumnType<boolean, boolean | undefined, boolean>;
  commission_percent: ColumnType<number, number | undefined, number>;
  skills: ColumnType<string[], string[] | undefined, string[]>;
  amenities: ColumnType<string[], string[] | undefined, string[]>;
  working_hours: JSONColumnType<Record<string, string> | null, string | null, string | null>;
  has_online_courses: ColumnType<boolean, boolean | undefined, boolean>;
  has_active_discount: ColumnType<boolean, boolean | undefined, boolean>;
  min_price: ColumnType<string | null, number | string | null | undefined, number | string | null>;
  course_count: ColumnType<number, number | undefined, number>;
  created_at: TimestampAuto;
  updated_at: TimestampAuto;
}

export interface InstituteCategoriesTable {
  institute_id: string;
  category_id: string;
  is_primary: ColumnType<boolean, boolean | undefined, boolean>;
}

export interface InstituteMembersTable {
  id: Generated<string>;
  institute_id: string;
  user_id: string;
  role: ColumnType<UserRoleDb, UserRoleDb | undefined, UserRoleDb>;
  is_owner: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: TimestampAuto;
}

export interface MediaTable {
  id: Generated<string>;
  institute_id: string | null;
  uploader_id: string | null;
  kind: MediaKindDb;
  status: ColumnType<MediaStatusDb, MediaStatusDb | undefined, MediaStatusDb>;
  purpose: string;
  object_key: string;
  url: string | null;
  thumbnail_url: string | null;
  hls_url: string | null;
  mime_type: string;
  size_bytes: ColumnType<string | null, number | string | null, number | string | null>;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  title: string | null;
  position: ColumnType<number, number | undefined, number>;
  is_public: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: TimestampAuto;
  updated_at: TimestampAuto;
}

export interface VerificationDocumentsTable {
  id: Generated<string>;
  institute_id: string;
  media_id: string | null;
  doc_type: string;
  status: ColumnType<
    VerificationStatusDb,
    VerificationStatusDb | undefined,
    VerificationStatusDb
  >;
  review_note: string | null;
  reviewed_at: Timestamp | null;
  created_at: TimestampAuto;
}

export interface InstructorsTable {
  id: Generated<string>;
  institute_id: string;
  user_id: string | null;
  full_name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  years_of_experience: number | null;
  specialties: ColumnType<string[], string[] | undefined, string[]>;
  rating: ColumnType<number, number | undefined, number>;
  review_count: ColumnType<number, number | undefined, number>;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: TimestampAuto;
  updated_at: TimestampAuto;
}

export interface CoursesTable {
  id: Generated<string>;
  institute_id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  type: ColumnType<CourseTypeDb, CourseTypeDb | undefined, CourseTypeDb>;
  level: ColumnType<CourseLevelDb, CourseLevelDb | undefined, CourseLevelDb>;
  price: Numeric;
  discount_percent: ColumnType<number, number | undefined, number>;
  currency: ColumnType<string, string | undefined, string>;
  duration_hours: ColumnType<number, number | undefined, number>;
  capacity: ColumnType<number, number | undefined, number>;
  enrolled_count: ColumnType<number, number | undefined, number>;
  start_date: Timestamp | null;
  end_date: Timestamp | null;
  schedule: JSONColumnType<CourseScheduleJson, string | undefined, string>;
  is_published: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: TimestampAuto;
  updated_at: TimestampAuto;
}

export type CourseScheduleJson = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
}[];

export interface CourseInstructorsTable {
  course_id: string;
  instructor_id: string;
}

export interface ClassroomsTable {
  id: Generated<string>;
  institute_id: string;
  name: string;
  capacity: ColumnType<number, number | undefined, number>;
  created_at: TimestampAuto;
}

export interface TimetableEntriesTable {
  id: Generated<string>;
  course_id: string;
  classroom_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: TimestampAuto;
}

export interface FormsTable {
  id: Generated<string>;
  institute_id: string;
  title: string;
  description: string | null;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  requires_contract: ColumnType<boolean, boolean | undefined, boolean>;
  contract_text: string | null;
  requires_otp: ColumnType<boolean, boolean | undefined, boolean>;
  fields: JSONColumnType<unknown[], string | undefined, string>;
  created_at: TimestampAuto;
  updated_at: TimestampAuto;
}

export interface SubmissionsTable {
  id: Generated<string>;
  form_id: string;
  institute_id: string;
  course_id: string | null;
  student_id: string;
  status: ColumnType<LeadStatusDb, LeadStatusDb | undefined, LeadStatusDb>;
  data: JSONColumnType<Record<string, unknown>, string | undefined, string>;
  note: string | null;
  contract_accepted_at: Timestamp | null;
  contract_ip: string | null;
  contract_user_agent: string | null;
  sms_confirmed_at: Timestamp | null;
  board_position: ColumnType<number, number | undefined, number>;
  created_at: TimestampAuto;
  updated_at: TimestampAuto;
}

export interface SubmissionEventsTable {
  id: Generated<string>;
  submission_id: string;
  from_status: LeadStatusDb | null;
  to_status: LeadStatusDb;
  actor_id: string | null;
  note: string | null;
  created_at: TimestampAuto;
}

export interface TimeSlotsTable {
  id: Generated<string>;
  institute_id: string;
  course_id: string | null;
  starts_at: Timestamp;
  ends_at: Timestamp;
  capacity: ColumnType<number, number | undefined, number>;
  booked_count: ColumnType<number, number | undefined, number>;
  status: ColumnType<BookingStatusDb, BookingStatusDb | undefined, BookingStatusDb>;
  location: string | null;
  created_at: TimestampAuto;
}

export interface SlotBookingsTable {
  id: Generated<string>;
  slot_id: string;
  student_id: string;
  submission_id: string | null;
  status: ColumnType<BookingStatusDb, BookingStatusDb | undefined, BookingStatusDb>;
  created_at: TimestampAuto;
}

export interface EnrollmentsTable {
  id: Generated<string>;
  course_id: string;
  student_id: string;
  submission_id: string | null;
  status: ColumnType<EnrollmentStatusDb, EnrollmentStatusDb | undefined, EnrollmentStatusDb>;
  progress_percent: ColumnType<number, number | undefined, number>;
  price_paid: Numeric;
  enrolled_at: TimestampAuto;
  completed_at: Timestamp | null;
}

export interface QuizzesTable {
  id: Generated<string>;
  course_id: string;
  title: string;
  description: string | null;
  time_limit_seconds: ColumnType<number, number | undefined, number>;
  max_score: ColumnType<number, number | undefined, number>;
  passing_score: ColumnType<number, number | undefined, number>;
  shuffle_questions: ColumnType<boolean, boolean | undefined, boolean>;
  shuffle_options: ColumnType<boolean, boolean | undefined, boolean>;
  anti_cheat_enabled: ColumnType<boolean, boolean | undefined, boolean>;
  max_focus_losses: ColumnType<number, number | undefined, number>;
  attempts_allowed: ColumnType<number, number | undefined, number>;
  opens_at: Timestamp | null;
  closes_at: Timestamp | null;
  is_published: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: TimestampAuto;
  updated_at: TimestampAuto;
}

export type QuizOptionsJson = { id: string; text: string }[];

export interface QuizQuestionsTable {
  id: Generated<string>;
  quiz_id: string;
  type: QuestionTypeDb;
  prompt: string;
  points: ColumnType<number, number | undefined, number>;
  options: JSONColumnType<QuizOptionsJson, string | undefined, string>;
  correct_option_ids: ColumnType<string[], string[] | undefined, string[]>;
  correct_text: string | null;
  explanation: string | null;
  allowed_mime_types: ColumnType<string[], string[] | undefined, string[]>;
  position: ColumnType<number, number | undefined, number>;
  created_at: TimestampAuto;
}

export interface QuizAttemptsTable {
  id: Generated<string>;
  quiz_id: string;
  student_id: string;
  status: ColumnType<AttemptStatusDb, AttemptStatusDb | undefined, AttemptStatusDb>;
  started_at: TimestampAuto;
  expires_at: Timestamp;
  submitted_at: Timestamp | null;
  graded_at: Timestamp | null;
  graded_by_id: string | null;
  score: number | null;
  max_score: ColumnType<number, number | undefined, number>;
  focus_loss_count: ColumnType<number, number | undefined, number>;
  question_order: ColumnType<string[], string[] | undefined, string[]>;
  option_order: JSONColumnType<
    Record<string, string[]> | null,
    string | null | undefined,
    string | null
  >;
  sync_version: ColumnType<number, number | undefined, number>;
  ip_address: string | null;
}

export interface QuizAnswersTable {
  id: Generated<string>;
  attempt_id: string;
  question_id: string;
  value: JSONColumnType<Record<string, unknown>, string, string>;
  awarded_points: number | null;
  is_correct: boolean | null;
  needs_manual_grade: ColumnType<boolean, boolean | undefined, boolean>;
  feedback: string | null;
  client_updated_at: Timestamp;
  updated_at: TimestampAuto;
}

export interface StudyMaterialsTable {
  id: Generated<string>;
  course_id: string;
  media_id: string | null;
  title: string;
  description: string | null;
  kind: ColumnType<MediaKindDb, MediaKindDb | undefined, MediaKindDb>;
  is_downloadable: ColumnType<boolean, boolean | undefined, boolean>;
  position: ColumnType<number, number | undefined, number>;
  created_at: TimestampAuto;
}

export interface LiveSessionsTable {
  id: Generated<string>;
  course_id: string;
  instructor_id: string | null;
  provider: ColumnType<LiveClassProviderDb, LiveClassProviderDb | undefined, LiveClassProviderDb>;
  title: string;
  external_room_id: string | null;
  moderator_pw: string | null;
  attendee_pw: string | null;
  starts_at: Timestamp;
  ends_at: Timestamp;
  recording_url: string | null;
  created_at: TimestampAuto;
}

export interface ReviewsTable {
  id: Generated<string>;
  institute_id: string;
  author_id: string;
  rating: number;
  title: string | null;
  body: string;
  video_media_id: string | null;
  institute_reply: string | null;
  replied_at: Timestamp | null;
  is_published: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: TimestampAuto;
  updated_at: TimestampAuto;
}

export interface PayoutRequestsTable {
  id: Generated<string>;
  institute_id: string;
  amount: Numeric;
  status: ColumnType<PayoutStatusDb, PayoutStatusDb | undefined, PayoutStatusDb>;
  iban: string | null;
  note: string | null;
  processed_at: Timestamp | null;
  created_at: TimestampAuto;
}

export interface WalletTransactionsTable {
  id: Generated<string>;
  institute_id: string;
  amount: Numeric;
  type: TransactionTypeDb;
  payout_status: ColumnType<PayoutStatusDb, PayoutStatusDb | undefined, PayoutStatusDb>;
  description: string | null;
  reference_id: string | null;
  payout_request_id: string | null;
  created_at: TimestampAuto;
}

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string;
  title: string;
  body: string;
  kind: ColumnType<string, string | undefined, string>;
  link_url: string | null;
  read_at: Timestamp | null;
  created_at: TimestampAuto;
}

/** The full database interface consumed by Kysely. */
export interface Database {
  users: UsersTable;
  refresh_tokens: RefreshTokensTable;
  otp_codes: OtpCodesTable;
  categories: CategoriesTable;
  institutes: InstitutesTable;
  institute_categories: InstituteCategoriesTable;
  institute_members: InstituteMembersTable;
  media: MediaTable;
  verification_documents: VerificationDocumentsTable;
  instructors: InstructorsTable;
  courses: CoursesTable;
  course_instructors: CourseInstructorsTable;
  classrooms: ClassroomsTable;
  timetable_entries: TimetableEntriesTable;
  forms: FormsTable;
  submissions: SubmissionsTable;
  submission_events: SubmissionEventsTable;
  time_slots: TimeSlotsTable;
  slot_bookings: SlotBookingsTable;
  enrollments: EnrollmentsTable;
  quizzes: QuizzesTable;
  quiz_questions: QuizQuestionsTable;
  quiz_attempts: QuizAttemptsTable;
  quiz_answers: QuizAnswersTable;
  study_materials: StudyMaterialsTable;
  live_sessions: LiveSessionsTable;
  reviews: ReviewsTable;
  payout_requests: PayoutRequestsTable;
  wallet_transactions: WalletTransactionsTable;
  notifications: NotificationsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
export type Institute = Selectable<InstitutesTable>;
export type NewInstitute = Insertable<InstitutesTable>;
export type Course = Selectable<CoursesTable>;
export type NewCourse = Insertable<CoursesTable>;
export type Submission = Selectable<SubmissionsTable>;
export type Quiz = Selectable<QuizzesTable>;
export type QuizQuestion = Selectable<QuizQuestionsTable>;
export type QuizAttempt = Selectable<QuizAttemptsTable>;
export type QuizAnswer = Selectable<QuizAnswersTable>;
export type MediaRow = Selectable<MediaTable>;
export type ReviewRow = Selectable<ReviewsTable>;
export type WalletTransactionRow = Selectable<WalletTransactionsTable>;
