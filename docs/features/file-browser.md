<!-- last_verified: 2026-09-16 -->
# Feature: Bucket Explorer

## Purpose
Browse, preview, download and delete every object in the bucket — the
non-negotiable full-bucket view that sits alongside the study-scoped Library, so
you can see the raw `studies/<id>/…` objects (records, source volumes, masks,
stats) exactly as they land in B2.

## Used By
- UI: `/files`
- API: `GET /files`, `GET /files/stats`, the `/files-by-key/*` routes, and the legacy `/files/{key}` routes

## Core Functions
- `apps/web/src/components/files/file-browser.tsx` — tree/list browser
- `apps/web/src/components/files/file-preview.tsx`, `file-preview-media.tsx` — preview modal
- `apps/web/src/components/files/file-metadata-panel.tsx` — the on-demand rich-metadata panel
- `apps/web/src/lib/api-client.ts` — `getFiles`, `getFileDetail`, `getDownloadUrl`, `getPreviewUrl`, `deleteFile`
- `services/api/app/runtime/files.py` — file routes, incl. the generic detail endpoint
- `services/api/app/service/files.py` — listing, key validation, on-demand detail extraction
- `services/api/app/repo/b2_client.py` — `list_files`, `get_file_metadata`, `get_presigned_url`, `delete_file`

## Generic file-detail endpoint
`GET /files-by-key/detail` recomputes rich metadata on demand by downloading the
object and re-running extraction (checksums, and image/PDF fields where they
apply). It is the generic detail view behind the Bucket Explorer's preview panel;
it is billed at the tighter write rate-limit tier because it downloads the object,
and it refuses objects above `MAX_FILE_SIZE`. It is format-agnostic, so it works
on any object in the bucket, not just this app's artifacts.

## Canonical Files
- Listing + key validation: `services/api/app/service/files.py`
- Full-bucket data access: `services/api/app/repo/b2_client.py`

## Inputs
- prefix, limit (list); object key (by-key routes)

## Outputs
- `GET /files` → `FileMetadata[]`
- `GET /files-by-key/metadata` → `FileMetadata`
- `GET /files-by-key/detail` → `FileMetadataDetail`
- `GET /files-by-key/download|preview` → `FileUrlResponse` (presigned GET; download counts, preview does not)
- `DELETE /files-by-key` → `DeleteFileResponse`

## Flow
- `/files` lists the whole bucket from a shared, cached listing (also used by the dashboard)
- Click an object → preview modal; expand "Detailed metadata" → `GET /files-by-key/detail`
- Download issues a presigned attachment URL; delete removes the object and invalidates the listing cache
- The delete confirmation names the full object key, not just the filename — the same filename recurs under many studies' `source/` prefixes

## Edge Cases
- Path-traversal / dangerous keys → 400
- Missing object → 404
- Object above `MAX_FILE_SIZE` for detail → 413
- Bucket changed elsewhere → listing can lag up to `LIST_CACHE_TTL_SECONDS`; this app's own writes invalidate the cache

## UX States
- Empty: "No files"
- Loading: skeleton rows / loading notice during the cold bucket scan
- Error: inline ErrorState with retry
- Loaded: tree/list with preview, download, delete

## Verification
- Test files: `services/api/tests/test_file_detail.py`, `services/api/tests/test_file_key_routes.py`, `services/api/tests/test_key_prefix.py`, `services/api/tests/test_list_pagination.py`
- Required cases: list/paginate, by-key metadata/detail/download/preview/delete, key validation
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [Bulk Volume Ingest](file-upload.md)
- [Study Library](studies.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
