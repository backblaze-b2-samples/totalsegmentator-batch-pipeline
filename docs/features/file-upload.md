<!-- last_verified: 2026-09-16 -->
# Feature: Bulk Volume Ingest

## Purpose
Drag-and-drop many NIfTI (`.nii.gz`) volumes straight to Backblaze B2 via
presigned PUTs, staging them for study creation without the bytes ever passing
through the API.

## Used By
- UI: `/upload`
- API: `POST /upload/presign`, `POST /upload/verify`

## Core Functions
- `apps/web/src/components/upload/upload-form.tsx` — the ingest view over the app-wide queue
- `apps/web/src/components/upload/dropzone.tsx` — drag/drop with the NIfTI accept list
- `apps/web/src/lib/upload-file-types.ts` — client accept list (`.nii.gz`, `.nii`)
- `apps/web/src/lib/api-client.ts` — `uploadFile()` (presign → direct B2 PUT → verify), infers the NIfTI content type
- `apps/web/src/lib/upload-queue-context.tsx` — app-wide upload queue
- `services/api/app/service/upload.py` — declared-upload validation, allow-list (now includes `application/gzip`), the `uploads/` staging prefix
- `services/api/app/repo/b2_upload.py` — presigned PUT + post-upload inspection

## Canonical Files
- Upload validation + staging: `services/api/app/service/upload.py`
- Direct-to-B2 transport: `apps/web/src/lib/api-client.ts`

## Inputs
- One or more `.nii.gz` (or `.nii`) volumes, up to 600 MB each (raw CT/MRI is routinely 100–500 MB)

## Outputs
- Each volume stored under `uploads/<filename>` in B2 (the staging prefix)
- `POST /upload/presign` → `PresignUploadResponse` (signed PUT URL + exact headers)
- `POST /upload/verify` → `FileUploadResponse` (size/type/magic-byte checks; gzip signature `1f 8b`)
- Side effect: the object appears in `GET /studies/sources` until a study claims it

## Flow
- Drop volumes → the queue requests a presigned PUT per file (size + content-type signed into the URL)
- The browser PUTs the bytes directly to B2 (XHR, with progress); the API never buffers them, which is what lifts any serverless payload cap
- `verify` HEADs the stored object and range-reads the leading bytes to confirm the gzip signature
- The volume now shows up as an unassigned source in the Study Library's "New study" picker; creating a study moves it into `studies/<id>/source/`

## Edge Cases
- Non-NIfTI type → rejected client-side by the accept list and server-side by the allow-list (415)
- Empty content-type from the browser → `uploadFile` infers `application/gzip` from the `.nii.gz` extension so the signed PUT still matches
- Over the size cap → 413
- Bytes fail the gzip magic-byte check → object deleted, 415

## UX States
- Empty: dropzone prompt
- Loading: per-file progress bars; app-wide in-progress indicator persists across navigation
- Error: per-file error with retry
- Complete: success toast; "Clear finished" to reset the queue

## Verification
- Test files: `services/api/tests/test_upload_validation.py`, `services/api/tests/test_upload_conflict.py`, `services/api/tests/test_upload_activity.py`
- Required cases: allow-list incl. gzip, extension/type consistency, magic-byte signature, staged key under `uploads/`
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [Study Library](studies.md)
- [Bucket Explorer](file-browser.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
