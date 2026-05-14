/**
 * fileValidation.ts — pure CV file validation helpers.
 *
 * Used by convex/profiles.ts (saveCv mutation) and the security test suite.
 * Extracted so the validation policy can be unit-tested without a Convex ctx.
 */

export const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_CV_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class FileValidationError extends Error {
  readonly code = "VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

/** Throws FileValidationError if the MIME type is not PDF or DOCX. */
export function validateContentType(contentType: string): void {
  if (!ALLOWED_CV_CONTENT_TYPES.has(contentType)) {
    throw new FileValidationError("Only PDF and DOCX files are accepted.");
  }
}

/** Throws FileValidationError if size exceeds MAX_CV_BYTES (10 MB). */
export function validateFileSize(sizeBytes: number): void {
  if (sizeBytes > MAX_CV_BYTES) {
    throw new FileValidationError("File exceeds the 10 MB limit.");
  }
}

/**
 * Combined CV upload validator.
 * Checks content type first, then size.
 */
export function validateCvUpload(sizeBytes: number, contentType: string): void {
  validateContentType(contentType);
  validateFileSize(sizeBytes);
}
