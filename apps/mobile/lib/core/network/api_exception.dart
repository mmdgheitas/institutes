import 'package:dio/dio.dart';

/// A normalized error surfaced to the UI layer.
///
/// The API returns `{ statusCode, message, error }` where `message` may be a
/// string or a list of validation strings; both shapes collapse to [messages].
class ApiException implements Exception {
  ApiException({
    required this.statusCode,
    required this.messages,
    this.isNetworkError = false,
  });

  final int statusCode;
  final List<String> messages;
  final bool isNetworkError;

  /// First message, suitable for a snackbar.
  String get message =>
      messages.isNotEmpty ? messages.first : 'Something went wrong';

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isConflict => statusCode == 409;

  /// Builds an [ApiException] from any Dio failure.
  factory ApiException.fromDio(DioException error) {
    final bool offline = error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout;

    if (offline) {
      return ApiException(
        statusCode: 0,
        messages: const ['No connection to the server. Check your network.'],
        isNetworkError: true,
      );
    }

    final Response<dynamic>? response = error.response;
    final int status = response?.statusCode ?? 0;
    final dynamic data = response?.data;

    if (data is Map) {
      final dynamic raw = data['message'];
      if (raw is List) {
        final List<String> parsed =
            raw.map((dynamic e) => e.toString()).toList(growable: false);
        if (parsed.isNotEmpty) {
          return ApiException(statusCode: status, messages: parsed);
        }
      }
      if (raw is String && raw.isNotEmpty) {
        return ApiException(statusCode: status, messages: <String>[raw]);
      }
    }

    return ApiException(
      statusCode: status,
      messages: <String>[_defaultMessageFor(status)],
    );
  }

  static String _defaultMessageFor(int status) {
    switch (status) {
      case 400:
        return 'The request was rejected. Please check your input.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return 'You do not have permission to do that.';
      case 404:
        return 'We could not find what you were looking for.';
      case 409:
        return 'That conflicts with something that already exists.';
      case 429:
        return 'Too many attempts. Please wait a moment.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  @override
  String toString() => 'ApiException($statusCode): ${messages.join(', ')}';
}
