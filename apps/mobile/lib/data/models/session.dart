import 'package:equatable/equatable.dart';

import 'enums.dart';
import 'json_utils.dart';

/// The signed-in user.
class SessionUser extends Equatable {
  const SessionUser({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.role,
    this.email,
    this.avatarUrl,
    this.instituteId,
  });

  final String id;
  final String fullName;
  final String phone;
  final UserRole role;
  final String? email;
  final String? avatarUrl;
  final String? instituteId;

  /// Whether this account can open the institute dashboard.
  bool get canManageInstitute =>
      role == UserRole.instituteAdmin || role == UserRole.superAdmin;

  bool get isTeacher => role == UserRole.teacher;

  /// Up to two uppercase initials for the avatar placeholder.
  String get initials {
    final List<String> parts = fullName
        .trim()
        .split(RegExp(r'\s+'))
        .where((String p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    String firstLetter(String word) => word.substring(0, 1).toUpperCase();
    if (parts.length == 1) return firstLetter(parts.first);
    return '${firstLetter(parts.first)}${firstLetter(parts.last)}';
  }

  factory SessionUser.fromJson(Map<String, dynamic> json) => SessionUser(
        id: asString(json['id']),
        fullName: asString(json['fullName'], fallback: 'Student'),
        phone: asString(json['phone']),
        role: UserRole.parse(asStringOrNull(json['role'])),
        email: asStringOrNull(json['email']),
        avatarUrl: asStringOrNull(json['avatarUrl']),
        instituteId: asStringOrNull(json['instituteId']),
      );

  @override
  List<Object?> get props => <Object?>[id, role, instituteId];
}

/// Token pair plus the user, returned by every auth endpoint.
class AuthResult {
  const AuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final SessionUser user;

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
        accessToken: asString(json['accessToken']),
        refreshToken: asString(json['refreshToken']),
        expiresIn: asInt(json['expiresIn'], fallback: 900),
        user: SessionUser.fromJson(asMap(json['user'])),
      );
}

/// Response to an OTP request. [devCode] is only populated outside production.
class OtpRequestResult {
  const OtpRequestResult({
    required this.sent,
    required this.expiresInSeconds,
    this.devCode,
  });

  final bool sent;
  final int expiresInSeconds;
  final String? devCode;

  factory OtpRequestResult.fromJson(Map<String, dynamic> json) =>
      OtpRequestResult(
        sent: asBool(json['sent'], fallback: true),
        expiresInSeconds: asInt(json['expiresInSeconds'], fallback: 120),
        devCode: asStringOrNull(json['devCode']),
      );
}

class EnrollmentRecord extends Equatable {
  const EnrollmentRecord({
    required this.id,
    required this.courseId,
    required this.courseTitle,
    required this.instituteId,
    required this.instituteName,
    required this.status,
    required this.progressPercent,
    required this.enrolledAt,
  });

  final String id;
  final String courseId;
  final String courseTitle;
  final String instituteId;
  final String instituteName;
  final EnrollmentStatus status;
  final double progressPercent;
  final DateTime enrolledAt;

  factory EnrollmentRecord.fromJson(Map<String, dynamic> json) =>
      EnrollmentRecord(
        id: asString(json['id']),
        courseId: asString(json['courseId']),
        courseTitle: asString(json['courseTitle']),
        instituteId: asString(json['instituteId']),
        instituteName: asString(json['instituteName']),
        status: EnrollmentStatus.parse(asStringOrNull(json['status'])),
        progressPercent: asDouble(json['progressPercent']),
        enrolledAt: asDate(json['enrolledAt']),
      );

  @override
  List<Object?> get props => <Object?>[id, status, progressPercent];
}

class LiveSessionInfo extends Equatable {
  const LiveSessionInfo({
    required this.id,
    required this.courseId,
    required this.provider,
    required this.title,
    required this.startsAt,
    required this.endsAt,
    required this.isLive,
    this.recordingUrl,
  });

  final String id;
  final String courseId;
  final LiveClassProvider provider;
  final String title;
  final DateTime startsAt;
  final DateTime endsAt;
  final bool isLive;
  final String? recordingUrl;

  bool get hasRecording => (recordingUrl ?? '').isNotEmpty;
  bool get isPast => DateTime.now().isAfter(endsAt);

  factory LiveSessionInfo.fromJson(Map<String, dynamic> json) => LiveSessionInfo(
        id: asString(json['id']),
        courseId: asString(json['courseId']),
        provider: LiveClassProvider.parse(asStringOrNull(json['provider'])),
        title: asString(json['title']),
        startsAt: asDate(json['startsAt']),
        endsAt: asDate(json['endsAt']),
        isLive: asBool(json['isLive']),
        recordingUrl: asStringOrNull(json['recordingUrl']),
      );

  @override
  List<Object?> get props => <Object?>[id, isLive];
}

class StudyMaterial extends Equatable {
  const StudyMaterial({
    required this.id,
    required this.courseId,
    required this.title,
    required this.kind,
    required this.isDownloadable,
    required this.createdAt,
    this.sizeBytes,
  });

  final String id;
  final String courseId;
  final String title;
  final MediaKind kind;
  final bool isDownloadable;
  final DateTime createdAt;
  final int? sizeBytes;

  String get readableSize {
    final int? bytes = sizeBytes;
    if (bytes == null || bytes <= 0) return '';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  factory StudyMaterial.fromJson(Map<String, dynamic> json) => StudyMaterial(
        id: asString(json['id']),
        courseId: asString(json['courseId']),
        title: asString(json['title']),
        kind: MediaKind.parse(asStringOrNull(json['kind'])),
        isDownloadable: asBool(json['isDownloadable'], fallback: true),
        createdAt: asDate(json['createdAt']),
        sizeBytes: asIntOrNull(json['sizeBytes']),
      );

  @override
  List<Object?> get props => <Object?>[id];
}
