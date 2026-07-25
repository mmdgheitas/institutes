import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../blocs/quiz/quiz_bloc.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/enums.dart';
import '../../../data/models/quiz.dart';
import '../../widgets/common.dart';
import 'quiz_result_screen.dart';

/// Live exam runner.
///
/// Watches the app lifecycle: leaving the app during an exam is reported as a
/// focus loss (anti-cheat) and the countdown keeps running server-side.
class QuizScreen extends StatefulWidget {
  const QuizScreen({super.key, required this.quizId});

  final String quizId;

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> with WidgetsBindingObserver {
  final TextEditingController _textController = TextEditingController();
  String? _textControllerQuestionId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    context.read<QuizBloc>().add(QuizStarted(widget.quizId));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _textController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Backgrounding the app mid-exam is the signal the anti-cheat rule uses.
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      final QuizBloc bloc = context.read<QuizBloc>();
      if (bloc.state.status == QuizStatus.active) {
        bloc.add(const AppFocusLost());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<QuizBloc, QuizState>(
      listenWhen: (QuizState prev, QuizState next) =>
          prev.warning != next.warning ||
          prev.error != next.error ||
          prev.status != next.status,
      listener: (BuildContext context, QuizState state) {
        final String? warning = state.warning;
        if (warning != null) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(
              SnackBar(
                content: Text(warning),
                backgroundColor: AppTheme.warning,
                duration: const Duration(seconds: 5),
              ),
            );
          context.read<QuizBloc>().add(const QuizWarningCleared());
        }
        final String? error = state.error;
        if (error != null && state.status != QuizStatus.failure) {
          showErrorSnack(context, error);
        }
      },
      builder: (BuildContext context, QuizState state) {
        switch (state.status) {
          case QuizStatus.initial:
          case QuizStatus.loading:
            return const Scaffold(
              body: LoadingView(message: 'Preparing your exam…'),
            );

          case QuizStatus.failure:
            return Scaffold(
              appBar: AppBar(),
              body: ErrorView(
                message: state.error ?? 'Could not start the quiz',
                onRetry: () =>
                    context.read<QuizBloc>().add(QuizStarted(widget.quizId)),
              ),
            );

          case QuizStatus.submitting:
            return const Scaffold(
              body: LoadingView(message: 'Submitting your answers…'),
            );

          case QuizStatus.finished:
            final QuizResult? result = state.result;
            if (result == null) {
              return const Scaffold(body: LoadingView());
            }
            return QuizResultScreen(result: result);

          case QuizStatus.active:
            return _buildActive(state);
        }
      },
    );
  }

