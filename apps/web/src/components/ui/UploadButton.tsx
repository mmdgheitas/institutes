'use client';

import { useRef, useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { uploadFile, type UploadPurpose } from '@/lib/upload/upload';
import type { MediaKind } from '@shared/enums';
import { clsx } from 'clsx';

export interface UploadButtonProps {
  purpose: UploadPurpose;
  kind: MediaKind;
  instituteId?: string;
  courseId?: string;
  /** Allowed MIME types for the file picker. */
  accept?: string;
  label?: React.ReactNode;
  onUploaded: (result: { mediaId: string; needsProcessing: boolean; url: string | null }) => void;
  onError?: (message: string) => void;
  className?: string;
  multiple?: boolean;
}

/**
 * Uploads a file through the presign → direct S3 PUT → confirm flow.
 * Shows inline progress while the file is being sent.
 */
export function UploadButton({
  purpose,
  kind,
  instituteId,
  courseId,
  accept,
  label = 'بارگذاری فایل',
  onUploaded,
  onError,
  className,
  multiple = false,
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files).slice(0, multiple ? 10 : 1)) {
      setBusy(true);
      setProgress(0);
      try {
        const result = await uploadFile({
          file,
          kind,
          purpose,
          instituteId,
          courseId,
          onProgress: setProgress,
        });
        onUploaded(result);
      } catch (error) {
        onError?.(error instanceof Error ? error.message : 'خطا در بارگذاری فایل');
      } finally {
        setBusy(false);
        setProgress(0);
        if (inputRef.current) inputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'inline-flex h-10 items-center justify-center gap-2 rounded-control border border-dashed border-primary-400 bg-primary-50 px-4 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-wait disabled:opacity-70',
          className,
        )}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress > 0 ? `${progress}٪` : 'در حال بارگذاری…'}
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4" />
            {label}
          </>
        )}
      </button>
    </>
  );
}
