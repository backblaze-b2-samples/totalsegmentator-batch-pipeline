<!-- last_verified: 2026-09-16 -->
# Feature: Segmentation

## Purpose
Run TotalSegmentator locally on a study's source volume to produce a multi-label
mask covering 100+ anatomical structures, and write the mask back to B2 — the
headline capability of this sample, on-device with no external API key.

## Used By
- UI: "Segment" action on `/studies/{study_id}`
- API: `POST /studies/{study_id}/segment`, `GET /studies/{study_id}/mask/download`
- Job: a daemon background thread started by `service.studies.start_segmentation`

## Core Functions
- `services/api/app/repo/segmentation.py` — the ONLY module that imports torch / TotalSegmentator / nnU-Net, all lazily
  - `resolve_device()` — runtime device auto-detect
  - `run_segmentation()` — stream source → run engine → compute stats → upload mask + stats
  - `EngineUnavailableError` — raised when the ML stack is not installed
- `services/api/app/service/studies.py` — `start_segmentation()` and the `_run_segmentation_job` worker
- `services/api/app/repo/studies.py` — `download_to_file`, `upload_local_file`, `put_json`

## Canonical Files
- Engine adapter (contains torch/TotalSegmentator): `services/api/app/repo/segmentation.py`

## Inputs
- study_id: path param
- SegmentRequest: `task?`, `fast?`, `roi_subset?` (optional overrides of create-time choices)
- Source volume: streamed from `studies/<id>/source/<file>.nii.gz`
- `TS_DEVICE` env: `auto | cpu | gpu | mps` (default `auto`)

## Outputs
- `POST /segment` → `Study` (status → `running`), returns immediately
- On completion (background): `studies/<id>/segmentation.nii.gz` (multi-label mask, multipart PUT) and `studies/<id>/stats.json`, and `record.json` updated with `mask_key`, `stats_key`, `structure_count`, `derived_bytes`, status `done`
- On failure (background): status `failed` with an actionable `error`

## Flow
- `POST /segment` sets status `running`, writes the record, and starts a daemon thread; the POST never blocks on inference
- The worker calls `run_segmentation`: `_import_engine()` (lazy), `resolve_device()`, stream the source to a temp file, `totalsegmentator(input, output, ml=True, task, fast, roi_subset, device)`
- Per-structure volumetrics are computed (see [Volumetric Stats](volumetric-stats.md)); mask + stats are uploaded to B2; the record is finalized
- The UI polls `GET /studies/{id}` until status is `done` or `failed`
- **Segmentation is serialized**: `service/studies.py`'s module-level `_SEGMENTATION_LOCK` wraps only the `run_segmentation` call, so at most one engine run executes at a time process-wide. Triggering many studies at once (e.g. "Segment all pending") starts a thread per study, but each queues behind the lock and runs one after another — still each reaching `done`/`failed` — instead of racing concurrently. This avoids torch/nnU-Net multiprocessing contention that can otherwise deadlock/hang a run indefinitely. A study waiting for the lock still shows `running`; there is no separate "queued" state.

## Device selection
- Runtime auto-detect, defaulting to CPU. `auto` → CUDA GPU if `torch.cuda.is_available()`, else CPU. It never issues an unconditional `.cuda()` or asserts on a missing GPU.
- nnU-Net / TotalSegmentator MPS support is weak, so on Apple Silicon `auto` falls back CUDA → CPU; `TS_DEVICE=mps` is an explicit opt-in.

## Edge Cases
- ML stack not installed → `EngineUnavailableError`, run recorded `failed` with the `pip install -r services/api/requirements-ml.txt` remedy; the endpoint returns 200 (`running`), never 500
- Segment while already `running` → 409
- Inference error → run recorded `failed` with the reason; UI shows it
- Large mask → uploaded via multipart `upload_file`, streamed from a temp file (never buffered whole in the API)

## UX States
- Loading: "Segmenting…" status with a spinner while polling
- Error: `failed` badge + the recorded reason
- Loaded: `done` badge, mask download button, stats table

## Verification
- Test files: `services/api/tests/test_studies.py` (engine-unavailable path, device resolution, concurrent-job serialization), `services/api/tests/test_structure.py` (ML containment)
- Required cases: segment returns `running` not 500; engine-absent records `failed` with the install hint; `resolve_device` defaults to CPU; concurrently started jobs never overlap inside `run_segmentation` and each still reaches `done`
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify` (core suite; the ML path runs at runtime, not in verify)
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green; real segmentation exercised on a CUDA/CPU host with `requirements-ml.txt` installed

## Related Docs
- [Study Library](studies.md)
- [Volumetric Stats](volumetric-stats.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
