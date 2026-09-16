/**
 * Client-side allow-list for the Bulk Volume Ingest dropzone. This app ingests
 * raw medical-imaging volumes only: compressed NIfTI (`.nii.gz`). It mirrors the
 * backend's `application/gzip` entry in `services/api/app/service/upload.py`
 * (`ALLOWED_TYPES` / `MIME_EXTENSION_MAP` / the gzip magic-byte signature),
 * which re-validates every upload. Keep the two in sync.
 *
 * Shape matches react-dropzone's `accept`: MIME type → matching extensions.
 */
export const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  "application/gzip": [".nii.gz", ".gz"],
};
