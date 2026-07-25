import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/enums.dart';
import '../../../data/models/quiz.dart';
import '../../../data/models/session.dart';
import '../../../data/repositories/enrollment_repository.dart';
import '../../../data/repositories/quiz_repository.dart';
import '../../widgets/common.dart';

/// Enrolled-course workspace: materials, quizzes and live classes.
class CourseScreen extends StatefulWidget {
  const CourseScreen({
    super.key,
    required this.courseId,
    required this.repository,
    required this.quizzes,
  });

  final String courseId;
  final EnrollmentRepository repository;
  final QuizRepository quizzes;

  @override
  State<CourseScreen> createState() => _CourseScreenState();
}

class _CourseScreenState extends State<CourseScreen> {
  List<StudyMaterial> _materials = <StudyMaterial>[];
  List<QuizSummary> _quizzes = <QuizSummary>[];
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
      // Fetch in parallel; each section degrades independently.
      final List<Object> results = await Future.wait(<Future<Object>>[
        widget.repository.materials(widget.courseId).catchError(
              (Object _) => <StudyMaterial>[],
            ),
        widget.quizzes.listForCourse(widget.courseId).catchError(
              (Object _) => <QuizSummary>[],
            ),
        widget.repository.courseLiveSessions(widget.courseId).catchError(
              (Object _) => <LiveSessionInfo>[],
            ),
      ]);
      if (!mounted) return;
      setState(() {
        _materials = results[0] as List<StudyMaterial>;
        _quizzes = results[1] as List<QuizSummary>;
        _sessions = results[2] as List<LiveSessionInfo>;
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

  Future<void> _openMaterial(StudyMaterial material) async {
    try {
      final String url =
          await widget.repository.materialDownloadUrl(material.id);
      if (!await launchUrl(Uri.parse(url),
          mode: LaunchMode.externalApplication)) {
        if (mounted) showErrorSnack(context, 'Could not open the file');
      }
    } on ApiException catch (error) {
      if (mounted) showErrorSnack(context, error.message);
    }
  }

  Future<void> _joinSession(LiveSessionInfo session) async {
    try {
      final String url = await widget.repository.joinLiveSession(session.id);
      if (!await launchUrl(Uri.parse(url),
          mode: LaunchMode.externalApplication)) {
        if (mounted) showErrorSnack(context, 'Could not open the classroom');
      }
    } on ApiException catch (error) {
      if (mounted) showErrorSnack(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Course'),
          bottom: const TabBar(
            tabs: <Widget>[
              Tab(text: 'Materials'),
              Tab(text: 'Quizzes'),
              Tab(text: 'Live'),
            ],
          ),
        ),
        body: _loading
            ? const LoadingView()
            : _error != null
                ? ErrorView(message: _error!, onRetry: _load)
                : TabBarView(
                    children: <Widget>[
                      _buildMaterials(),
                      _buildQuizzes(),
                      _buildSessions(),
                    ],
                  ),
      ),
    );
  }

  Widget _buildMaterials() {
    if (_materials.isEmpty) {
      return const EmptyView(
        title: 'No materials yet',
        subtitle: 'Your teacher has not shared any files for this course.',
        icon: Icons.folder_open_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _materials.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (BuildContext context, int index) {
          final StudyMaterial material = _materials[index];
          return Card(
            child: ListTile(
              leading: Icon(_iconFor(material.kind)),
              title: Text(material.title),
              subtitle: material.readableSize.isEmpty
                  ? null
                  : Text(material.readableSize),
              trailing: Icon(
                material.isDownloadable
                    ? Icons.download_outlined
                    : Icons.visibility_outlined,
              ),
              onTap: () => _openMaterial(material),
            ),
          );
        },
      ),
    );
  }

  IconData _iconFor(MediaKind kind) {
    switch (kind) {
      case MediaKind.video:
        return Icons.play_circle_outline;
      case MediaKind.audio:
        return Icons.headphones_outlined;
      case MediaKind.image:
      case MediaKind.panorama360:
        return Icons.image_outlined;
      case MediaKind.document:
        return Icons.picture_as_pdf_outlined;
    }
  }

  Widget _buildQuizzes() {
    if (_quizzes.isEmpty) {
      return const EmptyView(
        title: 'No quizzes',
        subtitle: 'There are no published quizzes for this course yet.',
        icon: Icons.quiz_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _quizzes.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (BuildContext context, int index) {
          final QuizSummary quiz = _quizzes[index];
          final bool open = quiz.isOpenNow;

          return Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    quiz.title,
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  if (quiz.description != null) ...<Widget>[
                    const SizedBox(height: 4),
                    Text(
                      quiz.description!,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: <Widget>[
                      TagChip(
                        label: '${quiz.questionCount} questions',
                        dense: true,
                      ),
                      TagChip(
                        label: '${quiz.timeLimit.inMinutes} min',
                        icon: Icons.timer_outlined,
                        dense: true,
                      ),
                      TagChip(
                        label: 'Pass ${quiz.passingScore.round()}',
                        dense: true,
                      ),
                      if (quiz.antiCheatEnabled)
                        const TagChip(
                          label: 'Proctored',
                          icon: Icons.security_outlined,
                          color: AppTheme.warning,
                          dense: true,
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: open
                          ? () => context.push('/quiz/${quiz.id}')
                          : null,
                      child: Text(open ? 'Start quiz' : 'Not available'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSessions() {
    if (_sessions.isEmpty) {
      return const EmptyView(
        title: 'No live classes',
        subtitle: 'Scheduled online sessions will appear here.',
        icon: Icons.videocam_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _sessions.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (BuildContext context, int index) {
          final LiveSessionInfo session = _sessions[index];
          return Card(
            child: ListTile(
              leading: Icon(
                Icons.videocam_rounded,
                color: session.isLive ? AppTheme.danger : null,
              ),
              title: Text(session.title),
              subtitle: Text(
                session.isLive
                    ? 'Live now'
                    : session.isPast
                        ? 'Ended'
                        : 'Starts ${session.startsAt.toLocal()}',
              ),
              trailing: session.hasRecording && session.isPast
                  ? TextButton(
                      onPressed: () => launchUrl(
                        Uri.parse(session.recordingUrl!),
                        mode: LaunchMode.externalApplication,
                      ),
                      child: const Text('Recording'),
                    )
                  : FilledButton(
                      onPressed:
                          session.isPast ? null : () => _joinSession(session),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 36),
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                      ),
                      child: const Text('Join'),
                    ),
            ),
          );
        },
      ),
    );
  }
}
