"use client";

/**
 * CV upload page
 *
 * Flow:
 *   1. User selects or drops a PDF / DOCX (≤ 10 MB)
 *   2. Client-side validation runs immediately
 *   3. generateUploadUrl mutation → short-lived Convex storage URL
 *   4. File POSTed directly to storage URL
 *   5. saveCv mutation called with the returned storageId
 *   6. Redirect to /feed
 *
 * Guards:
 *   - Not signed in → /login
 */

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_EXTS = [".pdf", ".docx"];

type UploadState =
  | { status: "idle" }
  | { status: "selected"; file: File }
  | { status: "uploading"; file: File; progress: number }
  | { status: "done" }
  | { status: "error"; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Only PDF and DOCX files are accepted.";
  }
  if (file.size > MAX_BYTES) {
    return "File exceeds the 10 MB limit.";
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CvUploadPage() {
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);
  const generateUploadUrl = useMutation(api.profiles.generateUploadUrl);
  const saveCv = useMutation(api.profiles.saveCv);

  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auth guard
  useEffect(() => {
    if (user === undefined) return;
    if (user === null) router.replace("/login");
  }, [user, router]);

  // ---------------------------------------------------------------------------
  // File selection
  // ---------------------------------------------------------------------------

  function selectFile(file: File) {
    const err = validateFile(file);
    if (err) {
      setUploadState({ status: "error", message: err });
      return;
    }
    setUploadState({ status: "selected", file });
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
    // Reset input so the same file can be re-selected after an error
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) selectFile(file);
  }

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  async function handleUpload() {
    if (uploadState.status !== "selected") return;
    const { file } = uploadState;

    setUploadState({ status: "uploading", file, progress: 0 });

    try {
      // 1. Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // 2. POST file directly to Convex storage
      // Using XMLHttpRequest for progress events
      const storageId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (ev) => {
          if (ev.lengthComputable) {
            setUploadState({
              status: "uploading",
              file,
              progress: Math.round((ev.loaded / ev.total) * 100),
            });
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const json = JSON.parse(xhr.responseText) as { storageId: string };
              resolve(json.storageId);
            } catch {
              reject(new Error("Unexpected response from storage."));
            }
          } else {
            reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed — network error.")));
        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      // 3. Save storageId to profile
      await saveCv({ storageId: storageId as Id<"_storage"> });

      setUploadState({ status: "done" });
      router.replace("/feed");
    } catch (err: unknown) {
      setUploadState({
        status: "error",
        message: err instanceof Error ? err.message : "Upload failed. Please try again.",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (user === undefined || user === null) {
    return (
      <main className="min-h-screen bg-[#021e1e] flex items-center justify-center">
        <p className="text-sm text-[#1BAAC1] font-mono">Loading&hellip;</p>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isUploading = uploadState.status === "uploading";
  const isDone = uploadState.status === "done";

  return (
    <main className="min-h-screen bg-[#021e1e] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <p className="font-mono text-[#1BAAC1] uppercase tracking-[4px] text-sm mb-8">
          Tino
        </p>
        <h1 className="text-2xl font-semibold text-white mb-1">Upload your CV</h1>
        <p className="text-sm text-gray-400 mb-8">
          PDF or DOCX, max 10 MB. We use it to personalise your job matches.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && !isDone && inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-none p-10 text-center transition-colors
            ${dragOver
              ? "border-[#1BAAC1] bg-[#1BAAC1]/10"
              : uploadState.status === "selected" || isUploading || isDone
                ? "border-[#1BAAC1]/50 bg-[#0a2828]"
                : "border-white/20 bg-[#0a2828] hover:border-[#1BAAC1]/40 cursor-pointer"
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_EXTS.join(",")}
            onChange={handleInputChange}
            className="sr-only"
            aria-label="Choose CV file"
          />

          {/* Idle / drag */}
          {uploadState.status === "idle" && (
            <>
              <UploadIcon className="mx-auto mb-4 text-[#1BAAC1] opacity-60" />
              <p className="text-sm text-gray-300 mb-1">
                Drag and drop your CV here, or{" "}
                <span className="text-[#1BAAC1] underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs text-gray-500">PDF or DOCX &mdash; max 10 MB</p>
            </>
          )}

          {/* File selected */}
          {uploadState.status === "selected" && (
            <>
              <FileIcon className="mx-auto mb-4 text-[#1BAAC1]" />
              <p className="text-sm text-white font-medium mb-1 truncate px-4">
                {uploadState.file.name}
              </p>
              <p className="text-xs text-gray-500">{formatBytes(uploadState.file.size)}</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setUploadState({ status: "idle" }); }}
                className="mt-3 text-xs text-gray-500 underline underline-offset-2 hover:text-gray-300"
              >
                Choose a different file
              </button>
            </>
          )}

          {/* Uploading */}
          {isUploading && (
            <>
              <FileIcon className="mx-auto mb-4 text-[#1BAAC1]" />
              <p className="text-sm text-white font-medium mb-3 truncate px-4">
                {uploadState.file.name}
              </p>
              {/* Progress bar */}
              <div className="w-full bg-white/10 h-1.5 mb-2">
                <div
                  className="h-1.5 bg-[#1BAAC1] transition-all duration-150"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
              <p className="text-xs font-mono text-[#1BAAC1]">{uploadState.progress}%</p>
            </>
          )}

          {/* Done */}
          {isDone && (
            <>
              <CheckIcon className="mx-auto mb-4 text-[#1BAAC1]" />
              <p className="text-sm text-[#1BAAC1] font-semibold">Uploaded</p>
              <p className="text-xs text-gray-500 mt-1">Redirecting&hellip;</p>
            </>
          )}
        </div>

        {/* Error */}
        {uploadState.status === "error" && (
          <p className="mt-3 text-sm text-red-400">{uploadState.message}</p>
        )}

        {/* Upload button */}
        {uploadState.status === "selected" && (
          <button
            type="button"
            onClick={handleUpload}
            className="mt-6 w-full bg-[#1BAAC1] text-[#0a2828] font-semibold py-3 px-4
                       text-sm uppercase tracking-wider transition-opacity hover:opacity-90"
          >
            Upload CV
          </button>
        )}

        {/* Skip link */}
        {(uploadState.status === "idle" || uploadState.status === "error") && (
          <button
            type="button"
            onClick={() => router.replace("/feed")}
            className="mt-4 w-full text-center text-xs text-gray-500 hover:text-gray-300
                       underline underline-offset-2"
          >
            Skip for now
          </button>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Icons (inline SVG)
// ---------------------------------------------------------------------------

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