  Widget _buildActive(QuizState state) {
    final QuizQuestion? question = state.currentQuestion;
    if (question == null) {
      return const Scaffold(body: LoadingView());
    }

    return PopScope(
      // Prevent an accidental back-swipe from abandoning the exam.
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? _) async {
        if (didPop) return;
        final bool leave = await _confirmExit(state);
        if (leave && mounted) context.pop();
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: Text('Question ${state.currentIndex + 1}/${state.questionCount}'),
          actions: <Widget>[
            _buildSyncIndicator(state),
            const SizedBox(width: 8),
            _buildTimer(state),
            const SizedBox(width: 12),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(4),
            child: LinearProgressIndicator(
              value: state.questionCount == 0
                  ? 0
                  : (state.currentIndex + 1) / state.questionCount,
            ),
          ),
        ),
        body: Column(
          children: <Widget>[
            if (!state.isOnline) _buildOfflineBanner(state),
            Expanded(child: _buildQuestion(state, question)),
            _buildQuestionGrid(state),
          ],
        ),
        bottomNavigationBar: _buildNav(state),
      ),
    );
  }

  Widget _buildOfflineBanner(QuizState state) {
    return Material(
      color: AppTheme.warning.withValues(alpha: 0.15),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: <Widget>[
            const Icon(Icons.cloud_off_rounded, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Offline — your answers are saved on this device and will sync '
                'automatically${state.pendingCount > 0 ? ' (${state.pendingCount} pending)' : ''}.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSyncIndicator(QuizState state) {
    late final IconData icon;
    late final Color color;
    late final String tooltip;

    switch (state.syncState) {
      case SyncState.syncing:
        return const Padding(
          padding: EdgeInsets.all(14),
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        );
      case SyncState.pending:
        icon = Icons.cloud_upload_outlined;
        color = AppTheme.warning;
        tooltip = '${state.pendingCount} answer(s) waiting to sync';
      case SyncState.offline:
        icon = Icons.cloud_off_rounded;
        color = AppTheme.danger;
        tooltip = 'Offline — saved locally';
      case SyncState.failed:
        icon = Icons.sync_problem_rounded;
        color = AppTheme.danger;
        tooltip = 'Sync failed, retrying';
      case SyncState.idle:
        icon = Icons.cloud_done_outlined;
        color = AppTheme.success;
        tooltip = 'All answers saved';
    }

    return Tooltip(
      message: tooltip,
      child: Icon(icon, color: color, size: 20),
    );
  }

  Widget _buildTimer(QuizState state) {
    final bool critical = state.isTimeCritical;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: critical
            ? AppTheme.danger.withValues(alpha: 0.15)
            : Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(
            Icons.timer_outlined,
            size: 16,
            color: critical ? AppTheme.danger : null,
          ),
          const SizedBox(width: 6),
          Text(
            state.formattedRemaining,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
              color: critical ? AppTheme.danger : null,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestion(QuizState state, QuizQuestion question) {
    final QuizAnswerValue? answer = state.answerFor(question.id);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Row(
          children: <Widget>[
            TagChip(
              label: '${question.points} pt${question.points == 1 ? '' : 's'}',
              dense: true,
            ),
            const SizedBox(width: 8),
            if (question.type == QuestionType.multiSelect)
              const TagChip(
                label: 'Select all that apply',
                dense: true,
                color: AppTheme.secondary,
              ),
          ],
        ),
        const SizedBox(height: 14),
        Text(
          question.prompt,
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(height: 1.4, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 20),
        if (question.type.isChoice)
          _buildChoices(state, question, answer)
        else if (question.type.isText)
          _buildTextAnswer(question, answer)
        else
          _buildFileAnswer(question, answer),
      ],
    );
  }

  Widget _buildChoices(
    QuizState state,
    QuizQuestion question,
    QuizAnswerValue? answer,
  ) {
    final List<String> selected =
        answer is ChoiceAnswer ? answer.optionIds : <String>[];
    final bool multi = question.type == QuestionType.multiSelect;

    return Column(
      children: question.options.map((QuizOption option) {
        final bool isSelected = selected.contains(option.id);
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () {
              List<String> next;
              if (multi) {
                next = List<String>.from(selected);
                if (isSelected) {
                  next.remove(option.id);
                } else {
                  next.add(option.id);
                }
              } else {
                // Single-choice: tapping the selected option clears it.
                next = isSelected ? <String>[] : <String>[option.id];
              }
              context.read<QuizBloc>().add(
                    AnswerChanged(
                      questionId: question.id,
                      value: ChoiceAnswer(optionIds: next),
                    ),
                  );
            },
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSelected
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.outlineVariant,
                  width: isSelected ? 2 : 1,
                ),
                color: isSelected
                    ? Theme.of(context)
                        .colorScheme
                        .primaryContainer
                        .withValues(alpha: 0.35)
                    : null,
              ),
              child: Row(
                children: <Widget>[
                  Icon(
                    multi
                        ? (isSelected
                            ? Icons.check_box
                            : Icons.check_box_outline_blank)
                        : (isSelected
                            ? Icons.radio_button_checked
                            : Icons.radio_button_unchecked),
                    color: isSelected
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.outline,
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(option.text)),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTextAnswer(QuizQuestion question, QuizAnswerValue? answer) {
    // Rebind the controller when the question changes, preserving the answer.
    if (_textControllerQuestionId != question.id) {
      _textControllerQuestionId = question.id;
      _textController.text = answer is TextAnswer ? answer.text : '';
    }

    final bool isEssay = question.type == QuestionType.essay;
    return TextField(
      controller: _textController,
      maxLines: isEssay ? 12 : 2,
      minLines: isEssay ? 6 : 1,
      textCapitalization: TextCapitalization.sentences,
      decoration: InputDecoration(
        hintText: isEssay ? 'Write your answer…' : 'Your answer',
        alignLabelWithHint: true,
      ),
      onChanged: (String text) => context.read<QuizBloc>().add(
            AnswerChanged(
              questionId: question.id,
              value: TextAnswer(text: text),
            ),
          ),
    );
  }

  Widget _buildFileAnswer(QuizQuestion question, QuizAnswerValue? answer) {
    final ThemeData theme = Theme.of(context);
    if (answer is FileAnswer) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Row(
          children: <Widget>[
            Icon(Icons.attach_file, color: theme.colorScheme.primary),
            const SizedBox(width: 10),
            Expanded(child: Text(answer.fileName)),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        OutlinedButton.icon(
          // File answers upload through the same presigned flow as forms;
          // wired at the route level where UploadRepository is available.
          onPressed: () => showErrorSnack(
            context,
            'Attach files from the course materials screen for this question type.',
          ),
          icon: const Icon(Icons.upload_file_outlined),
          label: const Text('Upload your answer'),
        ),
        const SizedBox(height: 8),
        Text(
          'Accepted: ${question.allowedMimeTypes.isEmpty ? 'any file' : question.allowedMimeTypes.join(', ')}',
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }

  /// Question navigator: shows at a glance what is answered.
  Widget _buildQuestionGrid(QuizState state) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
        ),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: state.questionCount,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (BuildContext context, int index) {
          final QuizQuestion question = state.questions[index];
          final bool answered =
              state.answerFor(question.id)?.isAnswered ?? false;
          final bool current = index == state.currentIndex;

          return Center(
            child: GestureDetector(
              onTap: () =>
                  context.read<QuizBloc>().add(QuestionIndexChanged(index)),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: current
                      ? Theme.of(context).colorScheme.primary
                      : answered
                          ? AppTheme.success.withValues(alpha: 0.2)
                          : Theme.of(context).colorScheme.surfaceContainerHighest,
                  border: current
                      ? null
                      : Border.all(
                          color: answered
                              ? AppTheme.success
                              : Theme.of(context).colorScheme.outlineVariant,
                        ),
                ),
                alignment: Alignment.center,
                child: Text(
                  '${index + 1}',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: current
                        ? Theme.of(context).colorScheme.onPrimary
                        : answered
                            ? AppTheme.success
                            : null,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildNav(QuizState state) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: <Widget>[
            if (!state.isFirstQuestion)
              Expanded(
                child: OutlinedButton(
                  onPressed: () => context
                      .read<QuizBloc>()
                      .add(const PreviousQuestionRequested()),
                  child: const Text('Previous'),
                ),
              ),
            if (!state.isFirstQuestion) const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: state.isLastQuestion
                  ? FilledButton.icon(
                      onPressed: () => _confirmSubmit(state),
                      icon: const Icon(Icons.check_circle_outline),
                      label: const Text('Finish & submit'),
                    )
                  : FilledButton(
                      onPressed: () => context
                          .read<QuizBloc>()
                          .add(const NextQuestionRequested()),
                      child: const Text('Next'),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmSubmit(QuizState state) async {
    final int unanswered = state.questionCount - state.answeredCount;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: const Text('Submit your exam?'),
        content: Text(
          unanswered > 0
              ? 'You still have $unanswered unanswered question(s). '
                  'Once submitted you cannot make changes.'
              : 'All questions are answered. Once submitted you cannot make '
                  'changes.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep working'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Submit'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      context.read<QuizBloc>().add(const QuizSubmitted());
    }
  }

  Future<bool> _confirmExit(QuizState state) async {
    final bool? leave = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) => AlertDialog(
        title: const Text('Leave the exam?'),
        content: const Text(
          'The timer keeps running while you are away and leaving is recorded. '
          'Your answers are saved.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Stay'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
    return leave ?? false;
  }
}
