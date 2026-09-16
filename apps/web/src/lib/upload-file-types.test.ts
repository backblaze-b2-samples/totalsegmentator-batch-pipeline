import { describe, expect, it } from "vitest";

import { ACCEPTED_FILE_TYPES } from "./upload-file-types";

// The backend `ALLOWED_TYPES` set in services/api/app/service/upload.py. This
// app's Bulk Volume Ingest dropzone accepts a strict SUBSET of it — NIfTI
// volumes only (`application/gzip`) — because the ingest page is dedicated to
// raw CT/MRI volumes. The backend still allow-lists the kit's generic types for
// its own upload/verify tests, so the check is subset + presence, not equality.
const BACKEND_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "video/mp4",
  "audio/mpeg",
  "audio/wav",
  "text/markdown",
  "application/yaml",
  "application/x-yaml",
  "application/x-ndjson",
  "text/tab-separated-values",
  "application/xml",
  "text/xml",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/quicktime",
  "video/webm",
  "application/gzip",
];

describe("ACCEPTED_FILE_TYPES", () => {
  it("is a subset of the backend allow-list", () => {
    const backend = new Set(BACKEND_ALLOWED_TYPES);
    for (const type of Object.keys(ACCEPTED_FILE_TYPES)) {
      expect(backend.has(type)).toBe(true);
    }
  });

  it("accepts NIfTI volumes (application/gzip)", () => {
    expect(ACCEPTED_FILE_TYPES["application/gzip"]).toContain(".nii.gz");
  });

  it("maps every type to at least one dot-prefixed extension", () => {
    for (const exts of Object.values(ACCEPTED_FILE_TYPES)) {
      expect(exts.length).toBeGreaterThan(0);
      for (const ext of exts) {
        expect(ext.startsWith(".")).toBe(true);
      }
    }
  });
});
