<!-- last_verified: 2026-08-06 -->
# Architecture

## Components

<!-- gen:begin arch-components -->
A batch medical-imaging pipeline that ingests raw 3D CT/MRI volumes to Backblaze B2, runs TotalSegmentator locally to produce multi-label masks covering 100+ anatomical structures plus per-structure volumetric statistics, and writes the masks and stats back to a B2 derived prefix — building a scalable segmented imaging dataset with B2 as the sole storage layer.

- **apps/web/** — Next.js 16, React 19, Tailwind v4, shadcn/ui, TanStack Query, Recharts
  - Study Library (`/studies`) — browse, create, edit, delete and segment CT/MRI studies
  - Dashboard (`/`) — studies processed, structures segmented, and source-to-derived write amplification
  - Bulk Volume Ingest (`/upload`) — drag-and-drop bulk upload of NIfTI volumes to the B2 source prefix
  - Bucket Explorer (`/files`) — full-bucket browse, preview, download, delete
  - Settings (`/settings`) — theme plus labelled demo preference fields
- **services/api/** — FastAPI, Python 3.12+, boto3, Pydantic v2, TotalSegmentator, nibabel, NumPy
  - REST API for every operation the frontend consumes, exported to `docs/api/openapi.json`
  - Backblaze B2 (S3-compatible API) access isolated in the `repo/` layer
  - Segmentation — run TotalSegmentator locally to produce a 100+ structure multi-label mask
  - Volumetric Stats — per-structure volume (mL), bounding box and CT Hounsfield stats as JSON
  - Structured JSON logging with request tracing, plus `/health` and Prometheus `/metrics`
- **packages/shared/** — TypeScript types generated from the API contract by `pnpm gen:api`, consumed by `apps/web/` as a workspace dependency (pnpm workspaces)
<!-- gen:end arch-components -->

## Backend Layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Authored Python files under `services/api/app/` stay under 300 lines

### Directory Structure

<!-- gen:begin arch-directory -->
```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models, and the response-model base
    config/                Settings loaded from environment
    repo/                  B2 S3 client (data access layer)
    service/               Business logic
    runtime/               FastAPI route handlers
  scripts/                 Operational scripts (OpenAPI export, bucket CORS)
  tests/                   pytest tests (structural + integration)
```
<!-- gen:end arch-directory -->

## Boundary Invariants

- **No external SDK leakage**: `boto3` is only imported in `app/repo/`. All other layers interact with B2 through the repo interface.
- **No raw dicts at boundaries**: All data crossing layer boundaries uses typed Pydantic models.
- **No cross-layer mutable state**: Configuration is read-only after init, and no mutable state is shared *between* layers. Intra-layer caches/counters (the listing cache in `repo/list_cache.py`, the B2 connectivity cache in `repo/b2_client.py`, the download counter in `repo/counter.py`, the rate-limit and metrics state in `runtime/`) are module-local and guarded by a `threading.Lock`. Two kinds of background thread exist: the listing cache's stale-while-revalidate re-scan (warmed once by `main.lifespan`), and a per-run **segmentation worker** thread started by `service/studies.py` — the study's status/state is the durable coordination point (persisted in B2 as `record.json`), so no in-process mutable state is shared. A daemon segmentation thread can be lost on shutdown mid-run; a production deployment would move it to a task queue.
- **Engine containment**: torch / TotalSegmentator / nnU-Net / nibabel are imported only in `repo/segmentation.py` and `repo/nifti_stats.py`, lazily, and a structural test (`tests/test_structure.py`) enforces it — so the core install and `pnpm verify` never load the ML stack.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic. File keys reject empty and path-traversal patterns; `study_id` is validated to a safe slug; optional prefix confinement via `ALLOWED_KEY_PREFIX` (off by default so the full-bucket Explorer works).

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`
  - Web: `localhost:3000`
  - API: `localhost:8000`
- **Railway** — the hosted-demo path. Two services from the same repository:
  `web` builds from the repository root because it consumes `packages/shared`;
  `api` builds from `services/api`. Each service's versioned config sits at its
  own root — `railway.json` and `services/api/railway.json` — the default path
  Railway discovers. The `api` service must additionally install the ML extension
  (`services/api/requirements-ml.txt`) on a plan with enough CPU/GPU and memory
  to run TotalSegmentator. The human-approved staging/production contract lives
  in [infra/railway/README.md](infra/railway/README.md).
- **Not Vercel** — `deployment_targets` is `["railway"]` and the README ships no
  Vercel button. Segmentation runs PyTorch/nnU-Net inference that cannot fit or
  complete inside a serverless function, so a Vercel one-click deploy would break
  the "the button deploys the whole app" promise. The kit's Vercel entrypoint
  scaffolding (`vercel.json`, `services/api/index.py`) is left inert but is not a
  supported deploy target for this app.

External provisioning and deployment remain explicit user-approved actions.

## Data Stores

<!-- gen:begin arch-data-stores -->
- **Backblaze B2 (S3-compatible API)** — the only data store; there is no application database
  - Every object this app writes lives under the `studies/` key prefix of one bucket
  - Listing, per-key metadata and presigned URLs all come from the S3 surface below
  - The primary entity is `Study`; one study is one object
<!-- gen:end arch-data-stores -->

## External Services

<!-- gen:begin arch-external-services -->
- **Backblaze B2 (S3-compatible API)** — reached only through `services/api/app/repo/`, using:
  - `presigned PUT` — the browser bulk-uploads large source volumes directly to B2 (source prefix), bypassing the Function payload cap
  - `put_object` — write the study record.json and the derived stats.json, and (multipart) the segmentation mask .nii.gz
  - `list_objects_v2` — the Study Library, the source-volume picker, and the dashboard write-amplification aggregates
  - `head_object` — cheap per-object sizes for the amplification metric, and the /health connectivity probe
  - `get_object` — stream the source volume to a local temp file for segmentation, and read the record and stats JSON
  - `presigned GET` — download and inline-view the mask, source volume, and stats
  - `delete_object` — remove every object under a study's prefix on delete
<!-- gen:end arch-external-services -->

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins. `CORSMiddleware` is registered LAST in `main.py` (outermost) so it wraps **every** response, including uncaught-exception 500s — otherwise the browser would block error responses and the UI would only see an opaque "network error". See [docs/RELIABILITY.md](docs/RELIABILITY.md#error-handling). A per-IP rate-limit middleware sits inner to CORS; see [docs/SECURITY.md](docs/SECURITY.md#rate-limiting).
- **API -> B2** — authenticated via application keys, signature v4
- **Client -> B2** — presigned URLs for download (10-min expiry, forced attachment)

## Data Flows

- **Ingest**: Browser -> `POST /upload/presign` (API validates the declared volume + signs a PUT) -> Browser PUTs bytes **directly to B2** into `uploads/` -> `POST /upload/verify` (API HEADs + gzip-sniffs the stored object) -> the volume is an unassigned source
- **Create study**: Browser -> `POST /studies` -> service validates the id, server-side-moves the volume from `uploads/` into `studies/<id>/source/`, and writes `studies/<id>/record.json` (status `pending`)
- **Segment**: Browser -> `POST /studies/{id}/segment` -> service sets status `running`, returns immediately, and starts a worker thread -> `repo/segmentation.py` streams the source to a temp file, runs TotalSegmentator (`ml=True`), computes volumetrics (`repo/nifti_stats.py`), uploads `segmentation.nii.gz` (multipart) + `stats.json`, and finalizes the record (`done`/`failed`). The UI polls `GET /studies/{id}` while `running`
- **Dashboard**: Browser -> `GET /studies/stats` -> service aggregates records into source vs derived byte totals and the write-amplification ratio
- **Explorer**: Browser -> `GET /files` / `GET /files/{key}/download` / `DELETE /files/{key}` -> service validates the key -> repo lists / presigns / deletes across the full bucket

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (logs duration per request; also the catch-all that converts uncaught exceptions to a typed JSON 500)
- `/metrics` endpoint (Prometheus format: request count, latency, upload count)
- `/health` endpoint (B2 connectivity check)

## API Contract

<!-- gen:begin arch-api-contract -->
- Checked-in OpenAPI artifact: `docs/api/openapi.json`
- Export / check: `pnpm contract:export` / `pnpm contract:check`
- Generate the client seam from it: `pnpm gen:api` (drift gate: `pnpm gen:check`)
- FastAPI freshness test: `services/api/tests/test_openapi_contract.py`
- Frontend route drift test: `apps/web/src/lib/api-contract.test.ts`

The FastAPI routers and Pydantic models are the single source of truth. The
frontend's `API_CLIENT_ROUTES` registry, the `qk` query-key factory and the
shared TypeScript types are **generated** from the exported artifact by
`pnpm gen:api`, so the client cannot drift from the backend — there is no
hand-written copy left to disagree. The two contract tests are kept as a
belt-and-braces check that the generated files and the committed artifact are
still in step.

| Route | Returns | Generated client route |
| --- | --- | --- |
| `DELETE /files-by-key` | `DeleteFileResponse` | `fileByKeyDelete` |
| `DELETE /files/{key}` | `DeleteFileResponse` | `legacyFileDelete` |
| `DELETE /studies/{study_id}` | `DeleteStudyResponse` | `studyDelete` |
| `GET /files` | `FileMetadata[]` | `files` |
| `GET /files-by-key/detail` | `FileMetadataDetail` | `fileByKeyDetail` |
| `GET /files-by-key/download` | `FileUrlResponse` | `fileByKeyDownload` |
| `GET /files-by-key/metadata` | `FileMetadata` | `fileByKeyMetadata` |
| `GET /files-by-key/preview` | `FileUrlResponse` | `fileByKeyPreview` |
| `GET /files/{key}` | `FileMetadata` | `legacyFileMetadata` |
| `GET /files/{key}/download` | `FileUrlResponse` | `legacyFileDownload` |
| `GET /files/{key}/preview` | `FileUrlResponse` | `legacyFilePreview` |
| `GET /files/stats` | `UploadStats` | `fileStats` |
| `GET /files/stats/activity` | `DailyUploadCount[]` | `uploadActivity` |
| `GET /health` | `HealthStatus` | `health` |
| `GET /metrics` | — | _server-only_ |
| `GET /studies` | `Study[]` | `studies` |
| `GET /studies/{study_id}` | `StudyDetail` | `study` |
| `GET /studies/{study_id}/mask/download` | `FileUrlResponse` | `studyMaskDownload` |
| `GET /studies/{study_id}/source/download` | `FileUrlResponse` | `studySourceDownload` |
| `GET /studies/sources` | `SourceObject[]` | `studySources` |
| `GET /studies/stats` | `SegmentationStats` | `studySegmentationStats` |
| `PATCH /studies/{study_id}` | `Study` | `studyUpdate` |
| `POST /studies` | `Study` | `studyCreate` |
| `POST /studies/{study_id}/segment` | `Study` | `studySegment` |
| `POST /upload/presign` | `PresignUploadResponse` | `uploadPresign` |
| `POST /upload/verify` | `FileUploadResponse` | `uploadVerify` |
<!-- gen:end arch-api-contract -->

## Canonical Files

<!-- gen:begin arch-canonical-files -->
Hand-written — this is the file to edit:

- Layered API handler: `services/api/app/runtime/`
- Service orchestration: `services/api/app/service/`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py`
- Pydantic models: `services/api/app/types/` (`base.py` carries the response-model config)
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- OpenAPI exporter: `services/api/scripts/export_openapi.py`
- Frontend API client — error policy, transport, fallback: `apps/web/src/lib/api-client.ts`
- Frontend data layer — caching, invalidation, polling: `apps/web/src/lib/queries.ts`
- Shared type barrel: `packages/shared/src/types.ts`
- Generator policy: `scripts/gen/api-gen.config.json`
- Sample manifest behind the generated docs: `docs/exec-plans/sample.json`

Generated — **never hand-edit**; change the source and re-run the command:

- `docs/api/openapi.json` — `pnpm contract:export` (source: the routers and models)
- `packages/shared/src/generated/api-types.ts` — `pnpm gen:api`
- `apps/web/src/lib/generated/api-routes.ts` — `pnpm gen:api`
- `apps/web/src/lib/generated/query-keys.ts` — `pnpm gen:api`
- The marker-delimited regions of this file, `AGENTS.md`, `README.md` and the 1 `infra/` runbooks — `pnpm gen:docs`
<!-- gen:end arch-canonical-files -->

## Core Features

<!-- gen:begin arch-core-features -->
- [Study Library](docs/features/studies.md) — browse, create, edit, delete and segment CT/MRI studies
- [Segmentation](docs/features/segmentation.md) — run TotalSegmentator locally to produce a 100+ structure multi-label mask
- [Volumetric Stats](docs/features/volumetric-stats.md) — per-structure volume (mL), bounding box and CT Hounsfield stats as JSON
- [Dashboard](docs/features/dashboard.md) — studies processed, structures segmented, and source-to-derived write amplification
- [Bulk Volume Ingest](docs/features/file-upload.md) — drag-and-drop bulk upload of NIfTI volumes to the B2 source prefix
- [Bucket Explorer](docs/features/file-browser.md) — full-bucket browse, preview, download, delete
- [Settings](docs/features/settings.md) — theme plus labelled demo preference fields
<!-- gen:end arch-core-features -->

## References

<!-- gen:begin arch-references -->
- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
- [infra/railway/README.md](infra/railway/README.md) — Railway delivery contract
<!-- gen:end arch-references -->
