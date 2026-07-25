part of 'auth_bloc.dart';

sealed class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => <Object?>[];
}

/// Fired on start-up: validates any stored session.
class AuthStarted extends AuthEvent {
  const AuthStarted();
}

class OtpRequested extends AuthEvent {
  const OtpRequested(this.phone);

  final String phone;

  @override
  List<Object?> get props => <Object?>[phone];
}

class OtpSubmitted extends AuthEvent {
  const OtpSubmitted({required this.code, this.fullName});

  final String code;
  final String? fullName;

  @override
  List<Object?> get props => <Object?>[code, fullName];
}

class PasswordLoginSubmitted extends AuthEvent {
  const PasswordLoginSubmitted({required this.phone, required this.password});

  final String phone;
  final String password;

  @override
  List<Object?> get props => <Object?>[phone, password];
}

class RegistrationSubmitted extends AuthEvent {
  const RegistrationSubmitted({
    required this.phone,
    required this.fullName,
    required this.password,
    this.email,
  });

  final String phone;
  final String fullName;
  final String password;
  final String? email;

  @override
  List<Object?> get props => <Object?>[phone, fullName, password, email];
}

class ProfileUpdated extends AuthEvent {
  const ProfileUpdated({this.fullName, this.email, this.avatarUrl});

  final String? fullName;
  final String? email;
  final String? avatarUrl;

  @override
  List<Object?> get props => <Object?>[fullName, email, avatarUrl];
}

class LogoutRequested extends AuthEvent {
  const LogoutRequested();
}

/// Raised by the API client when refreshing fails.
class SessionExpired extends AuthEvent {
  const SessionExpired();
}

class AuthErrorCleared extends AuthEvent {
  const AuthErrorCleared();
}

/// Returns to the phone-entry step from the code-entry step.
class OtpFlowReset extends AuthEvent {
  const OtpFlowReset();
}
