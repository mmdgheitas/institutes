/**
 * Typed endpoint map. Every API call in the app goes through here — pages
 * never build raw URLs. Query params are encoded, path params are typed, and
 * every response is cast to a shared or local type.
 */
import {apiDelete, apiGet, apiPatch, apiPost} from './client';
import type {
  AuthResponse,
  AuthTokens,
  CategorySummary,
  CourseSummary,
  DashboardStats,
  EnrollmentRecord,
  InstituteCard,
  InstituteStorefront,
  LeadBoardColumn,
  LiveSessionInfo,
  MapPin,
  Paginated,
  QuizAttemptState,
  QuizResult,
  QuizSummary,
  RevenuePoint,
  SessionUser,
  StudyMaterial,
  SubmissionRecord,
  WalletSummary,
} from '@shared/dto';
import type {
  AdminPayoutRow,
  AttemptRow,
  ClassroomRow,
  CourseEnrollmentRow,
  CourseRow,
  FormRow,
  InstituteRow,
  InstructorRow,
  LeadDetail,
  MediaRow,
  NotificationItem,
  PayoutRow,
  PendingVerification,
  QuizAuthoring,
  SlotRow,
  TimetableEntry,
  VerificationDoc,
  WalletTransactionRow,
} from '@/types/api';

function qs(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.set(key, String(value));
    }
  }
  const raw = search.toString();
  return raw ? `?${raw}` : '';
}

/* --------------------------------------------------------------- auth --- */

export const auth = {
  login: (body: { phone: string; password: string }) =>
    apiPost<AuthResponse>('/auth/login', body),
  requestOtp: (body: { phone: string; purpose?: 'LOGIN' | 'REGISTER' | 'SUBMISSION' }) =>
    apiPost<{ sent: boolean; expiresInSeconds: number; devCode?: string }>('/auth/otp/request', body),
  verifyOtp: (body: { phone: string; code: string; fullName?: string }) =>
    apiPost<AuthResponse>('/auth/otp/verify', body),
  register: (body: { phone: string; fullName: string; password: string; email?: string; role?: string }) =>
    apiPost<AuthResponse>('/auth/register', body),
  refresh: (refreshToken: string) => apiPost<AuthResponse>('/auth/refresh', { refreshToken }),
  logout: (refreshToken: string) => apiPost('/auth/logout', { refreshToken }),
  logoutAll: () => apiPost('/auth/logout-all'),
  me: (options?: { signal?: AbortSignal }) => apiGet<SessionUser>('/auth/me', options),
  updateMe: (body: { fullName?: string; email?: string; avatarUrl?: string }) =>
    apiPatch<SessionUser>('/auth/me', body),
};

/* ---------------------------------------------------------- discovery --- */

export const discovery = {
  categories: () => apiGet<CategorySummary[]>('/categories'),
  skills: () => apiGet<{ skill: string; count: number }[]>('/skills'),
  institutes: (params?: Record<string, unknown>) =>
    apiGet<Paginated<InstituteCard>>(`/institutes${qs(params)}`),
  mapPins: (params?: Record<string, unknown>) =>
    apiGet<{ pins: MapPin[]; total: number }>(`/map/pins${qs(params)}`),
  storefront: (slug: string) => apiGet<InstituteStorefront>(`/institutes/${slug}`),
};

/* ---------------------------------------------------------- institutes --- */

export const institutes = {
  mine: () => apiGet<InstituteRow[]>('/institutes/mine'),
  manage: (id: string) => apiGet<InstituteRow>(`/institutes/${id}/manage`),
  update: (id: string, body: Record<string, unknown>) =>
    apiPatch<InstituteRow>(`/institutes/${id}`, body),
  create: (body: Record<string, unknown>) => apiPost<InstituteRow>(`/institutes`, body),
  verificationDocs: (id: string) => apiGet<VerificationDoc[]>(`/institutes/${id}/verification`),
  submitVerification: (id: string, body: { mediaId: string; docType: string }) =>
    apiPost(`/institutes/${id}/verification`, body),
  pendingVerifications: () => apiGet<PendingVerification[]>('/institutes/admin/verification/pending'),
  reviewVerification: (documentId: string, body: { status: 'VERIFIED' | 'REJECTED'; note?: string }) =>
    apiPost<{ status: string }>(`/institutes/admin/verification/${documentId}`, body),
  instructors: (id: string) => apiGet<InstructorRow[]>(`/institutes/${id}/instructors`),
  createInstructor: (id: string, body: Record<string, unknown>) =>
    apiPost<InstructorRow>(`/institutes/${id}/instructors`, body),
  updateInstructor: (instructorId: string, body: Record<string, unknown>) =>
    apiPatch<InstructorRow>(`/institutes/instructors/${instructorId}`, body),
  deleteInstructor: (instructorId: string) =>
    apiDelete<{ success: boolean }>(`/institutes/instructors/${instructorId}`),
  replyReview: (reviewId: string, body: { reply: string }) =>
    apiPost(`/institutes/reviews/${reviewId}/reply`, body),
};

