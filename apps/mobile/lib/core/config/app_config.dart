/// Build-time configuration.
///
/// Override per environment without touching code:
///   flutter run --dart-define=API_BASE_URL=https://api.example.com/api/v1
class AppConfig {
  const AppConfig._();

  /// Base URL of the NestJS API, including the global prefix.
  ///
  /// 10.0.2.2 is the host loopback as seen from the Android emulator; use
  /// localhost for iOS simulator / desktop via --dart-define.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );

  /// Socket.IO endpoint (namespace is appended by the client).
  static const String realtimeUrl = String.fromEnvironment(
    'REALTIME_URL',
    defaultValue: 'http://10.0.2.2:4000',
  );

  /// Raster tile template. Any XYZ provider works (OSM, Neshan, Mapbox raster).
  static const String tileUrlTemplate = String.fromEnvironment(
    'TILE_URL',
    defaultValue: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  );

  /// Sent as the User-Agent for tile requests, as OSM policy requires.
  static const String tileUserAgent = 'com.institutes.app';

  /// Map camera defaults (Tehran).
  static const double defaultLat = 35.7219;
  static const double defaultLng = 51.3347;
  static const double defaultZoom = 13.0;
  static const double minZoom = 4.0;
  static const double maxZoom = 18.0;

  /// Default discovery radius in meters.
  static const int defaultRadiusMeters = 5000;

  /// How often a live quiz attempt flushes buffered answers to the server.
  static const Duration quizSyncInterval = Duration(seconds: 15);

  /// Network timeouts.
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
