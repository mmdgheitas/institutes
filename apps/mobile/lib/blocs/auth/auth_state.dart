part of 'auth_bloc.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.isSubmitting = false,
    this.error,
    this.otpSentTo,
    this.otpExpiresInSeconds,
    this.devOtpCode,
    this.requiresName = false,
  });

  final AuthStatus status;
  final SessionUser? user;
  final bool isSubmitting;
  final String? error;

  /// Phone the OTP was sent to; drives the code-entry screen.
  final String? otpSentTo;
  final int? otpExpiresInSeconds;

  /// Only populated when the API runs outside production.
  final String? devOtpCode;

  /// The phone has no account yet, so a name is required to finish sign-up.
  final bool requiresName;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isStaff => user?.canManageInstitute ?? false;

  AuthState copyWith({
    AuthStatus? status,
    SessionUser? user,
    bool? isSubmitting,
    String? error,
    String? otpSentTo,
    int? otpExpiresInSeconds,
    String? devOtpCode,
    bool? requiresName,
    bool clearError = false,
    bool clearUser = false,
    bool clearOtp = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: clearUser ? null : (user ?? this.user),
      isSubmitting: isSubmitting ?? this.isSubmitting,
      error: clearError ? null : (error ?? this.error),
      otpSentTo: clearOtp ? null : (otpSentTo ?? this.otpSentTo),
      otpExpiresInSeconds:
          clearOtp ? null : (otpExpiresInSeconds ?? this.otpExpiresInSeconds),
      devOtpCode: clearOtp ? null : (devOtpCode ?? this.devOtpCode),
      requiresName: requiresName ?? this.requiresName,
    );
  }

  @override
  List<Object?> get props => <Object?>[
        status,
        user,
        isSubmitting,
        error,
        otpSentTo,
        devOtpCode,
        requiresName,
      ];
}
