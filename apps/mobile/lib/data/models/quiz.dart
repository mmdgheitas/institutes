import 'package:equatable/equatable.dart';

import 'enums.dart';
import 'json_utils.dart';

class QuizOption extends Equatable {
  const QuizOption({required this.id, required this.text});

  final String id;
  final String text;

  factory QuizOption.fromJson(Map<String, dynamic> json) => QuizOption(
        id: asString(json['id']),
        text: asString(json['text']),
      );

  Map<String, dynamic> toJson() => <String, dynamic>{'id': id, 'text': text};

  @override
  List<Object?> get props => <Object?>[id];
}

/// A question as delivered to the student — never carries the answer key.
class QuizQuestion extends Equatable {
  const QuizQuestion({
    required this.id,
    required this.type,
    required this.prompt,
    required this.points,
    required this.options,
    required this.position,
    this.allowedMimeTypes = const <String>[],
  });

  final String id;
  final QuestionType type;
  final String prompt;
  final double points;
  final List<QuizOption> options;
  final int position;
  final List<String> allowedMimeTypes;

  factory QuizQuestion.fromJson(Map<String, dynamic> json) => QuizQuestion(
        id: asString(json['id']),
        type: QuestionType.parse(asStringOrNull(json['type'])),
        prompt: asString(json['prompt']),
        points: asDouble(json['points'], fallback: 1),
        options: asModelList(json['options'], QuizOption.fromJson),
        position: asInt(json['position']),
        allowedMimeTypes: asStringList(json['allowedMimeTypes']),
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'type': type.wire,
        'prompt': prompt,
        'points': points,
        'options': options.map((QuizOption o) => o.toJson()).toList(),
        'position': position,
        'allowedMimeTypes': allowedMimeTypes,
      };

  @override
  List<Object?> get props => <Object?>[id];
}

/// Discriminated union of answer payloads, mirroring `QuizAnswerValue`.
sealed class QuizAnswerValue extends Equatable {
  const QuizAnswerValue();

  Map<String, dynamic> toJson();

  /// True when the student has actually provided something.
  bool get isAnswered;

  static QuizAnswerValue? fromJson(Map<String, dynamic> json) {
    switch (asString(json['type'])) {
      case 'CHOICE':
        return ChoiceAnswer(optionIds: asStringList(json['optionIds']));
      case 'TEXT':
        return TextAnswer(text: asString(json['text']));
      case 'FILE':
        return FileAnswer(
          mediaId: asString(json['mediaId']),
          fileName: asString(json['fileName']),
        );
      default:
        return null;
    }
  }
}

class ChoiceAnswer extends QuizAnswerValue {
  const ChoiceAnswer({required this.optionIds});

  final List<String> optionIds;

  @override
  bool get isAnswered => optionIds.isNotEmpty;

  @override
  Map<String, dynamic> toJson() =>
      <String, dynamic>{'type': 'CHOICE', 'optionIds': optionIds};

  @override
  List<Object?> get props => <Object?>[optionIds];
}

class TextAnswer extends QuizAnswerValue {
  const TextAnswer({required this.text});

  final String text;

  @override
  bool get isAnswered => text.trim().isNotEmpty;

  @override
  Map<String, dynamic> toJson() =>
      <String, dynamic>{'type': 'TEXT', 'text': text};

  @override
  List<Object?> get props => <Object?>[text];
}

class FileAnswer extends QuizAnswerValue {
  const FileAnswer({required this.mediaId, required this.fileName});

  final String mediaId;
  final String fileName;

  @override
  bool get isAnswered => mediaId.isNotEmpty;

  @override
  Map<String, dynamic> toJson() => <String, dynamic>{
        'type': 'FILE',
        'mediaId': mediaId,
        'fileName': fileName,
      };

  @override
  List<Object?> get props => <Object?>[mediaId];
}

class QuizSummary extends Equatable {
  const QuizSummary({
    required this.id,
    required this.courseId,
    required this.title,
    required this.timeLimitSeconds,
    required this.maxScore,
    required this.passingScore,
    required this.questionCount,
    required this.attemptsAllowed,
    required this.antiCheatEnabled,
    required this.maxFocusLosses,
    required this.isPublished,
    this.description,
    this.opensAt,
    this.closesAt,
  });

  final String id;
  final String courseId;
  final String title;
  final int timeLimitSeconds;
  final double maxScore;
  final double passingScore;
  final int questionCount;
  final int attemptsAllowed;
  final bool antiCheatEnabled;
  final int maxFocusLosses;
  final bool isPublished;
  final String? description;
  final DateTime? opensAt;
  final DateTime? closesAt;

  Duration get timeLimit => Duration(seconds: timeLimitSeconds);

  /// Whether the quiz is inside its open window right now.
  bool get isOpenNow {
    final DateTime now = DateTime.now();
    if (opensAt != null && now.isBefore(opensAt!)) return false;
    if (closesAt != null && now.isAfter(closesAt!)) return false;
    return isPublished;
  }

