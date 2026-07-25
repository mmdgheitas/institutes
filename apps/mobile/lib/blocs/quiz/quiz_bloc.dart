import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:equatable/equatable.dart';

import '../../core/config/app_config.dart';
import '../../core/network/api_exception.dart';
import '../../data/local/quiz_cache.dart';
import '../../data/models/quiz.dart';
import '../../data/repositories/quiz_repository.dart';

part 'quiz_event.dart';
part 'quiz_state.dart';

/// Drives a live exam.
///
/// Offline strategy:
///  - every answer is written to Hive immediately, then queued in an outbox
///  - a periodic timer flushes the outbox whenever the device is online
///  - the countdown always derives from the server's `expiresAt`, never from a
///    local stopwatch, so backgrounding or clock changes cannot buy extra time
///  - on reconnect the queue replays; the server rejects anything stale
class QuizBloc extends Bloc<QuizEvent, QuizState> {
  QuizBloc({
    required QuizRepository repository,
    required QuizCache cache,
    Connectivity? connectivity,
  })  : _repository = repository,
        _cache = cache,
        _connectivity = connectivity ?? Connectivity(),
        super(const QuizState()) {
    on<QuizStarted>(_onStarted);
    on<QuizAttemptResumed>(_onResumed);
    on<AnswerChanged>(_onAnswerChanged);
    on<QuestionIndexChanged>(_onIndexChanged);
    on<NextQuestionRequested>(_onNext);
    on<PreviousQuestionRequested>(_onPrevious);
    on<QuizTicked>(_onTick);
    on<SyncRequested>(_onSync);
    on<ConnectivityChanged>(_onConnectivityChanged);
    on<AppFocusLost>(_onFocusLost);
    on<QuizSubmitted>(_onSubmitted);
    on<QuizWarningCleared>(
      (QuizWarningCleared e, Emitter<QuizState> emit) =>
          emit(state.copyWith(clearWarning: true)),
    );

    _watchConnectivity();
  }

  final QuizRepository _repository;
  final QuizCache _cache;
  final Connectivity _connectivity;

  Timer? _ticker;
  Timer? _syncTimer;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  /// Guards against two syncs overlapping.
  bool _syncInFlight = false;

  @override
  Future<void> close() {
    _ticker?.cancel();
    _syncTimer?.cancel();
    _connectivitySub?.cancel();
    return super.close();
  }

  void _watchConnectivity() {
    _connectivitySub = _connectivity.onConnectivityChanged.listen(
      (List<ConnectivityResult> results) {
        final bool online = results.any(
          (ConnectivityResult r) => r != ConnectivityResult.none,
        );
        if (!isClosed) add(ConnectivityChanged(online));
      },
    );
  }

