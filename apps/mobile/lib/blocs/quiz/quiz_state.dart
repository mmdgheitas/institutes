part of 'quiz_bloc.dart';

enum QuizStatus { initial, loading, active, submitting, finished, failure }

/// How the local answer buffer relates to the server right now.
enum SyncState { idle, syncing, pending, offline, failed }

class QuizState extends Equatable {
  const QuizState({
    this.status = QuizStatus.initial,
    this.attempt,
    this.result,
    this.currentIndex = 0,
    this.syncState = SyncState.idle,
    this.pendingCount = 0,
    this.remaining = Duration.zero,
    this.focusLossCount = 0,
    this.isOnline = true,
    this.error,
    this.warning,
    this.lastSyncedAt,
  });

  final QuizStatus status;
  final QuizAttemptState? attempt;
  final QuizResult? result;
  final int currentIndex;
  final SyncState syncState;

  /// Answers written locally but not yet acknowledged by the server.
  final int pendingCount;

  /// Time left, recomputed each tick from the server's `expiresAt`.
  final Duration remaining;
  final int focusLossCount;
  final bool isOnline;
  final String? error;

  /// Non-fatal notice (e.g. an anti-cheat warning).
  final String? warning;
  final DateTime? lastSyncedAt;

  List<QuizQuestion> get questions => attempt?.questions ?? const <QuizQuestion>[];
  int get questionCount => questions.length;

  QuizQuestion? get currentQuestion =>
      currentIndex >= 0 && currentIndex < questions.length
          ? questions[currentIndex]
          : null;

  QuizAnswerValue? answerFor(String questionId) =>
      attempt?.answers[questionId];

  int get answeredCount => attempt?.answeredCount ?? 0;

  bool get isFirstQuestion => currentIndex <= 0;
  bool get isLastQuestion => currentIndex >= questionCount - 1;
  bool get hasUnsyncedWork => pendingCount > 0;

  /// Under two minutes left — the UI turns the timer red.
  bool get isTimeCritical =>
      remaining.inSeconds > 0 && remaining.inSeconds <= 120;

  String get formattedRemaining {
    final int total = remaining.inSeconds;
    if (total <= 0) return '00:00';
    final int hours = total ~/ 3600;
    final int minutes = (total % 3600) ~/ 60;
    final int seconds = total % 60;
    final String mm = minutes.toString().padLeft(2, '0');
    final String ss = seconds.toString().padLeft(2, '0');
    return hours > 0 ? '${hours.toString().padLeft(2, '0')}:$mm:$ss' : '$mm:$ss';
  }

  QuizState copyWith({
    QuizStatus? status,
    QuizAttemptState? attempt,
    QuizResult? result,
    int? currentIndex,
    SyncState? syncState,
    int? pendingCount,
    Duration? remaining,
    int? focusLossCount,
    bool? isOnline,
    String? error,
    String? warning,
    DateTime? lastSyncedAt,
    bool clearError = false,
    bool clearWarning = false,
  }) {
    return QuizState(
      status: status ?? this.status,
      attempt: attempt ?? this.attempt,
      result: result ?? this.result,
      currentIndex: currentIndex ?? this.currentIndex,
      syncState: syncState ?? this.syncState,
      pendingCount: pendingCount ?? this.pendingCount,
      remaining: remaining ?? this.remaining,
      focusLossCount: focusLossCount ?? this.focusLossCount,
      isOnline: isOnline ?? this.isOnline,
      error: clearError ? null : (error ?? this.error),
      warning: clearWarning ? null : (warning ?? this.warning),
      lastSyncedAt: lastSyncedAt ?? this.lastSyncedAt,
    );
  }

  @override
  List<Object?> get props => <Object?>[
        status,
        attempt,
        result,
        currentIndex,
        syncState,
        pendingCount,
        remaining,
        focusLossCount,
        isOnline,
        error,
        warning,
      ];
}
