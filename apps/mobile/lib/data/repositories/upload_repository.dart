import 'dart:io';

import '../../core/network/api_client.dart';
import '../models/enums.dart';
import '../models/json_utils.dart';

/// Result of a presign call.
class PresignedUpload {
  const PresignedUpload({
    required this.mediaId,
    required this.uploadUrl,
    required this.objectKey,
    required this.headers,
    required this.maxSizeBytes,
  });

  final String mediaId;
  final String uploadUrl;
  final String objectKey;
  final Map<String, String> headers;
  final int maxSizeBytes;

  factory PresignedUpload.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> rawHeaders = asMap(json['headers']);
    return PresignedUpload(
      mediaId: asString(json['mediaId']),
      uploadUrl: asString(json['uploadUrl']),
      objectKey: asString(json['objectKey']),
      headers: rawHeaders.map(
        (String k, dynamic v) => MapEntry<String, String>(k, asString(v)),
      ),
      maxSizeBytes: asInt(json['maxSizeBytes']),
    );
  }
}

/// Direct-to-S3 uploads. Bytes never pass through the API.
class UploadRepository {
  UploadRepository({required ApiClient api}) : _api = api;

  final ApiClient _api;

  /// Full upload flow: presign → PUT to storage → confirm.
  /// Returns the media id to reference in a form or quiz answer.
  Future<String> uploadFile({
    required File file,
    required String mimeType,
    required MediaKind kind,
    required String purpose,
    String? instituteId,
    String? courseId,
    void Function(double progress)? onProgress,
  }) async {
    final int size = await file.length();
    final String fileName = file.path.split(Platform.pathSeparator).last;

    final PresignedUpload presigned = await presign(
      fileName: fileName,
      mimeType: mimeType,
      sizeBytes: size,
      kind: kind,
      purpose: purpose,
      instituteId: instituteId,
      courseId: courseId,
    );

    final List<int> bytes = await file.readAsBytes();
    await _api.uploadToPresignedUrl(
      uploadUrl: presigned.uploadUrl,
      bytes: bytes,
      headers: presigned.headers,
      onProgress: (int sent, int total) {
        if (total > 0) onProgress?.call(sent / total);
      },
    );

    await confirm(presigned.mediaId);
    return presigned.mediaId;
  }

  Future<PresignedUpload> presign({
    required String fileName,
    required String mimeType,
    required int sizeBytes,
    required MediaKind kind,
    required String purpose,
    String? instituteId,
    String? courseId,
  }) async {
    final dynamic data = await _api.post<dynamic>(
      '/uploads/presign',
      body: <String, dynamic>{
        'fileName': fileName,
        'mimeType': mimeType,
        'sizeBytes': sizeBytes,
        'kind': kind.wire,
        'purpose': purpose,
        if (instituteId != null) 'instituteId': instituteId,
        if (courseId != null) 'courseId': courseId,
      },
    );
    return PresignedUpload.fromJson(asMap(data));
  }

  /// Tells the API the object landed; it verifies existence in the bucket.
  Future<void> confirm(String mediaId) async {
    await _api.post<dynamic>('/uploads/$mediaId/confirm');
  }
}