  factory QuizSummary.fromJson(Map<String, dynamic> json) => QuizSummary(
        id: asString(json['id']),
        courseId: asString(json['courseId']),
        title: asString(json['title']),
        timeLimitSeconds: asInt(json['timeLimitSeconds'], fallback: 1800),
        maxScore: asDouble(json['maxScore'], fallback: 100),
        passingScore: asDouble(json['passingScore'], fallback: 50),
        questionCount: asInt(json['questionCount']),
        attemptsAllowed: asInt(json['attemptsAllowed'], fallback: 1),
        antiCheatEnabled: asBool(json['antiCheatEnabled'], fallback: true),
        maxFocusLosses: asInt(json['maxFocusLosses'], fallback: 3),
        isPublished: asBool(json['isPublished']),
        description: asStringOrNull(json['description']),
        opensAt: asDateOrNull(json['opensAt']),
        closesAt: asDateOrNull(json['closesAt']),
      );

  @override
  List<Object?> get props => <Object?>[id, isPublished];
}

/// Live attempt state. Persisted to Hive so a crash or network loss is
/// recoverable without losing answers.
class QuizAttemptState extends Equatable {
  const QuizAttemptState({
    required this.attemptId,
    required this.quizId,
    required this.status,
    required this.startedAt,
    required this.expiresAt,
    required this.secondsRemaining,
    required this.questions,
    required this.answers,
    required this.focusLossCount,
    required this.maxScore,
    required this.syncVersion,
    this.score,
  });

  final String attemptId;
  final String quizId;
  final AttemptStatus status;
  final DateTime startedAt;

  /// Server-authoritative deadline. The countdown is derived from this, never
  /// from a client-side stopwatch.
  final DateTime expiresAt;
  final int secondsRemaining;
  final List<QuizQuestion> questions;
  final Map<String, QuizAnswerValue> answers;
  final int focusLossCount;
  final double maxScore;
  final int syncVersion;
  final double? score;

  int get answeredCount =>
      answers.values.where((QuizAnswerValue a) => a.isAnswered).length;

  double get progress =>
      questions.isEmpty ? 0 : answeredCount / questions.length;

  /// Remaining time recomputed against the wall clock.
  Duration get remaining {
    final Duration diff = expiresAt.difference(DateTime.now());
    return diff.isNegative ? Duration.zero : diff;
  }

  bool get isExpired => remaining == Duration.zero;

  QuizAttemptState copyWith({
    AttemptStatus? status,
    Map<String, QuizAnswerValue>? answers,
    int? focusLossCount,
    int? syncVersion,
    double? score,
  }) {
    return QuizAttemptState(
      attemptId: attemptId,
      quizId: quizId,
      status: status ?? this.status,
      startedAt: startedAt,
      expiresAt: expiresAt,
      secondsRemaining: secondsRemaining,
      questions: questions,
      answers: answers ?? this.answers,
      focusLossCount: focusLossCount ?? this.focusLossCount,
      maxScore: maxScore,
      syncVersion: syncVersion ?? this.syncVersion,
      score: score ?? this.score,
    );
  }

  factory QuizAttemptState.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> rawAnswers = asMap(json['answers']);
    final Map<String, QuizAnswerValue> parsedAnswers =
        <String, QuizAnswerValue>{};
    rawAnswers.forEach((String key, dynamic value) {
      if (value is Map) {
        final QuizAnswerValue? parsed =
            QuizAnswerValue.fromJson(Map<String, dynamic>.from(value));
        if (parsed != null) parsedAnswers[key] = parsed;
      }
    });

    return QuizAttemptState(
      attemptId: asString(json['attemptId']),
      quizId: asString(json['quizId']),
      status: AttemptStatus.parse(asStringOrNull(json['status'])),
      startedAt: asDate(json['startedAt']),
      expiresAt: asDate(json['expiresAt']),
      secondsRemaining: asInt(json['secondsRemaining']),
      questions: asModelList(json['questions'], QuizQuestion.fromJson),
      answers: parsedAnswers,
      focusLossCount: asInt(json['focusLossCount']),
      maxScore: asDouble(json['maxScore'], fallback: 100),
      syncVersion: asInt(json['syncVersion']),
      score: asDoubleOrNull(json['score']),
    );
  }

  /// Serialized for Hive. Stored as JSON so no generated adapter is needed.
  Map<String, dynamic> toJson() => <String, dynamic>{
        'attemptId': attemptId,
        'quizId': quizId,
        'status': status.wire,
        'startedAt': startedAt.toIso8601String(),
        'expiresAt': expiresAt.toIso8601String(),
        'secondsRemaining': secondsRemaining,
        'questions': questions.map((QuizQuestion q) => q.toJson()).toList(),
        'answers': answers.map(
          (String k, QuizAnswerValue v) =>
              MapEntry<String, dynamic>(k, v.toJson()),
        ),
        'focusLossCount': focusLossCount,
        'maxScore': maxScore,
        'syncVersion': syncVersion,
        'score': score,
      };

  @override
  List<Object?> get props =>
      <Object?>[attemptId, status, answers, syncVersion, focusLossCount];
}

