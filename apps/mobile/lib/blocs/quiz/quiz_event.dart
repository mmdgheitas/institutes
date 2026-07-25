part of 'quiz_bloc.dart';

sealed class QuizEvent extends Equatable {
  const QuizEvent();

  @override
  List<Object?> get props => <Object?>[];
}

/// Begins or resumes an attempt for the given quiz.
class QuizStarted extends QuizEvent {
  const QuizStarted(this.quizId);

  final String quizId;

  @override
  List<Object?> get props => <Object?>[quizId];
}

/// Restores an attempt found in the local cache after a crash/restart.
class QuizAttemptResumed extends QuizEvent {
  const QuizAttemptResumed(this.attemptId);

  final String attemptId;

  @override
  List<Object?> get props => <Object?>[attemptId];
}

class AnswerChanged extends QuizEvent {
  const AnswerChanged({required this.questionId, required this.value});

  final String questionId;
  final QuizAnswerValue value;

  @override
  List<Object?> get props => <Object?>[questionId, value];
}

class QuestionIndexChanged extends QuizEvent {
  const QuestionIndexChanged(this.index);

  final int index;

  @override
  List<Object?> get props => <Object?>[index];
}

class NextQuestionRequested extends QuizEvent {
  const NextQuestionRequested();
}

class PreviousQuestionRequested extends QuizEvent {
  const PreviousQuestionRequested();
}

/// Periodic timer tick (1 Hz) driving the countdown.
class QuizTicked extends QuizEvent {
  const QuizTicked();
}

/// Flush the outbox. [force] ignores the "nothing pending" short-circuit.
class SyncRequested extends QuizEvent {
  const SyncRequested({this.force = false});

  final bool force;

  @override
  List<Object?> get props => <Object?>[force];
}

class ConnectivityChanged extends QuizEvent {
  const ConnectivityChanged(this.isOnline);

  final bool isOnline;

  @override
  List<Object?> get props => <Object?>[isOnline];
}

/// The app lost focus — anti-cheat signal.
class AppFocusLost extends QuizEvent {
  const AppFocusLost();
}

class QuizSubmitted extends QuizEvent {
  const QuizSubmitted();
}

class QuizWarningCleared extends QuizEvent {
  const QuizWarningCleared();
}
