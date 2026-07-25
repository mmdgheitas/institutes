import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../data/models/quiz.dart';

/// Score summary shown immediately after submitting.
class QuizResultScreen extends StatelessWidget {
  const QuizResultScreen({super.key, required this.result});

  final QuizResult result;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool pending = result.awaitingManualGrading;
    final Color accent =
        pending ? AppTheme.warning : (result.passed ? AppTheme.success : AppTheme.danger);

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Your result'),
        actions: <Widget>[
          TextButton(
            onPressed: () => context.go('/home'),
            child: const Text('Done'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: <Widget>[
                  Icon(
                    pending
                        ? Icons.hourglass_top_rounded
                        : result.passed
                            ? Icons.emoji_events_rounded
                            : Icons.sentiment_dissatisfied_rounded,
                    size: 64,
                    color: accent,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    pending
                        ? 'Partially graded'
                        : result.passed
                            ? 'Passed'
                            : 'Not passed',
                    style: theme.textTheme.headlineSmall
                        ?.copyWith(fontWeight: FontWeight.w700, color: accent),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '${result.score.toStringAsFixed(1)} / ${result.maxScore.toStringAsFixed(0)}',
                    style: theme.textTheme.displaySmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: (result.percentage / 100).clamp(0.0, 1.0),
                      minHeight: 10,
                      color: accent,
                    ),
                  ),
                  if (pending) ...<Widget>[
                    const SizedBox(height: 16),
                    Text(
                      '${result.pendingManualPoints.toStringAsFixed(0)} point(s) '
                      'are awaiting manual grading by your teacher. Your final '
                      'score may increase.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Question breakdown',
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          ...result.breakdown.map((QuizResultBreakdown item) {
            final IconData icon;
            final Color color;
            if (item.needsManualGrading) {
              icon = Icons.hourglass_empty_rounded;
              color = AppTheme.warning;
            } else if (item.isCorrect == true) {
              icon = Icons.check_circle;
              color = AppTheme.success;
            } else {
              icon = Icons.cancel;
              color = AppTheme.danger;
            }

            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Icon(icon, color: color, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              item.prompt,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodyMedium,
                            ),
                            if (item.feedback != null) ...<Widget>[
                              const SizedBox(height: 6),
                              Text(
                                item.feedback!,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  fontStyle: FontStyle.italic,
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        item.needsManualGrading
                            ? '— / ${item.points.toStringAsFixed(0)}'
                            : '${(item.awarded ?? 0).toStringAsFixed(1)} / ${item.points.toStringAsFixed(0)}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