  void _startTimers() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!isClosed) add(const QuizTicked());
    });

    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(AppConfig.quizSyncInterval, (_) {
      if (!isClosed) add(const SyncRequested());
    });
  }

  void _stopTimers() {
    _ticker?.cancel();
    _ticker = null;
    _syncTimer?.cancel();
    _syncTimer = null;
  }

  Future<void> _onStarted(QuizStarted event, Emitter<QuizState> emit) async {
    emit(state.copyWith(status: QuizStatus.loading, clearError: true));
    try {
      final QuizAttemptState attempt =
          await _repository.startAttempt(event.quizId);
      await _cache.saveAttempt(attempt);
      _startTimers();
      emit(state.copyWith(
        status: QuizStatus.active,
        attempt: attempt,
        remaining: attempt.remaining,
        focusLossCount: attempt.focusLossCount,
        pendingCount: _cache.pendingCount(attempt.attemptId),
        currentIndex: 0,
        syncState: SyncState.idle,
      ));
    } on ApiException catch (error) {
      emit(state.copyWith(status: QuizStatus.failure, error: error.message));
    }
  }

  Future<void> _onResumed(
    QuizAttemptResumed event,
    Emitter<QuizState> emit,
  ) async {
    emit(state.copyWith(status: QuizStatus.loading, clearError: true));

    // Prefer the local copy so the student sees their answers instantly,
    // even with no connection.
    final QuizAttemptState? cached = _cache.readAttempt(event.attemptId);
    if (cached != null) {
      _startTimers();
      emit(state.copyWith(
        status: QuizStatus.active,
        attempt: cached,
        remaining: cached.remaining,
        focusLossCount: cached.focusLossCount,
        pendingCount: _cache.pendingCount(event.attemptId),
      ));
    }

    // Then reconcile with the server.
    try {
      final QuizAttemptState fresh =
          await _repository.getAttempt(event.attemptId);

      // Local unsynced answers must survive the merge.
      final Map<String, QuizAnswerValue> merged =
          Map<String, QuizAnswerValue>.from(fresh.answers);
      for (final PendingAnswer pending in _cache.readOutbox(event.attemptId)) {
        merged[pending.questionId] = pending.value;
      }

      final QuizAttemptState reconciled = fresh.copyWith(answers: merged);
      await _cache.saveAttempt(reconciled);

      if (!reconciled.status.isOpen) {
        _stopTimers();
        final QuizResult result =
            await _repository.result(event.attemptId);
        emit(state.copyWith(
          status: QuizStatus.finished,
          attempt: reconciled,
          result: result,
        ));
        return;
      }

      _startTimers();
      emit(state.copyWith(
        status: QuizStatus.active,
        attempt: reconciled,
        remaining: reconciled.remaining,
        focusLossCount: reconciled.focusLossCount,
        pendingCount: _cache.pendingCount(event.attemptId),
      ));
      add(const SyncRequested());
    } on ApiException catch (error) {
      if (cached == null) {
        emit(state.copyWith(status: QuizStatus.failure, error: error.message));
      } else {
        // Offline: carry on with the cached attempt.
        emit(state.copyWith(syncState: SyncState.offline));
      }
    }
  }

  Future<void> _onAnswerChanged(
    AnswerChanged event,
    Emitter<QuizState> emit,
  ) async {
    final QuizAttemptState? attempt = state.attempt;
    if (attempt == null || !attempt.status.isOpen) return;

    // 1. Update in memory.
    final Map<String, QuizAnswerValue> answers =
        Map<String, QuizAnswerValue>.from(attempt.answers)
          ..[event.questionId] = event.value;
    final QuizAttemptState updated = attempt.copyWith(answers: answers);

    // 2. Persist locally before anything else, so a crash loses nothing.
    await _cache.saveAttempt(updated);
    await _cache.enqueueAnswer(
      attempt.attemptId,
      PendingAnswer(
        questionId: event.questionId,
        value: event.value,
        clientUpdatedAt: DateTime.now(),
      ),
    );

    emit(state.copyWith(
      attempt: updated,
      pendingCount: _cache.pendingCount(attempt.attemptId),
      syncState: state.isOnline ? SyncState.pending : SyncState.offline,
    ));
  }

  void _onIndexChanged(QuestionIndexChanged event, Emitter<QuizState> emit) {
    if (event.index < 0 || event.index >= state.questionCount) return;
    emit(state.copyWith(currentIndex: event.index));
  }

  void _onNext(NextQuestionRequested event, Emitter<QuizState> emit) {
    if (state.isLastQuestion) return;
    emit(state.copyWith(currentIndex: state.currentIndex + 1));
  }

  void _onPrevious(PreviousQuestionRequested event, Emitter<QuizState> emit) {
    if (state.isFirstQuestion) return;
    emit(state.copyWith(currentIndex: state.currentIndex - 1));
  }

  Future<void> _onTick(QuizTicked event, Emitter<QuizState> emit) async {
    final QuizAttemptState? attempt = state.attempt;
    if (attempt == null || state.status != QuizStatus.active) return;

    final Duration remaining = attempt.remaining;
    emit(state.copyWith(remaining: remaining));

    // Time is up: submit automatically. The server enforces this too, so a
    // killed app still gets graded — this just makes it immediate.
    if (remaining == Duration.zero) {
      _stopTimers();
      add(const QuizSubmitted());
    }
  }

  Future<void> _onSync(SyncRequested event, Emitter<QuizState> emit) async {
    final QuizAttemptState? attempt = state.attempt;
    if (attempt == null || !attempt.status.isOpen) return;
    if (_syncInFlight) return;
    if (!state.isOnline) {
      emit(state.copyWith(syncState: SyncState.offline));
      return;
    }

    final List<PendingAnswer> pending = _cache.readOutbox(attempt.attemptId);
    if (pending.isEmpty && !event.force) {
      emit(state.copyWith(syncState: SyncState.idle));
      return;
    }

    _syncInFlight = true;
    final DateTime syncStartedAt = DateTime.now();
    emit(state.copyWith(syncState: SyncState.syncing));

    try {
      final QuizSyncResult result = await _repository.sync(
        attemptId: attempt.attemptId,
        answers: pending,
        syncVersion: attempt.syncVersion,
        focusLossCount: state.focusLossCount,
      );

      await _cache.clearAccepted(
        attempt.attemptId,
        result.accepted,
        syncStartedAt,
      );

      final QuizAttemptState synced =
          attempt.copyWith(syncVersion: result.syncVersion);
      await _cache.saveAttempt(synced);

      // The server may have closed the attempt (time up or anti-cheat).
      if (result.attemptClosed) {
        _stopTimers();
        emit(state.copyWith(
          attempt: synced.copyWith(status: result.status),
          syncState: SyncState.idle,
          warning: 'Your attempt was submitted by the server.',
        ));
        add(const QuizSubmitted());
        return;
      }

      final int stillPending = _cache.pendingCount(attempt.attemptId);
      emit(state.copyWith(
        attempt: synced,
        pendingCount: stillPending,
        syncState: stillPending > 0 ? SyncState.pending : SyncState.idle,
        lastSyncedAt: DateTime.now(),
      ));
    } on ApiException catch (error) {
      // Answers stay queued; the next tick retries.
      emit(state.copyWith(
        syncState: error.isNetworkError ? SyncState.offline : SyncState.failed,
      ));
    } finally {
      _syncInFlight = false;
    }
  }

  Future<void> _onConnectivityChanged(
    ConnectivityChanged event,
    Emitter<QuizState> emit,
  ) async {
    final bool wasOffline = !state.isOnline;
    emit(state.copyWith(
      isOnline: event.isOnline,
      syncState: event.isOnline ? state.syncState : SyncState.offline,
    ));

    // Reconnected with queued work: flush right away.
    if (wasOffline && event.isOnline && state.hasUnsyncedWork) {
      add(const SyncRequested(force: true));
    }
  }

  Future<void> _onFocusLost(AppFocusLost event, Emitter<QuizState> emit) async {
    final QuizAttemptState? attempt = state.attempt;
    if (attempt == null || !attempt.status.isOpen) return;

    final int count = state.focusLossCount + 1;
    final QuizAttemptState updated = attempt.copyWith(focusLossCount: count);
    await _cache.saveAttempt(updated);

    emit(state.copyWith(
      attempt: updated,
      focusLossCount: count,
      warning:
          'Leaving the exam is recorded. This is warning $count. Repeated '
          'switching may void your attempt.',
    ));

    // Report immediately so proctors see it even if the student never returns.
    add(const SyncRequested(force: true));
  }

  Future<void> _onSubmitted(
    QuizSubmitted event,
    Emitter<QuizState> emit,
  ) async {
    final QuizAttemptState? attempt = state.attempt;
    if (attempt == null) return;

    _stopTimers();
    emit(state.copyWith(status: QuizStatus.submitting, clearError: true));

    // Best effort: push any remaining answers before finalising.
    if (state.isOnline && _cache.hasPending(attempt.attemptId)) {
      try {
        final DateTime syncStartedAt = DateTime.now();
        final QuizSyncResult sync = await _repository.sync(
          attemptId: attempt.attemptId,
          answers: _cache.readOutbox(attempt.attemptId),
          syncVersion: attempt.syncVersion,
          focusLossCount: state.focusLossCount,
        );
        await _cache.clearAccepted(
          attempt.attemptId,
          sync.accepted,
          syncStartedAt,
        );
      } on ApiException {
        // Fall through: submitting is more important than a clean flush.
      }
    }

    try {
      final QuizResult result = await _repository.submit(attempt.attemptId);
      await _cache.deleteAttempt(attempt.attemptId);
      emit(state.copyWith(
        status: QuizStatus.finished,
        result: result,
        pendingCount: 0,
        syncState: SyncState.idle,
      ));
    } on ApiException catch (error) {
      if (error.isNetworkError) {
        // Keep the local attempt so it can be submitted once back online.
        emit(state.copyWith(
          status: QuizStatus.active,
          syncState: SyncState.offline,
          error:
              'Could not reach the server to submit. Your answers are saved '
              'and will be sent automatically when you are back online.',
        ));
        _startTimers();
      } else {
        emit(state.copyWith(status: QuizStatus.failure, error: error.message));
      }
    }
  }
}
