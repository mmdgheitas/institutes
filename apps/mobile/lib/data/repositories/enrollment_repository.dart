import '../../core/network/api_client.dart';
import '../models/dynamic_form.dart';
import '../models/institute.dart';
import '../models/json_utils.dart';
import '../models/session.dart';

/// Courses, materials, live classes and pre-registration for the student app.
class EnrollmentRepository {
  EnrollmentRepository({required ApiClient api}) : _api = api;

  final ApiClient _api;

  /* ------------------------------------------------ pre-registration --- */

  Future<FormSchema> getForm(String formId) async {
    final dynamic data = await _api.get<dynamic>('/forms/$formId');
    return FormSchema.fromJson(asMap(data));
  }

  Future<List<TimeSlot>> availableSlots(
    String instituteId, {
    String? courseId,
  }) async {
    final dynamic data = await _api.get<dynamic>(
      '/institutes/$instituteId/slots',
      query: <String, dynamic>{if (courseId != null) 'courseId': courseId},
    );
    return asModelList(data, TimeSlot.fromJson);
  }

  /// Submits a pre-registration. [data] must already be sanitized by
  /// `FormValidator.sanitizeAll`.
  Future<String> submitForm({
    required String formId,
    required Map<String, dynamic> data,
    String? courseId,
    String? slotId,
    bool? contractAccepted,
    String? otpCode,
  }) async {
    final dynamic response = await _api.post<dynamic>(
      '/forms/$formId/submit',
      body: <String, dynamic>{
        'data': data,
        if (courseId != null) 'courseId': courseId,
        if (slotId != null) 'slotId': slotId,
        if (contractAccepted != null) 'contractAccepted': contractAccepted,
        if (otpCode != null && otpCode.isNotEmpty) 'otpCode': otpCode,
      },
    );
    return asString(asMap(response)['id']);
  }

  Future<List<MySubmission>> mySubmissions() async {
    final dynamic data = await _api.get<dynamic>('/me/submissions');
    return asModelList(data, MySubmission.fromJson);
  }

  /* ------------------------------------------------------- my courses --- */

  Future<List<EnrollmentRecord>> myEnrollments() async {
    final dynamic data = await _api.get<dynamic>('/me/enrollments');
    return asModelList(data, EnrollmentRecord.fromJson);
  }

  Future<CourseSummary> course(String courseId) async {
    final dynamic data = await _api.get<dynamic>('/courses/$courseId');
    return CourseSummary.fromJson(asMap(data));
  }

  Future<List<StudyMaterial>> materials(String courseId) async {
    final dynamic data = await _api.get<dynamic>('/courses/$courseId/materials');
    return asModelList(data, StudyMaterial.fromJson);
  }

  /// Short-lived presigned download URL for a material.
  Future<String> materialDownloadUrl(String materialId) async {
    final dynamic data =
        await _api.get<dynamic>('/materials/$materialId/download');
    return asString(asMap(data)['url']);
  }

  /* ------------------------------------------------------ live classes --- */

  Future<List<LiveSessionInfo>> upcomingLiveSessions() async {
    final dynamic data = await _api.get<dynamic>('/me/live-sessions');
    return asModelList(data, LiveSessionInfo.fromJson);
  }

  Future<List<LiveSessionInfo>> courseLiveSessions(String courseId) async {
    final dynamic data =
        await _api.get<dynamic>('/courses/$courseId/live-sessions');
    return asModelList(data, LiveSessionInfo.fromJson);
  }

  /// Returns the one-click SSO join URL for a live class.
  Future<String> joinLiveSession(String sessionId) async {
    final dynamic data =
        await _api.post<dynamic>('/live-sessions/$sessionId/join');
    return asString(asMap(data)['joinUrl']);
  }

  /* ---------------------------------------------------------- reviews --- */

  Future<void> submitReview({
    required String instituteId,
    required int rating,
    required String body,
    String? title,
    String? videoMediaId,
  }) async {
    await _api.post<dynamic>(
      '/institutes/$instituteId/reviews',
      body: <String, dynamic>{
        'rating': rating,
        'body': body,
        if (title != null && title.isNotEmpty) 'title': title,
        if (videoMediaId != null) 'videoMediaId': videoMediaId,
      },
    );
  }
}