/* ------------------------------------------------------------ courses --- */

export const courses = {
  list: (instituteId: string) => apiGet<CourseSummary[]>(`/institutes/${instituteId}/courses`),
  mine: () => apiGet<CourseSummary[]>('/me/courses'),
  get: (id: string) => apiGet<CourseRow>(`/courses/${id}`),
  create: (instituteId: string, body: Record<string, unknown>) =>
    apiPost(`/institutes/${instituteId}/courses`, body),
  update: (id: string, body: Record<string, unknown>) => apiPatch(`/courses/${id}`, body),
  remove: (id: string) => apiDelete<{ deleted: boolean; unpublished: boolean }>(`/courses/${id}`),
  classrooms: (instituteId: string) => apiGet<ClassroomRow[]>(`/institutes/${instituteId}/classrooms`),
  createClassroom: (instituteId: string, body: { name: string; capacity?: number }) =>
    apiPost<ClassroomRow>(`/institutes/${instituteId}/classrooms`, body),
  timetable: (instituteId: string) => apiGet<TimetableEntry[]>(`/institutes/${instituteId}/timetable`),
  addTimetableEntry: (body: {
    courseId: string;
    classroomId?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => apiPost('/timetable', body),
  removeTimetableEntry: (entryId: string) =>
    apiDelete<{ success: boolean }>(`/timetable/${entryId}`),
};

/* -------------------------------------------------------------- forms --- */

export const forms = {
  list: (instituteId: string) => apiGet<FormRow[]>(`/institutes/${instituteId}/forms`),
  get: (formId: string) => apiGet<FormRow>(`/forms/${formId}`),
  create: (instituteId: string, body: Record<string, unknown>) =>
    apiPost(`/institutes/${instituteId}/forms`, body),
  update: (formId: string, body: Record<string, unknown>) => apiPatch(`/forms/${formId}`, body),
  slots: (instituteId: string) => apiGet<SlotRow[]>(`/institutes/${instituteId}/slots`),
  createSlots: (
    instituteId: string,
    body: { courseId?: string; startTimes: string[]; durationMinutes: number; capacity?: number; location?: string },
  ) => apiPost<SlotRow[]>(`/institutes/${instituteId}/slots`, body),
  cancelSlot: (slotId: string) => apiPost<{ success: boolean }>(`/slots/${slotId}/cancel`),
};

/* ---------------------------------------------------------------- CRM --- */

export const crm = {
  board: (instituteId: string, params?: { courseId?: string; search?: string }) =>
    apiGet<LeadBoardColumn[]>(`/institutes/${instituteId}/leads/board${qs(params)}`),
  lead: (submissionId: string) => apiGet<LeadDetail>(`/leads/${submissionId}`),
  updateStatus: (submissionId: string, body: { to: string; note?: string; position?: number }) =>
    apiPatch<SubmissionRecord>(`/leads/${submissionId}/status`, body),
  assignCourse: (submissionId: string, courseId: string) =>
    apiPatch(`/leads/${submissionId}/course`, { courseId }),
  addNote: (submissionId: string, note: string) =>
    apiPost<{ success: boolean }>(`/leads/${submissionId}/notes`, { note }),
  stats: (instituteId: string) => apiGet<DashboardStats>(`/institutes/${instituteId}/stats`),
};

/* --------------------------------------------------------- enrollments --- */

export const enrollments = {
  forCourse: (courseId: string) =>
    apiGet<CourseEnrollmentRow[]>(`/courses/${courseId}/enrollments`),
  updateStatus: (enrollmentId: string, status: string) =>
    apiPatch<CourseEnrollmentRow>(`/enrollments/${enrollmentId}/status`, { status }),
  updateProgress: (enrollmentId: string, progressPercent: number) =>
    apiPatch(`/enrollments/${enrollmentId}/progress`, { progressPercent }),
  mine: () => apiGet<EnrollmentRecord[]>('/me/enrollments'),
};

/* ------------------------------------------------------------- quizzes --- */

export const quizzes = {
  list: (courseId: string) => apiGet<QuizSummary[]>(`/courses/${courseId}/quizzes`),
  authoring: (quizId: string) => apiGet<QuizAuthoring>(`/quizzes/${quizId}/authoring`),
  create: (courseId: string, body: Record<string, unknown>) =>
    apiPost<QuizSummary>(`/courses/${courseId}/quizzes`, body),
  update: (quizId: string, body: Record<string, unknown>) => apiPatch(`/quizzes/${quizId}`, body),
  remove: (quizId: string) => apiDelete<{ success: boolean }>(`/quizzes/${quizId}`),
  attempts: (quizId: string) => apiGet<AttemptRow[]>(`/quizzes/${quizId}/attempts`),
  attempt: (attemptId: string) => apiGet<QuizAttemptState>(`/attempts/${attemptId}`),
  result: (attemptId: string) => apiGet<QuizResult>(`/attempts/${attemptId}/result`),
  grade: (attemptId: string, body: { answers: { questionId: string; awardedPoints: number; feedback?: string }[] }) =>
    apiPost<QuizResult>(`/attempts/${attemptId}/grade`, body),
};

/* -------------------------------------------------------- live classes --- */

export const liveClasses = {
  list: (courseId: string) => apiGet<LiveSessionInfo[]>(`/courses/${courseId}/live-sessions`),
  create: (courseId: string, body: Record<string, unknown>) =>
    apiPost(`/courses/${courseId}/live-sessions`, body),
  join: (sessionId: string) => apiPost<{ joinUrl: string }>(`/live-sessions/${sessionId}/join`),
  addRecording: (sessionId: string, body: { recordingUrl: string }) =>
    apiPost(`/live-sessions/${sessionId}/recording`, body),
  remove: (sessionId: string) => apiDelete<{ success: boolean }>(`/live-sessions/${sessionId}`),
  mine: () => apiGet<LiveSessionInfo[]>('/me/live-sessions'),
};

/* ------------------------------------------------------------- storage --- */

export const storage = {
  presign: (body: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    kind: string;
    purpose: string;
    instituteId?: string;
    courseId?: string;
  }) =>
    apiPost<{
      mediaId: string;
      uploadUrl: string;
      objectKey: string;
      method: 'PUT';
      headers: Record<string, string>;
      expiresInSeconds: number;
      maxSizeBytes: number;
    }>('/uploads/presign', body),
  confirm: (mediaId: string) =>
    apiPost<{ id: string; status: string; url: string | null; needsProcessing: boolean }>(
      `/uploads/${mediaId}/confirm`,
    ),
  remove: (mediaId: string) => apiDelete<{ success: boolean }>(`/media/${mediaId}`),
  instituteMedia: (instituteId: string) =>
    apiGet<MediaRow[]>(`/institutes/${instituteId}/media`),
  reorder: (instituteId: string, orderedIds: string[]) =>
    apiPost<{ success: boolean }>(`/institutes/${instituteId}/media/reorder`, { orderedIds }),
  materials: (courseId: string) => apiGet<StudyMaterial[]>(`/courses/${courseId}/materials`),
  addMaterial: (courseId: string, body: { title: string; mediaId: string; isDownloadable?: boolean }) =>
    apiPost(`/courses/${courseId}/materials`, body),
  materialDownloadUrl: (materialId: string) =>
    apiGet<{ url: string; expiresInSeconds: number; fileName: string }>(`/materials/${materialId}/download`),
  removeMaterial: (materialId: string) =>
    apiDelete<{ success: boolean }>(`/materials/${materialId}`),
};

/* ------------------------------------------------------------- finance --- */

export const finance = {
  wallet: (instituteId: string) => apiGet<WalletSummary>(`/institutes/${instituteId}/wallet`),
  transactions: (instituteId: string, params?: { page?: number; pageSize?: number }) =>
    apiGet<Paginated<WalletTransactionRow>>(`/institutes/${instituteId}/transactions${qs(params)}`),
  revenue: (instituteId: string, months = 12) =>
    apiGet<RevenuePoint[]>(`/institutes/${instituteId}/revenue?months=${months}`),
  requestPayout: (instituteId: string, body: { amount: number; iban?: string }) =>
    apiPost<{ id: string; status: string }>(`/institutes/${instituteId}/payouts`, body),
  payouts: (instituteId: string) => apiGet<PayoutRow[]>(`/institutes/${instituteId}/payouts`),
  adminPayouts: (status?: string) =>
    apiGet<AdminPayoutRow[]>(`/admin/payouts${qs(status ? { status } : undefined)}`),
  processPayout: (payoutId: string, body: { status: 'APPROVED' | 'PAID' | 'REJECTED'; note?: string }) =>
    apiPost<{ id: string; status: string }>(`/admin/payouts/${payoutId}`, body),
  platformStats: () =>
    apiGet<{
      totalCommission: number;
      totalGrossVolume: number;
      publishedInstitutes: number;
      totalEnrollments: number;
    }>('/admin/platform-stats'),
};

/* -------------------------------------------------------- notifications --- */

export const notifications = {
  list: (params?: { page?: number; pageSize?: number }) =>
    apiGet<Paginated<NotificationItem>>(`/notifications${qs(params)}`),
  unreadCount: () => apiGet<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => apiPost(`/notifications/${id}/read`),
  markAllRead: () => apiPost('/notifications/read-all'),
};

/* --------------------------------------------------------------- misc --- */

export const health = {
  check: () => apiGet<{ status: string; timestamp: string }>('/health'),
};

export type { AuthTokens };
export { qs };
