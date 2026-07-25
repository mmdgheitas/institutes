import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/enums.dart';
import '../../../data/models/session.dart';
import '../../../data/repositories/enrollment_repository.dart';
import '../../widgets/common.dart';

/// Enrolled courses plus upcoming live classes.
class MyCoursesScreen extends StatefulWidget {
  const MyCoursesScreen({super.key, required this.repository});

  final EnrollmentRepository repository;

  @override
  State<MyCoursesScreen> createState() => _MyCoursesScreenState();
}

class _MyCoursesScreenState extends State<MyCoursesScreen> {
  List<EnrollmentRecord> _enrollments = <EnrollmentRecord>[];
  List<LiveSessionInfo> _sessions = <LiveSessionInfo>[];
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
      final List<EnrollmentRecord> enrollments =
          await widget.repository.myEnrollments();
      List<LiveSessionInfo> sessions = <LiveSessionInfo>[];
      try {
        sessions = await widget.repository.upcomingLiveSessions();
      } on ApiException {
        // Live sessions are supplementary.
      }
      if (!mounted) return;
      setState(() {
        _enrollments = enrollments;
        _sessions = sessions;
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

  Future<void> _join(LiveSessionInfo session) async {
    try {
      final String url = await widget.repository.joinLiveSession(session.id);
      final Uri uri = Uri.parse(url);
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        if (mounted) showErrorSnack(context, 'Could not open the classroom');
      }
    } on ApiException catch (error) {
      if (mounted) showErrorSnack(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My courses')),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _enrollments.isEmpty && _sessions.isEmpty
                      ? ListView(
                          children: const <Widget>[
                            SizedBox(height: 120),
                            EmptyView(
                              title: 'No courses yet',
                              subtitle:
                                  'Once an institute enrols you, your courses '
                                  'appear here.',
                              icon: Icons.school_outlined,
                            ),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.all(16),
                          children: <Widget>[
                            if (_sessions.isNotEmpty) ...<Widget>[
                              _sectionTitle('Upcoming live classes'),
                              ..._sessions.map(_buildSessionTile),
                              const SizedBox(height: 24),
                            ],
                            _sectionTitle('Enrolled courses'),
                            ..._enrollments.map(_buildCourseTile),
                          ],
                        ),
                ),
    );
  }

  Widget _sectionTitle(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(
          text,
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
      );

  Widget _buildSessionTile(LiveSessionInfo session) {
    final DateFormat formatter = DateFormat('EEE d MMM · HH:mm');
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: ListTile(
          leading: CircleAvatar(
            backgroundColor: session.isLive
                ? AppTheme.danger.withValues(alpha: 0.15)
                : Theme.of(context).colorScheme.surfaceContainerHighest,
            child: Icon(
              Icons.videocam_rounded,
              color: session.isLive ? AppTheme.danger : null,
            ),
          ),
          title: Text(session.title),
          subtitle: Text(
            session.isLive
                ? 'Live now · ${session.provider.label}'
                : formatter.format(session.startsAt),
          ),
          trailing: session.isLive
              ? FilledButton(
                  onPressed: () => _join(session),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                  child: const Text('Join'),
                )
              : OutlinedButton(
                  onPressed: () => _join(session),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: const Text('Open'),
                ),
        ),
      ),
    );
  }

  Widget _buildCourseTile(EnrollmentRecord enrollment) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push('/course/${enrollment.courseId}'),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        enrollment.courseTitle,
                        style: theme.textTheme.titleSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                    TagChip(
                      label: enrollment.status.label,
                      dense: true,
                      color: enrollment.status == EnrollmentStatus.active
                          ? AppTheme.success
                          : theme.colorScheme.outline,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  enrollment.instituteName,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: LinearProgressIndicator(
                          value: enrollment.progressPercent / 100,
                          minHeight: 6,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '${enrollment.progressPercent.round()}%',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
