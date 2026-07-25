import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/dynamic_form.dart';
import '../../../data/models/enums.dart';
import '../../../data/repositories/enrollment_repository.dart';
import '../../widgets/common.dart';

/// Tracks the status of the student's pre-registrations.
class ApplicationsScreen extends StatefulWidget {
  const ApplicationsScreen({super.key, required this.repository});

  final EnrollmentRepository repository;

  @override
  State<ApplicationsScreen> createState() => _ApplicationsScreenState();
}

class _ApplicationsScreenState extends State<ApplicationsScreen> {
  List<MySubmission> _submissions = <MySubmission>[];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final List<MySubmission> data = await widget.repository.mySubmissions();
      if (!mounted) return;
      setState(() {
        _submissions = data;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  /// Human explanation of each CRM stage, so students understand the state.
  String _statusHint(LeadStatus status) {
    switch (status) {
      case LeadStatus.newLead:
        return 'Submitted — waiting for the institute to review.';
      case LeadStatus.contacted:
        return 'The institute has reviewed your application.';
      case LeadStatus.interviewed:
        return 'Your assessment or interview is recorded.';
      case LeadStatus.enrolled:
        return 'You are enrolled. See "My courses".';
      case LeadStatus.cancelled:
        return 'This application was closed.';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My applications')),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _submissions.isEmpty
                      ? ListView(
                          children: <Widget>[
                            const SizedBox(height: 120),
                            EmptyView(
                              title: 'No applications yet',
                              subtitle:
                                  'Find an institute on the map and pre-register '
                                  'to get started.',
                              icon: Icons.assignment_outlined,
                              action: FilledButton.tonal(
                                onPressed: () => context.go('/home'),
                                child: const Text('Explore institutes'),
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _submissions.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (BuildContext context, int index) =>
                              _buildTile(_submissions[index]),
                        ),
                ),
    );
  }

  Widget _buildTile(MySubmission submission) {
    final ThemeData theme = Theme.of(context);
    final Color statusColor =
        AppTheme.leadStatusColors[submission.status.wire] ??
            theme.colorScheme.outline;

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/institute/${submission.instituteSlug}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      submission.instituteName,
                      style: theme.textTheme.titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  TagChip(
                    label: submission.status.label,
                    color: statusColor,
                    dense: true,
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                submission.courseTitle ?? submission.formTitle,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 10),
              // Visual pipeline of the CRM stages.
              Row(
                children: LeadStatus.values
                    .where((LeadStatus s) => s != LeadStatus.cancelled)
                    .map((LeadStatus stage) {
                  final bool reached = _stageIndex(submission.status) >=
                      _stageIndex(stage);
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 4),
                      child: Container(
                        height: 4,
                        decoration: BoxDecoration(
                          color: submission.status == LeadStatus.cancelled
                              ? theme.colorScheme.outlineVariant
                              : reached
                                  ? statusColor
                                  : theme.colorScheme.outlineVariant,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 8),
              Text(
                _statusHint(submission.status),
                style: theme.textTheme.bodySmall,
              ),
              const SizedBox(height: 6),
              Text(
                'Applied ${DateFormat('d MMM yyyy').format(submission.createdAt)}',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  int _stageIndex(LeadStatus status) {
    switch (status) {
      case LeadStatus.newLead:
        return 0;
      case LeadStatus.contacted:
        return 1;
      case LeadStatus.interviewed:
        return 2;
      case LeadStatus.enrolled:
        return 3;
      case LeadStatus.cancelled:
        return -1;
    }
  }
}
