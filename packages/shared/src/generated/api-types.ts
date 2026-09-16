// GENERATED FILE — DO NOT EDIT.
//
// Written by `pnpm gen:api` from:
//   docs/api/openapi.json
//
// Hand edits are discarded by the next `pnpm gen:api`. `pnpm gen:check`
// (part of `pnpm verify:web`) fails while this file disagrees with the
// contract. To change what is here, change the FastAPI route or Pydantic
// model and re-run `pnpm contract:export && pnpm gen:api`.

/** Create a study from an already-ingested source volume. */
export interface CreateStudyRequest {
  description?: string | null;
  fast?: boolean;
  modality: string;
  patient_label?: string | null;
  /** Key of an ingested volume from GET /studies/sources. */
  source_key: string;
  study_id: string;
  task: string;
}

/** One day's upload count, for the dashboard activity chart. */
export interface DailyUploadCount {
  date: string;
  uploads: number;
}

/** Acknowledgement that one object was removed from the bucket. */
export interface DeleteFileResponse {
  deleted: boolean;
  key: string;
}

/** Acknowledge deletion of a study and every object under its prefix. */
export interface DeleteStudyResponse {
  deleted: boolean;
  objects_deleted: number;
  study_id: string;
}

/** One stored object as the file list and the by-key metadata route see it. */
export interface FileMetadata {
  content_type: string;
  filename: string;
  folder: string;
  key: string;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
  /**
   * Public object URL, set only when B2_PUBLIC_URL_BASE is configured and
   * the bucket is public. Null otherwise — the UI asks for a presigned URL
   * instead.
   */
  url: string | null;
}

/** Rich metadata recomputed on demand by re-reading the stored object. */
export interface FileMetadataDetail {
  /** Audio/video: bits per second. */
  bitrate: number | null;
  /** Audio/video: codec name. */
  codec: string | null;
  /** Audio/video: duration in seconds. */
  duration_seconds: number | null;
  /**
   * Image-specific: EXIF tags, values stringified. Null for non-images or
   * when no EXIF block was present.
   */
  exif: Record<string, string> | null;
  extension: string;
  filename: string;
  /** Image-specific: pixel height. Null for non-images. */
  image_height: number | null;
  /** Image-specific: pixel width. Null for non-images. */
  image_width: number | null;
  md5: string;
  /**
   * Set when a format-specific extractor was skipped or failed (e.g. an
   * image above Pillow's decompression-bomb limit). The core fields are
   * always exact, so the UI shows this instead of silently dropping the
   * Image / PDF section.
   */
  metadata_warning: string | null;
  mime_type: string;
  /** PDF-specific: author. */
  pdf_author: string | null;
  /** PDF-specific: page count. Null for non-PDFs. */
  pdf_pages: number | null;
  /** PDF-specific: title. */
  pdf_title: string | null;
  sha256: string;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
}

/** The stored object as `POST /upload/verify` reports it back. */
export interface FileUploadResponse {
  content_type: string;
  filename: string;
  key: string;
  /** Rich metadata, when extraction succeeded for this type. */
  metadata: FileMetadataDetail | null;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
  /** Public object URL when the bucket is public, else null. */
  url: string | null;
}

/** A short-lived presigned GET for downloading or previewing one object. */
export interface FileUrlResponse {
  /**
   * Presigned GET URL. Download URLs force an attachment disposition;
   * preview URLs are signed inline so a PDF renders in place.
   */
  url: string;
}

export interface HTTPValidationError {
  detail?: ValidationError[];
}

/**
 * Liveness plus B2 reachability. The route answers HTTP 200 even when B2
 * is unreachable, so a caller must read `b2_connected` rather than
 * trusting the status code.
 */
export interface HealthStatus {
  /** True when the bucket answered a cheap head request. */
  b2_connected: boolean;
  /** "healthy" when B2 answered, else "degraded". */
  status: string;
}

/** What the browser declares before uploading directly to B2. */
export interface PresignUploadRequest {
  content_type: string;
  filename: string;
  size_bytes: number;
}

/**
 * A short-lived presigned PUT the browser uploads to, plus the exact
 * headers it must send. `Content-Length` and `content-type` are signed
 * into the URL, so B2 rejects a body of any other size or type.
 */
