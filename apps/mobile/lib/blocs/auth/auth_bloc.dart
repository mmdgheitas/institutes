import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../core/network/api_exception.dart';
import '../../core/storage/token_storage.dart';
import '../../core/validation/form_validator.dart';
import '../../data/local/quiz_cache.dart';
import '../../data/models/session.dart';
import '../../data/repositories/auth_repository.dart';

part 'auth_event.dart';
part 'auth_state.dart';

/// Owns the session for the whole app. Everything else reads from here.
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc({
    required AuthRepository repository,
    required TokenStorage tokenStorage,
    QuizCache? quizCache,
  })  : _repository = repository,
        _tokenStorage = tokenStorage,
        _quizCache = quizCache,
        super(const AuthState()) {
    on<AuthStarted>(_onStarted);
    on<OtpRequested>(_onOtpRequested);
    on<OtpSubmitted>(_onOtpSubmitted);
    on<PasswordLoginSubmitted>(_onPasswordLogin);
    on<RegistrationSubmitted>(_onRegistration);
    on<ProfileUpdated>(_onProfileUpdated);
    on<LogoutRequested>(_onLogout);
    on<SessionExpired>(_onSessionExpired);
    on<AuthErrorCleared>(
      (AuthErrorCleared event, Emitter<AuthState> emit) =>
          emit(state.copyWith(clearError: true)),
    );
    on<OtpFlowReset>(
      (OtpFlowReset event, Emitter<AuthState> emit) =>
          emit(state.copyWith(clearOtp: true, clearError: true, requiresName: false)),
    );
  }

  final AuthRepository _repository;
  final TokenStorage _tokenStorage;
  final QuizCache? _quizCache;

  Future<void> _onStarted(AuthStarted event, Emitter<AuthState> emit) async {
    await _tokenStorage.load();

    if (!_tokenStorage.hasSession) {
      emit(state.copyWith(status: AuthStatus.unauthenticated));
      return;
    }

    try {
      // Validates the stored token; the API client refreshes it if needed.
      final SessionUser user = await _repository.me();
      emit(state.copyWith(status: AuthStatus.authenticated, user: user));
    } on ApiException catch (error) {
      if (error.isNetworkError) {
        // Offline start-up: keep the session and let the app retry later
        // rather than signing the user out because the server is unreachable.
        emit(state.copyWith(status: AuthStatus.authenticated));
        return;
      }
      await _tokenStorage.clear();
      emit(state.copyWith(status: AuthStatus.unauthenticated, clearUser: true));
    }
  }

  Future<void> _onOtpRequested(
    OtpRequested event,
    Emitter<AuthState> emit,
  ) async {
    final String phone = FormValidator.normalizeMobile(event.phone);
    if (!FormValidator.isValidMobile(phone)) {
      emit(state.copyWith(error: 'Enter a valid mobile number (09xxxxxxxxx)'));
      return;
    }

    emit(state.copyWith(isSubmitting: true, clearError: true));
    try {
      final OtpRequestResult result = await _repository.requestOtp(phone);
      emit(state.copyWith(
        isSubmitting: false,
        otpSentTo: phone,
        otpExpiresInSeconds: result.expiresInSeconds,
        devOtpCode: result.devCode,
      ));
    } on ApiException catch (error) {
      emit(state.copyWith(isSubmitting: false, error: error.message));
    }
  }

  Future<void> _onOtpSubmitted(
    OtpSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    final String? phone = state.otpSentTo;
    if (phone == null) {
      emit(state.copyWith(error: 'Request a verification code first'));
      return;
    }

    emit(state.copyWith(isSubmitting: true, clearError: true));
    try {
      final AuthResult result = await _repository.verifyOtp(
        phone: phone,
        code: event.code.trim(),
        fullName: event.fullName,
      );
      emit(state.copyWith(
        status: AuthStatus.authenticated,
        user: result.user,
        isSubmitting: false,
        requiresName: false,
        clearOtp: true,
      ));
    } on ApiException catch (error) {
      // The API asks for a name when the phone has no account yet.
      final bool needsName = error.messages.any(
        (String m) => m.toLowerCase().contains('fullname'),
      );
      emit(state.copyWith(
        isSubmitting: false,
        requiresName: needsName || state.requiresName,
        error: needsName
            ? 'Welcome! Please tell us your name to finish signing up.'
            : error.message,
      ));
    }
  }

  Future<void> _onPasswordLogin(
    PasswordLoginSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(isSubmitting: true, clearError: true));
    try {
      final AuthResult result = await _repository.login(
        phone: FormValidator.normalizeMobile(event.phone),
        password: event.password,
      );
      emit(state.copyWith(
        status: AuthStatus.authenticated,
        user: result.user,
        isSubmitting: false,
      ));
    } on ApiException catch (error) {
      emit(state.copyWith(isSubmitting: false, error: error.message));
    }
  }

  Future<void> _onRegistration(
    RegistrationSubmitted event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(isSubmitting: true, clearError: true));
    try {
      final AuthResult result = await _repository.register(
        phone: FormValidator.normalizeMobile(event.phone),
        fullName: event.fullName,
        password: event.password,
        email: event.email,
      );
      emit(state.copyWith(
        status: AuthStatus.authenticated,
        user: result.user,
        isSubmitting: false,
      ));
    } on ApiException catch (error) {
      emit(state.copyWith(isSubmitting: false, error: error.message));
    }
  }

  Future<void> _onProfileUpdated(
    ProfileUpdated event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(isSubmitting: true, clearError: true));
    try {
      final SessionUser user = await _repository.updateProfile(
        fullName: event.fullName,
        email: event.email,
        avatarUrl: event.avatarUrl,
      );
      emit(state.copyWith(user: user, isSubmitting: false));
    } on ApiException catch (error) {
      emit(state.copyWith(isSubmitting: false, error: error.message));
    }
  }

  Future<void> _onLogout(LogoutRequested event, Emitter<AuthState> emit) async {
    await _repository.logout();
    // Exam data is per-user; never leave it for the next account on the device.
    await _quizCache?.clearAll();
    emit(const AuthState(status: AuthStatus.unauthenticated));
  }

  Future<void> _onSessionExpired(
    SessionExpired event,
    Emitter<AuthState> emit,
  ) async {
    await _tokenStorage.clear();
    emit(const AuthState(
      status: AuthStatus.unauthenticated,
      error: 'Your session expired. Please sign in again.',
    ));
  }
}
