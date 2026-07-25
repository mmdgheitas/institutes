import 'dart:async';

import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/token_storage.dart';
import 'api_exception.dart';

/// Thin wrapper over Dio that owns authentication.
///
/// Responsibilities:
///  - attach the bearer token to every request
///  - on a 401, refresh the token pair exactly once and replay the request
///  - queue concurrent requests during a refresh so only one refresh happens
///  - notify the app when the session is unrecoverable
class ApiClient {
  ApiClient({required TokenStorage tokenStorage, Dio? dio})
      : _tokenStorage = tokenStorage,
        _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: AppConfig.apiBaseUrl,
                connectTimeout: AppConfig.connectTimeout,
                receiveTimeout: AppConfig.receiveTimeout,
                contentType: Headers.jsonContentType,
                // We inspect status codes ourselves in the error interceptor.
                validateStatus: (int? status) =>
                    status != null && status >= 200 && status < 300,
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: _onRequest,
        onError: _onError,
      ),
    );
  }

  final Dio _dio;
  final TokenStorage _tokenStorage;

  /// Invoked when refreshing fails and the user must sign in again.
  void Function()? onSessionExpired;

  /// De-duplicates concurrent refresh attempts.
  Future<bool>? _refreshOperation;

  Dio get raw => _dio;

  void _onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final String? token = _tokenStorage.accessToken;
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final RequestOptions request = error.requestOptions;
    final bool isAuthCall = request.path.startsWith('/auth/');
    final bool alreadyRetried = request.extra['__retried'] == true;

    // Only a 401 on a non-auth call is recoverable, and only once.
    if (error.response?.statusCode != 401 || isAuthCall || alreadyRetried) {
      handler.next(error);
      return;
    }

    final bool refreshed = await _refreshTokens();
    if (!refreshed) {
      await _tokenStorage.clear();
      onSessionExpired?.call();
      handler.next(error);
      return;
    }

    try {
      request.extra['__retried'] = true;
      final String? token = _tokenStorage.accessToken;
      if (token != null) {
        request.headers['Authorization'] = 'Bearer $token';
      }
      final Response<dynamic> response = await _dio.fetch<dynamic>(request);
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  /// Rotates the token pair. Concurrent callers await the same future.
  Future<bool> _refreshTokens() {
    return _refreshOperation ??= _performRefresh().whenComplete(() {
      _refreshOperation = null;
    });
  }

  Future<bool> _performRefresh() async {
    final String? refreshToken = _tokenStorage.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) return false;

    try {
      // A bare Dio instance: must not recurse through this interceptor.
      final Dio plain = Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl));
      final Response<dynamic> response = await plain.post<dynamic>(
        '/auth/refresh',
        data: <String, dynamic>{'refreshToken': refreshToken},
      );

      final dynamic data = response.data;
      if (data is! Map) return false;

      final String? access = data['accessToken'] as String?;
      final String? refresh = data['refreshToken'] as String?;
      if (access == null || refresh == null) return false;

      await _tokenStorage.save(accessToken: access, refreshToken: refresh);
      return true;
    } on DioException {
      return false;
    }
  }

  /* ------------------------------------------------------------ verbs --- */

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) async {
    return _run<T>(
      () => _dio.get<T>(path, queryParameters: query, cancelToken: cancelToken),
    );
  }

  Future<T> post<T>(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) async {
    return _run<T>(
      () => _dio.post<T>(
        path,
        data: body,
        queryParameters: query,
        cancelToken: cancelToken,
      ),
    );
  }

  Future<T> patch<T>(String path, {Object? body}) async {
    return _run<T>(() => _dio.patch<T>(path, data: body));
  }

  Future<T> delete<T>(String path) async {
    return _run<T>(() => _dio.delete<T>(path));
  }

  Future<T> _run<T>(Future<Response<T>> Function() send) async {
    try {
      final Response<T> response = await send();
      return response.data as T;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  /// Uploads bytes straight to S3 with a presigned URL.
  ///
  /// This deliberately bypasses [_dio] and its auth header: the presigned URL
  /// carries its own signature, and sending a bearer token would break it.
  Future<void> uploadToPresignedUrl({
    required String uploadUrl,
    required List<int> bytes,
    required Map<String, String> headers,
    void Function(int sent, int total)? onProgress,
  }) async {
    try {
      await Dio().put<void>(
        uploadUrl,
        data: Stream<List<int>>.fromIterable(<List<int>>[bytes]),
        options: Options(
          headers: <String, dynamic>{
            ...headers,
            Headers.contentLengthHeader: bytes.length,
          },
        ),
        onSendProgress: onProgress,
      );
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
