/// Domain enums mirroring `packages/shared/src/enums.ts`.
///
/// Each parses from the wire string defensively: an unrecognised value falls
/// back to a sensible default rather than throwing.
library;

enum UserRole {
  student('STUDENT'),
  teacher('TEACHER'),
  instituteAdmin('INSTITUTE_ADMIN'),
  superAdmin('SUPER_ADMIN');

  const UserRole(this.wire);
  final String wire;

  static UserRole parse(String? value) => UserRole.values.firstWhere(
        (UserRole r) => r.wire == value,
        orElse: () => UserRole.student,
      );

  bool get isStaff => this == instituteAdmin || this == superAdmin;
}

enum VerificationStatus {
  unverified('UNVERIFIED'),
  pending('PENDING'),
  verified('VERIFIED'),
  rejected('REJECTED');

  const VerificationStatus(this.wire);
  final String wire;

  static VerificationStatus parse(String? value) =>
      VerificationStatus.values.firstWhere(
        (VerificationStatus s) => s.wire == value,
        orElse: () => VerificationStatus.unverified,
      );

  bool get isVerified => this == verified;
}

enum CourseType {
  online('ONLINE', 'Online'),
  inPerson('IN_PERSON', 'In person'),
  hybrid('HYBRID', 'Hybrid');

  const CourseType(this.wire, this.label);
  final String wire;
  final String label;

  static CourseType parse(String? value) => CourseType.values.firstWhere(
        (CourseType t) => t.wire == value,
        orElse: () => CourseType.inPerson,
      );
}

enum CourseLevel {
  beginner('BEGINNER', 'Beginner'),
  intermediate('INTERMEDIATE', 'Intermediate'),
  advanced('ADVANCED', 'Advanced'),
  allLevels('ALL_LEVELS', 'All levels');

  const CourseLevel(this.wire, this.label);
  final String wire;
  final String label;

  static CourseLevel parse(String? value) => CourseLevel.values.firstWhere(
        (CourseLevel l) => l.wire == value,
        orElse: () => CourseLevel.allLevels,
      );
}

enum LeadStatus {
  newLead('NEW', 'New'),
  contacted('CONTACTED', 'Contacted'),
  interviewed('INTERVIEWED', 'Interviewed'),
  enrolled('ENROLLED', 'Enrolled'),
  cancelled('CANCELLED', 'Cancelled');

  const LeadStatus(this.wire, this.label);
  final String wire;
  final String label;

  static LeadStatus parse(String? value) => LeadStatus.values.firstWhere(
        (LeadStatus s) => s.wire == value,
        orElse: () => LeadStatus.newLead,
      );
}

enum FormFieldType {
  text('TEXT'),
  textarea('TEXTAREA'),
  number('NUMBER'),
  email('EMAIL'),
  phone('PHONE'),
  date('DATE'),
  select('SELECT'),
  multiSelect('MULTI_SELECT'),
  checkbox('CHECKBOX'),
  file('FILE'),
  nationalId('NATIONAL_ID');

  const FormFieldType(this.wire);
  final String wire;

  static FormFieldType parse(String? value) => FormFieldType.values.firstWhere(
        (FormFieldType t) => t.wire == value,
        orElse: () => FormFieldType.text,
      );
}

enum QuestionType {
  multipleChoice('MULTIPLE_CHOICE'),
  multiSelect('MULTI_SELECT'),
  trueFalse('TRUE_FALSE'),
  shortAnswer('SHORT_ANSWER'),
  essay('ESSAY'),
  fileUpload('FILE_UPLOAD');

  const QuestionType(this.wire);
  final String wire;

  static QuestionType parse(String? value) => QuestionType.values.firstWhere(
        (QuestionType t) => t.wire == value,
        orElse: () => QuestionType.multipleChoice,
      );

  /// True when the student picks from a fixed option list.
  bool get isChoice =>
      this == multipleChoice || this == multiSelect || this == trueFalse;

  bool get isText => this == shortAnswer || this == essay;
}

enum AttemptStatus {
  inProgress('IN_PROGRESS'),
  submitted('SUBMITTED'),
  autoSubmitted('AUTO_SUBMITTED'),
  graded('GRADED'),
  voided('VOIDED');

  const AttemptStatus(this.wire);
  final String wire;

  static AttemptStatus parse(String? value) => AttemptStatus.values.firstWhere(
        (AttemptStatus s) => s.wire == value,
        orElse: () => AttemptStatus.inProgress,
      );

  bool get isOpen => this == inProgress;
}

enum EnrollmentStatus {
  active('ACTIVE', 'Active'),
  completed('COMPLETED', 'Completed'),
  dropped('DROPPED', 'Dropped'),
  suspended('SUSPENDED', 'Suspended');

  const EnrollmentStatus(this.wire, this.label);
  final String wire;
  final String label;

  static EnrollmentStatus parse(String? value) =>
      EnrollmentStatus.values.firstWhere(
        (EnrollmentStatus s) => s.wire == value,
        orElse: () => EnrollmentStatus.active,
      );
}

enum MediaKind {
  image('IMAGE'),
  video('VIDEO'),
  audio('AUDIO'),
  document('DOCUMENT'),
  panorama360('PANORAMA_360');

  const MediaKind(this.wire);
  final String wire;

  static MediaKind parse(String? value) => MediaKind.values.firstWhere(
        (MediaKind k) => k.wire == value,
        orElse: () => MediaKind.document,
      );
}

enum LiveClassProvider {
  adobeConnect('ADOBE_CONNECT', 'Adobe Connect'),
  bigBlueButton('BIG_BLUE_BUTTON', 'BigBlueButton');

  const LiveClassProvider(this.wire, this.label);
  final String wire;
  final String label;

  static LiveClassProvider parse(String? value) =>
      LiveClassProvider.values.firstWhere(
        (LiveClassProvider p) => p.wire == value,
        orElse: () => LiveClassProvider.bigBlueButton,
      );
}

enum DiscoverySort {
  distance('distance', 'Nearest'),
  rating('rating', 'Top rated'),
  price('price', 'Lowest price'),
  popularity('popularity', 'Most popular');

  const DiscoverySort(this.wire, this.label);
  final String wire;
  final String label;
}