export interface PresignUploadResponse {
  content_type: string;
  expires_in: number;
  /**
   * Signed into the URL, so the browser must send them verbatim — B2
   * answers a mismatch with 403.
   */
  headers: Record<string, string>;
  key: string;
  method: string;
  url: string;
}

/**
 * Kick off (or re-run) segmentation, optionally overriding create-time
 * choices.
 */
export interface SegmentRequest {
  fast?: boolean | null;
  /** Limit segmentation to these structure names. */
  roi_subset?: string[] | null;
  task?: string | null;
}

/** Dashboard aggregates — the write-amplification headline metric. */
export interface SegmentationStats {
  /** derived_bytes_total / source_bytes_total across all done studies. */
  amplification_ratio: number;
  derived_bytes_total: number;
  derived_bytes_total_human: string;
  source_bytes_total: number;
  source_bytes_total_human: string;
  structures_segmented: number;
  studies_done: number;
  studies_total: number;
}

/** An ingested-but-unassigned NIfTI volume, offered in the create picker. */
export interface SourceObject {
  filename: string;
  key: string;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
}

/** Volumetrics for one segmented anatomical structure. */
export interface StructureStat {
  /** Voxel bounding box [x_min, x_max, y_min, y_max, z_min, z_max]. */
  bbox: number[];
  /** Mean CT Hounsfield value inside the structure (CT only). */
  hu_mean: number | null;
  /** Std dev of CT Hounsfield values inside the structure (CT only). */
  hu_std: number | null;
  /** Integer label in the multi-label mask. */
  label_id: number;
  /** Structure name from the TotalSegmentator class map. */
  name: string;
  /** Structure volume in millilitres (voxels x voxel volume). */
  volume_ml: number;
  voxel_count: number;
}

/** One CT/MRI study and the state of its segmentation run. */
export interface Study {
  created_at: string;
  /** Mask + stats bytes written back to B2 (the amplified side). */
  derived_bytes: number | null;
  derived_bytes_human: string | null;
  description: string | null;
  /** Failure reason, set only when status is failed. */
  error: string | null;
  /** Ran/will run at 3 mm (fast) rather than full 1.5 mm resolution. */
  fast: boolean;
  /** B2 key of the multi-label mask, once segmentation is done. */
  mask_key: string | null;
  modality: string;
  /** Non-identifying label (e.g. a phantom or cohort code). Never real PHI. */
  patient_label: string | null;
  /** Size of the source volume in bytes. */
  source_bytes: number;
  source_bytes_human: string;
  /** B2 key of the raw source volume under this study's prefix. */
  source_key: string;
  /** B2 key of the per-structure stats JSON, once computed. */
  stats_key: string | null;
  /** pending (created) -> running (segmenting) -> done | failed. */
  status: string;
  /** Number of anatomical structures found in the mask. */
  structure_count: number | null;
  /** Stable identifier; the object-key prefix under studies/. */
  study_id: string;
  task: string;
}

/** A study plus short-lived presigned download URLs and its computed stats. */
export interface StudyDetail {
  /** Presigned GET for the mask, if present. */
  mask_url: string | null;
  /** Presigned GET for the source volume. */
  source_url: string | null;
  stats: StudyStats | null;
  study: Study;
}

/** Per-structure volumetrics plus study-level totals. */
export interface StudyStats {
  structure_count: number;
  structures: StructureStat[];
  total_volume_ml: number;
  /** Voxel size [x, y, z] in mm, from the mask header. */
  voxel_spacing_mm: number[] | null;
}

/** Edit a study's descriptive metadata (create-time fields are read-only). */
export interface UpdateStudyRequest {
  description?: string | null;
  patient_label?: string | null;
}

/** Aggregate bucket figures behind the dashboard stat cards. */
export interface UploadStats {
  total_downloads: number;
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
}

export interface ValidationError {
  ctx?: Record<string, unknown>;
  input?: unknown;
  loc: (string | number)[];
  msg: string;
  type: string;
}

/** Sent after the direct PUT so the API can inspect the stored object. */
export interface VerifyUploadRequest {
  key: string;
}
