import 'dart:convert';

import 'package:hive_flutter/hive_flutter.dart';

import '../models/quiz.dart';

/// Local persistence for in-flight quiz attempts.
///
/// Everything is stored as JSON strings rather than typed Hive objects, which
/// avoids `build_runner` and generated adapters entirely — one less thing that
/// can break on a fresh checkout.
///
/// Two boxes:
///  - `quiz_attempts`  attemptId -> serialized [QuizAttemptState]
///  - `quiz_outbox`    attemptId -> list of unsynced [PendingAnswer]
class QuizCache {
  QuizCache._(this._attempts, this._outbox);

  final Box<String> _attempts;
  final Box<String> _outbox;

  static const String _attemptsBox = 'quiz_attempts';
  static const String _outboxBox = 'quiz_outbox';

  /// Opens the boxes. Call once during app start-up.
  static Future<QuizCache> open() async {
    final Box<String> attempts = await Hive.openBox<String>(_attemptsBox);
    final Box<String> outbox = await Hive.openBox<String>(_outboxBox);
    return QuizCache._(attempts, outbox);
  }

  /* --------------------------------------------------------- attempts --- */

  Future<void> saveAttempt(QuizAttemptState state) async {
    await _attempts.put(state.attemptId, jsonEncode(state.toJson()));
  }

  QuizAttemptState? readAttempt(String attemptId) {
    final String? raw = _attempts.get(attemptId);
    if (raw == null) return null;
    try {
      final dynamic decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      return QuizAttemptState.fromJson(Map<String, dynamic>.from(decoded));
    } on FormatException {
      // Corrupted entry: drop it rather than blocking the student.
      _attempts.delete(attemptId);
      return null;
    }
  }

  /// Any attempt still marked in-progress, so the app can offer to resume.
  QuizAttemptState? findResumableAttempt() {
    for (final String key in _attempts.keys.cast<String>()) {
      final QuizAttemptState? state = readAttempt(key);
      if (state != null && state.status.isOpen && !state.isExpired) {
        return state;
      }
    }
    return null;
  }

  Future<void> deleteAttempt(String attemptId) async {
    await _attempts.delete(attemptId);
    await _outbox.delete(attemptId);
  }

  /* ----------------------------------------------------------- outbox --- */

  /// Queues an answer for delivery, replacing any earlier entry for the same
  /// question (only the newest value per question is worth sending).
  Future<void> enqueueAnswer(String attemptId, PendingAnswer answer) async {
    final List<PendingAnswer> pending = readOutbox(attemptId)
      ..removeWhere((PendingAnswer p) => p.questionId == answer.questionId)
      ..add(answer);
    await _writeOutbox(attemptId, pending);
  }

  List<PendingAnswer> readOutbox(String attemptId) {
    final String? raw = _outbox.get(attemptId);
    if (raw == null) return <PendingAnswer>[];
    try {
      final dynamic decoded = jsonDecode(raw);
      if (decoded is! List) return <PendingAnswer>[];
      return decoded
          .whereType<Map<dynamic, dynamic>>()
          .map((Map<dynamic, dynamic> e) =>
              PendingAnswer.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on FormatException {
      _outbox.delete(attemptId);
      return <PendingAnswer>[];
    }
  }

  bool hasPending(String attemptId) => readOutbox(attemptId).isNotEmpty;

  int pendingCount(String attemptId) => readOutbox(attemptId).length;

  /// Removes the answers the server confirmed, keeping any queued since.
  Future<void> clearAccepted(
    String attemptId,
    List<String> acceptedQuestionIds,
    DateTime syncStartedAt,
  ) async {
    if (acceptedQuestionIds.isEmpty) return;
    final Set<String> accepted = acceptedQuestionIds.toSet();
    final List<PendingAnswer> remaining = readOutbox(attemptId)
        .where((PendingAnswer p) =>
            // Keep it if the server did not accept it, or if the student
            // edited it again after this sync began.
            !accepted.contains(p.questionId) ||
            p.clientUpdatedAt.isAfter(syncStartedAt))
        .toList();
    await _writeOutbox(attemptId, remaining);
  }

  Future<void> clearOutbox(String attemptId) async {
    await _outbox.delete(attemptId);
  }

  Future<void> _writeOutbox(String attemptId, List<PendingAnswer> pending) async {
    if (pending.isEmpty) {
      await _outbox.delete(attemptId);
      return;
    }
    await _outbox.put(
      attemptId,
      jsonEncode(pending.map((PendingAnswer p) => p.toJson()).toList()),
    );
  }

  /// Wipes everything (used on sign-out).
  Future<void> clearAll() async {
    await _attempts.clear();
    await _outbox.clear();
  }
}
