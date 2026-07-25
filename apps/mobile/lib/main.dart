import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app/router.dart';
import 'blocs/auth/auth_bloc.dart';
import 'blocs/discovery/discovery_bloc.dart';
import 'core/network/api_client.dart';
import 'core/storage/token_storage.dart';
import 'core/theme/app_theme.dart';
import 'data/local/quiz_cache.dart';
import 'data/repositories/auth_repository.dart';
import 'data/repositories/discovery_repository.dart';
import 'data/repositories/enrollment_repository.dart';
import 'data/repositories/quiz_repository.dart';
import 'data/repositories/upload_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Local storage for offline exam state.
  await Hive.initFlutter();
  final QuizCache quizCache = await QuizCache.open();

  final TokenStorage tokenStorage = TokenStorage();
  await tokenStorage.load();

  final ApiClient apiClient = ApiClient(tokenStorage: tokenStorage);

  runApp(
    InstitutesApp(
      apiClient: apiClient,
      tokenStorage: tokenStorage,
      quizCache: quizCache,
    ),
  );
}

class InstitutesApp extends StatefulWidget {
  const InstitutesApp({
    super.key,
    required this.apiClient,
    required this.tokenStorage,
    required this.quizCache,
  });

  final ApiClient apiClient;
  final TokenStorage tokenStorage;
  final QuizCache quizCache;

  @override
  State<InstitutesApp> createState() => _InstitutesAppState();
}

class _InstitutesAppState extends State<InstitutesApp> {
  late final AuthRepository _authRepository;
  late final DiscoveryRepository _discoveryRepository;
  late final EnrollmentRepository _enrollmentRepository;
  late final QuizRepository _quizRepository;
  late final UploadRepository _uploadRepository;

  late final AuthBloc _authBloc;
  late final DiscoveryBloc _discoveryBloc;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();

    _authRepository = AuthRepository(
      api: widget.apiClient,
      tokenStorage: widget.tokenStorage,
    );
    _discoveryRepository = DiscoveryRepository(api: widget.apiClient);
    _enrollmentRepository = EnrollmentRepository(api: widget.apiClient);
    _quizRepository = QuizRepository(api: widget.apiClient);
    _uploadRepository = UploadRepository(api: widget.apiClient);

    _authBloc = AuthBloc(
      repository: _authRepository,
      tokenStorage: widget.tokenStorage,
      quizCache: widget.quizCache,
    )..add(const AuthStarted());

    _discoveryBloc = DiscoveryBloc(repository: _discoveryRepository);

    // A failed token refresh drops the user back to the login screen.
    widget.apiClient.onSessionExpired =
        () => _authBloc.add(const SessionExpired());

    _router = buildRouter(
      authBloc: _authBloc,
      discoveryRepository: _discoveryRepository,
      enrollmentRepository: _enrollmentRepository,
      quizRepository: _quizRepository,
      uploadRepository: _uploadRepository,
      quizCache: widget.quizCache,
    );
  }

  @override
  void dispose() {
    _authBloc.close();
    _discoveryBloc.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: <BlocProvider<dynamic>>[
        BlocProvider<AuthBloc>.value(value: _authBloc),
        BlocProvider<DiscoveryBloc>.value(value: _discoveryBloc),
      ],
      child: MaterialApp.router(
        title: 'Institutes',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        routerConfig: _router,
      ),
    );
  }
}
