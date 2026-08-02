/**
 * Presigned upload flow: request a presigned URL from the API, PUT the file
 * straight to S3/MinIO, then confirm with the API so metadata is recorded.
 */
import { storage } from '@/lib/api/endpoints';
import { ApiError, NetworkError } from '@/lib/api/errors';
import type { MediaKind } from '@shared/enums';

export type UploadPurpose =
  | 'INSTITUTE_GALLERY'
  | 'INSTITUTE_LOGO'
  | 'COURSE_MATERIAL'
  | 'SUBMISSION_ATTACHMENT'
  | 'QUIZ_ANSWER'
  | 'VERIFICATION_DOCUMENT'
  | 'REVIEW_VIDEO'
  | 'AVATAR';

export interface UploadOptions {
  file: File;
  kind: MediaKind;
  purpose: UploadPurpose;
  instituteId?: string;
  courseId?: string;
  onProgress?: (percent: number) => void;
}

export interface UploadResult {
  mediaId: string;
  needsProcessing: boolean;
  url: string | null;
}

/** PUT the file body to the presigned URL with the required headers. */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  const { file, kind, purpose, instituteId, courseId, onProgress } = options;

  const presigned = await storage.presign({
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    kind,
    purpose,
    instituteId,
    courseId,
  });

  if (file.size > presigned.maxSizeBytes) {
    throw new ApiError(413, {
      statusCode: 413,
      message: `حجم فایل بیشتر از سقف مجاز است (حداکثر ${Math.round(presigned.maxSizeBytes / 1024 / 1024)} مگابایت)`,
    });
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(presigned.method, presigned.uploadUrl);
    for (const [key, value] of Object.entries(presigned.headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError(xhr.status, { statusCode: xhr.status, message: 'بارگذاری فایل ناموفق بود' }));
    };
    xhr.onerror = () => reject(new NetworkError());
    xhr.onabort = () => reject(new Error('بارگذاری لغو شد'));
    xhr.send(file);
  });

  const confirmed = await storage.confirm(presigned.mediaId);
  return {
    mediaId: confirmed.id,
    needsProcessing: confirmed.needsProcessing,
    url: confirmed.url,
  };
}