/// One pending answer waiting to be flushed to the server.
class PendingAnswer {
  const PendingAnswer({
    required this.questionId,
    required this.value,
    required this.clientUpdatedAt,
  });

  final String questionId;
  final QuizAnswerValue value;

  /// Client clock, used by the server for last-write-wins conflict resolution.
  final DateTime clientUpdatedAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'questionId': questionId,
        'value': value.toJson(),
        'clientUpdatedAt': clientUpdatedAt.toUtc().toIso8601String(),
      };

  factory PendingAnswer.fromJson(Map<String, dynamic> json) => PendingAnswer(
        questionId: asString(json['questionId']),
        value: QuizAnswerValue.fromJson(asMap(json['value'])) ??
            const TextAnswer(text: ''),
        clientUpdatedAt: asDate(json['clientUpdatedAt']),
      );
}

class QuizSyncResult {
  const QuizSyncResult({
    required this.attemptId,
    required this.syncVersion,
    required this.secondsRemaining,
    required this.status,
    required this.accepted,
    required this.rejected,
  });

  final String attemptId;
  final int syncVersion;
  final int secondsRemaining;
  final AttemptStatus status;
  final List<String> accepted;
  final List<({String questionId, String reason})> rejected;

  /// The server closed the attempt (time up or anti-cheat).
  bool get attemptClosed => status != AttemptStatus.inProgress;

  factory QuizSyncResult.fromJson(Map<String, dynamic> json) {
    final List<({String questionId, String reason})> rejected =
        <({String questionId, String reason})>[];
    final dynamic rawRejected = json['rejected'];
    if (rawRejected is List) {
      for (final dynamic item in rawRejected) {
        if (item is Map) {
          rejected.add((
            questionId: asString(item['questionId']),
            reason: asString(item['reason']),
          ));
        }
      }
    }

    return QuizSyncResult(
      attemptId: asString(json['attemptId']),
      syncVersion: asInt(json['syncVersion']),
      secondsRemaining: asInt(json['secondsRemaining']),
      status: AttemptStatus.parse(asStringOrNull(json['status'])),
      accepted: asStringList(json['accepted']),
      rejected: rejected,
    );
  }
}

class QuizResultBreakdown {
  const QuizResultBreakdown({
    required this.questionId,
    required this.prompt,
    required this.points,
    required this.needsManualGrading,
    this.awarded,
    this.isCorrect,
    this.feedback,
  });

  final String questionId;
  final String prompt;
  final double points;
  final bool needsManualGrading;
  final double? awarded;
  final bool? isCorrect;
  final String? feedback;

  factory QuizResultBreakdown.fromJson(Map<String, dynamic> json) =>
      QuizResultBreakdown(
        questionId: asString(json['questionId']),
        prompt: asString(json['prompt']),
        points: asDouble(json['points']),
        needsManualGrading: asBool(json['needsManualGrading']),
        awarded: asDoubleOrNull(json['awarded']),
        isCorrect: json['isCorrect'] is bool ? json['isCorrect'] as bool : null,
        feedback: asStringOrNull(json['feedback']),
      );
}

class QuizResult {
  const QuizResult({
    required this.attemptId,
    required this.status,
    required this.score,
    required this.maxScore,
    required this.passed,
    required this.autoGradedPoints,
    required this.pendingManualPoints,
    required this.breakdown,
    this.submittedAt,
    this.gradedAt,
  });

  final String attemptId;
  final AttemptStatus status;
  final double score;
  final double maxScore;
  final bool passed;
  final double autoGradedPoints;
  final double pendingManualPoints;
  final List<QuizResultBreakdown> breakdown;
  final DateTime? submittedAt;
  final DateTime? gradedAt;

  bool get awaitingManualGrading => pendingManualPoints > 0;
  double get percentage => maxScore <= 0 ? 0 : (score / maxScore) * 100;

  factory QuizResult.fromJson(Map<String, dynamic> json) => QuizResult(
        attemptId: asString(json['attemptId']),
        status: AttemptStatus.parse(asStringOrNull(json['status'])),
        score: asDouble(json['score']),
        maxScore: asDouble(json['maxScore'], fallback: 100),
        passed: asBool(json['passed']),
        autoGradedPoints: asDouble(json['autoGradedPoints']),
        pendingManualPoints: asDouble(json['pendingManualPoints']),
        breakdown:
            asModelList(json['breakdown'], QuizResultBreakdown.fromJson),
        submittedAt: asDateOrNull(json['submittedAt']),
        gradedAt: asDateOrNull(json['gradedAt']),
      );
}
