import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the JWT pair in the platform keystore/keychain.
///
/// Tokens are cached in memory after the first read so the hot path of every
/// request does not hit platform channels.
class TokenStorage {
  TokenStorage({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  final FlutterSecureStorage _storage;

  static const String _accessKey = 'access_token';
  static const String _refreshKey = 'refresh_token';

  String? _accessToken;
  String? _refreshToken;
  bool _loaded = false;

  /// Reads both tokens into memory. Safe to call more than once.
  Future<void> load() async {
    if (_loaded) return;
    _accessToken = await _storage.read(key: _accessKey);
    _refreshToken = await _storage.read(key: _refreshKey);
    _loaded = true;
  }

  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  bool get hasSession => (_refreshToken ?? '').isNotEmpty;

  Future<void> save({
    required String accessToken,
    required String refreshToken,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    _loaded = true;
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
  }

  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
    _loaded = true;
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
