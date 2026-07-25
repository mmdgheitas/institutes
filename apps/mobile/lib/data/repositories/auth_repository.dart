import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';
import '../models/json_utils.dart';
import '../models/session.dart';

class AuthRepository {
  AuthRepository({required ApiClient api, required TokenStorage tokenStorage})
      : _api = api,
        _tokenStorage = tokenStorage;

  final ApiClient _api;
  final TokenStorage _tokenStorage;

  /// Sends an OTP. Returns the dev code when the API is not in production.
  Future<OtpRequestResult> requestOtp(String phone,
      {String purpose = 'LOGIN'}) async {
    final dynamic data = await _api.post<dynamic>(
      '/auth/otp/request',
      body: <String, dynamic>{'phone': phone, 'purpose': purpose},
    );
    return OtpRequestResult.fromJson(asMap(data));
  }

  /// Verifies an OTP and persists the resulting session.
  Future<AuthResult> verifyOtp({
    required String phone,
    required String code,
    String? fullName,
  }) async {
    final dynamic data = await _api.post<dynamic>(
      '/auth/otp/verify',
      body: <String, dynamic>{
        'phone': phone,
        'code': code,
        if (fullName != null && fullName.isNotEmpty) 'fullName': fullName,
      },
    );
    return _persist(AuthResult.fromJson(asMap(data)));
  }

  Future<AuthResult> login({
    required String phone,
    required String password,
  }) async {
    final dynamic data = await _api.post<dynamic>(
      '/auth/login',
      body: <String, dynamic>{'phone': phone, 'password': password},
    );
    return _persist(AuthResult.fromJson(asMap(data)));
  }

  Future<AuthResult> register({
    required String phone,
    required String fullName,
    required String password,
    String? email,
  }) async {
    final dynamic data = await _api.post<dynamic>(
      '/auth/register',
      body: <String, dynamic>{
        'phone': phone,
        'fullName': fullName,
        'password': password,
        if (email != null && email.isNotEmpty) 'email': email,
      },
    );
    return _persist(AuthResult.fromJson(asMap(data)));
  }

  /// Current profile; used on cold start to validate a stored session.
  Future<SessionUser> me() async {
    final dynamic data = await _api.get<dynamic>('/auth/me');
    return SessionUser.fromJson(asMap(data));
  }

  Future<SessionUser> updateProfile({
    String? fullName,
    String? email,
    String? avatarUrl,
  }) async {
    final dynamic data = await _api.patch<dynamic>(
      '/auth/me',
      body: <String, dynamic>{
        if (fullName != null) 'fullName': fullName,
        if (email != null) 'email': email,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      },
    );
    return SessionUser.fromJson(asMap(data));
  }

  /// Revokes the refresh token server-side, then clears local storage.
  Future<void> logout() async {
    final String? refresh = _tokenStorage.refreshToken;
    if (refresh != null && refresh.isNotEmpty) {
      try {
        await _api.post<dynamic>(
          '/auth/logout',
          body: <String, dynamic>{'refreshToken': refresh},
        );
      } catch (_) {
        // Signing out locally must succeed even if the server is unreachable.
      }
    }
    await _tokenStorage.clear();
  }

  Future<AuthResult> _persist(AuthResult result) async {
    await _tokenStorage.save(
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    );
    return result;
  }
}
