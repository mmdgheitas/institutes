import type { AttemptStatus, BookingStatus, CourseLevel, CourseType, EnrollmentStatus, FormFieldType, LeadStatus, LiveClassProvider, MediaKind, MediaStatus, PayoutStatus, QuestionType, TransactionType, UserRole, VerificationStatus } from './enums';
export interface Paginated<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
export interface ApiErrorBody {
    statusCode: number;
    message: string | string[];
    error?: string;
    path?: string;
    timestamp?: string;
    requestId?: string;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface SessionUser {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    role: UserRole;
    avatarUrl: string | null;
    instituteId: string | null;
}
export interface AuthResponse extends AuthTokens {
    user: SessionUser;
}
export interface CategorySummary {
    id: string;
    slug: string;
    name: string;
    icon: string;
    color: string;
    instituteCount?: number;
}
export interface MapPin {
    id: string;
    slug: string;
    name: string;
    lat: number;
    lng: number;
    categorySlug: string;
    categoryColor: string;
    categoryIcon: string;
    rating: number;
    reviewCount: number;
    verificationStatus: VerificationStatus;
    hasOnlineCourses: boolean;
    hasActiveDiscount: boolean;
    freePreRegistration: boolean;
    minPrice: number | null;
    distanceMeters: number | null;
    coverImageUrl: string | null;
}
export interface InstituteCard extends MapPin {
    shortDescription: string | null;
    city: string;
    address: string;
    courseCount: number;
}
export interface DiscoveryQuery {
    lat?: number;
    lng?: number;
    radiusMeters?: number;
    bbox?: [number, number, number, number];
    categories?: string[];
    skills?: string[];
    minRating?: number;
    hasOnline?: boolean;
    hasDiscount?: boolean;
    freePreRegistration?: boolean;
    verifiedOnly?: boolean;
    maxPrice?: number;
    query?: string;
    sort?: 'distance' | 'rating' | 'price' | 'popularity';
    page?: number;
    pageSize?: number;
}
export interface ClusterFeature {
    type: 'cluster' | 'pin';
    lat: number;
    lng: number;
    count: number;
    pin?: MapPin;
    clusterId?: number;
}
export interface MediaAsset {
    id: string;
    kind: MediaKind;
    status: MediaStatus;
    url: string | null;
    thumbnailUrl: string | null;
    hlsUrl: string | null;
    durationSeconds: number | null;
    title: string | null;
    position: number;
}
export interface InstructorProfile {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    headline: string | null;
    bio: string | null;
    yearsOfExperience: number | null;
    specialties: string[];
    rating: number;
    reviewCount: number;
}
export interface CourseSession {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
}
export interface CourseSummary {
    id: string;
    slug: string;
    title: string;
    type: CourseType;
    level: CourseLevel;
    price: number;
    discountPercent: number;
    effectivePrice: number;
    currency: string;
    durationHours: number;
    capacity: number;
    enrolledCount: number;
    seatsLeft: number;
    startDate: string | null;
    sessions: CourseSession[];
    instructorIds: string[];
}
export interface ReviewItem {
    id: string;
    rating: number;
    title: string | null;
    body: string;
    authorName: string;
    authorAvatarUrl: string | null;
    createdAt: string;
    instituteReply: string | null;
    videoUrl: string | null;
}
export interface InstituteStorefront {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    shortDescription: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    phone: string | null;
    website: string | null;
    address: string;
    city: string;
    province: string | null;
    lat: number;
    lng: number;
    rating: number;
    reviewCount: number;
    verificationStatus: VerificationStatus;
    categories: CategorySummary[];
    skills: string[];
    amenities: string[];
    gallery: MediaAsset[];
    instructors: InstructorProfile[];
    courses: CourseSummary[];
    reviews: ReviewItem[];
    hasOnlineCourses: boolean;
    freePreRegistration: boolean;
    preRegistrationFormId: string | null;
    workingHours: Record<string, string> | null;
}
export interface FormFieldOption {
    label: string;
    value: string;
}
export interface FormFieldSchema {
    key: string;
    label: string;
    type: FormFieldType;
    required: boolean;
    placeholder?: string;
    helpText?: string;
    options?: FormFieldOption[];
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    acceptedMimeTypes?: string[];
    maxFileSizeMb?: number;
    position: number;
}
export interface FormSchema {
    id: string;
    instituteId: string;
    title: string;
    description: string | null;
    isActive: boolean;
    requiresContract: boolean;
    contractText: string | null;
    fields: FormFieldSchema[];
}
export type SubmissionValue = string | number | boolean | string[] | {
    mediaId: string;
    fileName: string;
} | null;
export interface SubmissionPayload {
    formId: string;
    courseId?: string;
    slotId?: string;
    data: Record<string, SubmissionValue>;
    contractAccepted?: boolean;
    otpCode?: string;
}
export interface SubmissionRecord {
    id: string;
    formId: string;
    instituteId: string;
    courseId: string | null;
    studentId: string;
    studentName: string;
    studentPhone: string;
    status: LeadStatus;
    data: Record<string, SubmissionValue>;
    note: string | null;
    contractAcceptedAt: string | null;
    contractIp: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface TimeSlot {
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
export interface QuizOption {
    id: string;
    text: string;
}
export interface QuizQuestionPublic {
    id: string;
    type: QuestionType;
    prompt: string;
    points: number;
    options: QuizOption[];
    allowedMimeTypes?: string[];
    position: number;
}
export interface QuizQuestionAuthoring extends QuizQuestionPublic {
    correctOptionIds: string[];
    correctText?: string | null;
    explanation?: string | null;
}
export interface QuizSummary {
    id: string;
    courseId: string;
    title: string;
    description: string | null;
    timeLimitSeconds: number;
    maxScore: number;
    passingScore: number;
    questionCount: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    antiCheatEnabled: boolean;
    maxFocusLosses: number;
    attemptsAllowed: number;
    opensAt: string | null;
    closesAt: string | null;
    isPublished: boolean;
}
export interface QuizAttemptState {
    attemptId: string;
    quizId: string;
    status: AttemptStatus;
    startedAt: string;
    expiresAt: string;
    secondsRemaining: number;
    questions: QuizQuestionPublic[];
    answers: Record<string, QuizAnswerValue>;
    focusLossCount: number;
    score: number | null;
    maxScore: number;
    syncVersion: number;
}
export type QuizAnswerValue = {
    type: 'CHOICE';
    optionIds: string[];
} | {
    type: 'TEXT';
    text: string;
} | {
    type: 'FILE';
    mediaId: string;
    fileName: string;
};
export interface QuizAnswerInput {
    questionId: string;
    value: QuizAnswerValue;
    clientUpdatedAt: string;
}
export interface QuizSyncRequest {
    attemptId: string;
    answers: QuizAnswerInput[];
    focusLossCount?: number;
    syncVersion: number;
}
export interface QuizSyncResponse {
    attemptId: string;
    syncVersion: number;
    secondsRemaining: number;
    status: AttemptStatus;
    accepted: string[];
    rejected: {
        questionId: string;
        reason: string;
    }[];
}
export interface QuizResult {
    attemptId: string;
    status: AttemptStatus;
    score: number;
    maxScore: number;
    passed: boolean;
    autoGradedPoints: number;
    pendingManualPoints: number;
    submittedAt: string | null;
    gradedAt: string | null;
    breakdown: {
        questionId: string;
        prompt: string;
        points: number;
        awarded: number | null;
        isCorrect: boolean | null;
        needsManualGrading: boolean;
        feedback: string | null;
    }[];
}
export interface LiveSessionInfo {
    id: string;
    courseId: string;
    provider: LiveClassProvider;
    title: string;
    startsAt: string;
    endsAt: string;
    isLive: boolean;
    joinUrl: string | null;
    recordingUrl: string | null;
}
export interface StudyMaterial {
    id: string;
    courseId: string;
    title: string;
    kind: MediaKind;
    sizeBytes: number | null;
    downloadUrl: string | null;
    isDownloadable: boolean;
    createdAt: string;
}
export interface EnrollmentRecord {
    id: string;
    courseId: string;
    courseTitle: string;
    instituteId: string;
    instituteName: string;
    status: EnrollmentStatus;
    progressPercent: number;
    enrolledAt: string;
}
export interface LeadBoardColumn {
    status: LeadStatus;
    total: number;
    items: SubmissionRecord[];
}
export interface RevenuePoint {
    period: string;
    gross: number;
    commission: number;
    net: number;
    enrollments: number;
}
export interface WalletSummary {
    instituteId: string;
    currency: string;
    grossRevenue: number;
    commissionPaid: number;
    netEarnings: number;
    availableBalance: number;
    pendingPayout: number;
    paidOut: number;
}
export interface WalletTransaction {
    id: string;
    instituteId: string;
    amount: number;
    type: TransactionType;
    payoutStatus: PayoutStatus;
    description: string | null;
    referenceId: string | null;
    createdAt: string;
}
export interface DashboardStats {
    totalLeads: number;
    newLeadsThisWeek: number;
    conversionRate: number;
    activeCourses: number;
    activeStudents: number;
    averageRating: number;
    revenueThisMonth: number;
    upcomingSessions: number;
}
export interface PresignRequest {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    kind: MediaKind;
    purpose: 'INSTITUTE_GALLERY' | 'INSTITUTE_LOGO' | 'COURSE_MATERIAL' | 'SUBMISSION_ATTACHMENT' | 'QUIZ_ANSWER' | 'VERIFICATION_DOCUMENT' | 'REVIEW_VIDEO' | 'AVATAR';
    instituteId?: string;
    courseId?: string;
}
export interface PresignResponse {
    mediaId: string;
    uploadUrl: string;
    objectKey: string;
    method: 'PUT';
    headers: Record<string, string>;
    expiresInSeconds: number;
    maxSizeBytes: number;
}
