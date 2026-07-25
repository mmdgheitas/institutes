import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../blocs/auth/auth_bloc.dart';
import '../blocs/quiz/quiz_bloc.dart';
import '../data/local/quiz_cache.dart';
import '../data/repositories/discovery_repository.dart';
import '../data/repositories/enrollment_repository.dart';
import '../data/repositories/quiz_repository.dart';
import '../data/repositories/upload_repository.dart';
import '../ui/screens/auth/login_screen.dart';
import '../ui/screens/course/course_screen.dart';
import '../ui/screens/home/applications_screen.dart';
import '../ui/screens/home/home_shell.dart';
import '../ui/screens/home/my_courses_screen.dart';
import '../ui/screens/home/profile_screen.dart';
import '../ui/screens/institute/institute_screen.dart';
import '../ui/screens/map/map_screen.dart';
import '../ui/screens/quiz/quiz_screen.dart';
import '../ui/screens/registration/pre_registration_screen.dart';

/// Bridges a Bloc stream to `GoRouter`'s `refreshListenable`.
class _BlocRefreshNotifier extends ChangeNotifier {
  _BlocRefreshNotifier(Stream<dynamic> stream) {
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

/// Builds the app router.
///
/// Redirect policy: everything except `/login` requires a session. While the
/// session is still being restored we hold on a splash route so the user never
/// sees a flash of the login screen.
GoRouter buildRouter({
  required AuthBloc authBloc,
  required DiscoveryRepository discoveryRepository,
  required EnrollmentRepository enrollmentRepository,
  required QuizRepository quizRepository,
  required UploadRepository uploadRepository,
  required QuizCache quizCache,
}) {
  return GoRouter(
    initialLocation: '/home',
    refreshListenable: _BlocRefreshNotifier(authBloc.stream),
    redirect: (BuildContext context, GoRouterState state) {
      final AuthStatus status = authBloc.state.status;
      final String location = state.matchedLocation;

      if (status == AuthStatus.unknown) {
        return location == '/splash' ? null : '/splash';
      }

      final bool loggingIn = location == '/login';
      if (status == AuthStatus.unauthenticated) {
        return loggingIn ? null : '/login';
      }

      // Authenticated: bounce away from the login/splash screens.
      if (loggingIn || location == '/splash') return '/home';
      return null;
    },
    routes: <RouteBase>[
      GoRoute(
        path: '/splash',
        builder: (BuildContext context, GoRouterState state) => const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      ),
      GoRoute(
        path: '/login',
        builder: (BuildContext context, GoRouterState state) =>
            const LoginScreen(),
      ),

      // Tabbed shell.
      ShellRoute(
        builder: (BuildContext context, GoRouterState state, Widget child) =>
            HomeShell(location: state.matchedLocation, child: child),
        routes: <RouteBase>[
          GoRoute(
            path: '/home',
            builder: (BuildContext context, GoRouterState state) =>
                const MapScreen(),
          ),
          GoRoute(
            path: '/my-courses',
            builder: (BuildContext context, GoRouterState state) =>
                MyCoursesScreen(repository: enrollmentRepository),
          ),
          GoRoute(
            path: '/applications',
            builder: (BuildContext context, GoRouterState state) =>
                ApplicationsScreen(repository: enrollmentRepository),
          ),
          GoRoute(
            path: '/profile',
            builder: (BuildContext context, GoRouterState state) =>
                const ProfileScreen(),
          ),
        ],
      ),

      GoRoute(
        path: '/institute/:slug',
        builder: (BuildContext context, GoRouterState state) => InstituteScreen(
          slug: state.pathParameters['slug']!,
          repository: discoveryRepository,
        ),
        routes: <RouteBase>[
          GoRoute(
            path: 'register',
            builder: (BuildContext context, GoRouterState state) {
              final String? formId = state.uri.queryParameters['formId'];
              if (formId == null || formId.isEmpty) {
                return const Scaffold(
                  body: Center(
                    child: Text('This institute has no active form.'),
                  ),
                );
              }
              return PreRegistrationScreen(
                formId: formId,
                instituteSlug: state.pathParameters['slug']!,
                courseId: state.uri.queryParameters['courseId'],
                repository: enrollmentRepository,
                uploads: uploadRepository,
              );
            },
          ),
        ],
      ),

      GoRoute(
        path: '/course/:courseId',
        builder: (BuildContext context, GoRouterState state) => CourseScreen(
          courseId: state.pathParameters['courseId']!,
          repository: enrollmentRepository,
          quizzes: quizRepository,
        ),
      ),

      GoRoute(
        path: '/quiz/:quizId',
        builder: (BuildContext context, GoRouterState state) {
          // A dedicated bloc per attempt keeps timers and outbox isolated.
          return BlocProvider<QuizBloc>(
            create: (_) => QuizBloc(
              repository: quizRepository,
              cache: quizCache,
            ),
            child: QuizScreen(quizId: state.pathParameters['quizId']!),
          );
        },
      ),
    ],
    errorBuilder: (BuildContext context, GoRouterState state) => Scaffold(
      appBar: AppBar(),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const Icon(Icons.error_outline, size: 48),
              const SizedBox(height: 12),
              Text('Page not found: ${state.uri}'),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => context.go('/home'),
                child: const Text('Go home'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
