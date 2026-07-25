import '../../core/network/api_client.dart';
import '../models/json_utils.dart';
import '../models/quiz.dart';

class QuizRepository {
  QuizRepository({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<List<QuizSummary>> listForCourse(String courseId) async {
    final dynamic data = await _api.get<dynamic>('/courses/$courseId/quizzes');
    return asModelList(data, QuizSummary.fromJson);
  }

  /// Starts a new attempt, or resumes the open one the server already has.
  Future<QuizAttemptState> startAttempt(String quizId) async {
    final dynamic data = await _api.post<dynamic>('/quizzes/$quizId/attempts');
    return QuizAttemptState.fromJson(asMap(data));
  }

  Future<QuizAttemptState> getAttempt(String attemptId) async {
    final dynamic data = await _api.get<dynamic>('/attempts/$attemptId');
    return QuizAttemptState.fromJson(asMap(data));
  }

  /// Flushes buffered answers. The server rejects any entry older than what
  /// it already holds, so replaying a stale queue is harmless.
  Future<QuizSyncResult> sync({
    required String attemptId,
    required List<PendingAnswer> answers,
    required int syncVersion,
    int? focusLossCount,
  }) async {
    final dynamic data = await _api.post<dynamic>(
      '/attempts/$attemptId/sync',
      body: <String, dynamic>{
        'answers': answers.map((PendingAnswer a) => a.toJson()).toList(),
        'syncVersion': syncVersion,
        if (focusLossCount != null) 'focusLossCount': focusLossCount,
      },
    );
    return QuizSyncResult.fromJson(asMap(data));
  }

  Future<QuizResult> submit(String attemptId) async {
    final dynamic data = await _api.post<dynamic>('/attempts/$attemptId/submit');
    return QuizResult.fromJson(asMap(data));
  }

  Future<QuizResult> result(String attemptId) async {
    final dynamic data = await _api.get<dynamic>('/attempts/$attemptId/result');
    return QuizResult.fromJson(asMap(data));
  }
}
