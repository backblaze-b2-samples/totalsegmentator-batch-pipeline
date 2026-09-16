# Build plan — `totalsegmentator-batch-pipeline`

Scaffold from `vibe-coding-starter-kit`. Source of truth for starter content:
`.claude/scratch/vcsk-e12e7ca6-c130-44a1-be44-8b46bb4f8b45/`. Build target: `./totalsegmentator-batch-pipeline`.

## 1. Purpose

A batch medical-imaging **segmentation pipeline**: raw 3D CT/MRI volumes (NIfTI
`.nii.gz`) are ingested to a Backblaze B2 source prefix, **TotalSegmentator runs
locally** on each volume to produce a multi-label mask covering 100+ anatomical
structures, per-structure volumetric statistics (volume in mL, bounding box, CT
Hounsfield stats) are derived as JSON, and mask + stats are written back to a B2
derived prefix keyed by study ID. It is for radiologists, medical-AI researchers
and clinical data teams who need to build a scalable imaging dataset. The star of
the sample is the **write-amplification** story — each 100–500 MB input volume
yields a comparable-size mask plus a stats JSON, so a PACS-scale archive fills B2
with TBs of derived data — with **B2 as the sole storage layer**, exercised over
the S3-compatible API with a custom user agent and standard `B2_*` env vars, and
**no second API key** (segmentation is on-device OSS).

## 2. Architecture delta from vibe-coding-starter-kit

The starter kit is the ceiling — strip, don't rebuild. Backend layering
(`types → config → repo → service → runtime`), the generated API/doc seams, the
shadcn UI kit, and all mechanical gates (`pnpm verify`, `check:agent-docs`,
`gen:check`) are kept and respected.

**KEEP (as-is)**
- UI kit `apps/web/src/components/ui/`, design tokens `globals.css`, `/design` page.
- **Bucket Explorer** — `/files`, `apps/web/src/app/files/`, `components/files/`,
  the full-bucket `list_objects_v2` listing and its endpoints. **Non-negotiable
  keep** (per skill: the bucket explorer is never removable).
- **Upload** — `/upload` route + `components/upload/` + presigned-PUT flow,
  repurposed as **Bulk Volume Ingest** (drag-and-drop many `.nii.gz` to the
  source prefix). Sidebar entries for Dashboard/Upload/Files/Settings/Design stay.
- Backend `repo/b2_*.py`, `service/`, `runtime/` files, health/metrics/ratelimit,
  the generic file-detail (`metadata-extraction`) endpoint — it still backs the
  Bucket Explorer's detail view.
- All infra for **Railway**, generators, CI, agent-doc shims.

**TRIM (remove from starter)**
- **Vercel deployment**: remove `vercel.json`, `infra/vercel/`, and the Vercel
  one-click button. Rationale: segmentation runs torch/nnU-Net inference that
  cannot fit or complete inside a Vercel serverless function, so shipping a Vercel
  button would violate the "button deploys the whole app" gate and make a false
  promise. `deployment_targets` becomes `["railway"]` only; primary intended use
  is local `pnpm dev`, Railway is the hosted-demo path (adequate CPU/GPU required).
- **Dashboard** default cards/chart — rewritten (see ADD), not kept verbatim.
- `docs/features/metadata-extraction.md` — delete (off-theme EXIF/PDF doc); the
  generic detail endpoint it described stays but is now documented under the
  Bucket Explorer feature doc.

**ADD (new for this app)**
- **Study Library** (`/studies`) — the **sample-specific asset explorer** scoped
  to this app's own `studies/` prefix (distinct from the kept full-bucket
  explorer). Lists the primary entity (`Study`) with create/edit/delete/run verbs.
- **Study detail** (`/studies/{study_id}`) — source volume, segmentation status,
  presigned mask download, and the per-structure volumetric stats table.
- Backend `repo/segmentation.py` — the **only** place TotalSegmentator + torch are
  imported, and **lazily** (see §4). Wraps: stream source from B2 → run
  TotalSegmentator (`total`/`total_mr` task, `--fast` default) → write mask + stats
  to B2 → update record. Runs in a **background thread**; status tracked in the
  study record (`pending|running|done|failed`); the UI polls study detail.
- Backend `repo/nifti_stats.py` — nibabel + NumPy per-structure volumetrics
  (light deps, core). `service/studies.py`, `runtime/studies.py`, `types/studies.py`.
- Rewritten **Dashboard**: studies processed, structures segmented, total source
  bytes vs total derived bytes, and the **write-amplification ratio** — the
  headline metric — via `list_objects_v2` + `head_object` aggregates.

**B2 key layout** (all under one prefix `studies/`, keyed by study ID):
```
studies/<study_id>/source/<filename>.nii.gz   raw uploaded volume
studies/<study_id>/record.json                the Study record (metadata + status + artifact keys)
studies/<study_id>/segmentation.nii.gz        multi-label mask (large; multipart put)
studies/<study_id>/stats.json                 per-structure volumetric stats
```
`ALLOWED_KEY_PREFIX` = `studies/`.

## 3. B2 surface (S3-compatible only — no b2-native)

All operations go through boto3 in `repo/` with the custom user agent. No b2-native
API anywhere. **Endpoint contract (recorded ONCE here; routers + Pydantic models
implement it, `pnpm gen:api` derives the web seam):**

New/changed routers under `runtime/studies.py`:

| Path | Method | Request model | Response model |
|------|--------|---------------|----------------|
| `/studies` | GET (`?limit`) | — | `list[Study]` |
| `/studies` | POST | `CreateStudyRequest` (study_id, modality, task, fast, source_key, description?, patient_label?) | `Study` |
| `/studies/stats` | GET | — | `SegmentationStats` |
| `/studies/sources` | GET | — | `list[SourceObject]` (unassigned volumes under `…/source/` for the create picker) |
| `/studies/{study_id}` | GET | — | `StudyDetail` |
| `/studies/{study_id}` | PATCH | `UpdateStudyRequest` (description?, patient_label?) | `Study` |
| `/studies/{study_id}` | DELETE | — | `DeleteStudyResponse` |
| `/studies/{study_id}/segment` | POST | `SegmentRequest` (optional overrides: task, fast, roi_subset) | `Study` (status → `running`) |
| `/studies/{study_id}/mask/download` | GET | — | `FileUrlResponse` (reuse) |
| `/studies/{study_id}/source/download` | GET | — | `FileUrlResponse` (reuse) |

Kept, unchanged: the generic `/files*`, `/files/stats*`, upload presign endpoints,
`/health`. Every route change re-exports `docs/api/openapi.json`
(`pnpm contract:export`) and regenerates the seam (`pnpm gen:api`).

**Pydantic models** (`types/studies.py`): `Study` (study_id, modality, task, status,
source_key, mask_key|None, stats_key|None, structure_count|None, source_bytes,
derived_bytes|None, created_at, description|None, patient_label|None),
`StudyDetail` (Study + presigned URLs + `stats: StudyStats|None`),
`StructureStat` (name, label_id, volume_ml, voxel_count, bbox, hu_mean?/hu_std? for CT),
`StudyStats` (list[StructureStat] + totals), `SegmentationStats` (studies_total,
studies_done, structures_segmented, source_bytes_total, derived_bytes_total,
amplification_ratio), `CreateStudyRequest`, `UpdateStudyRequest`, `SegmentRequest`,
`SourceObject`, `DeleteStudyResponse`. `primary_entity.schema` = `Study`.

## 4. Key features

External API provider: **NONE**. The headline capability (segmentation) is
on-device OSS → `deployment: local` for the Segmentation feature. Per
`api-provider-selection.md` hard rule, it **defaults to CPU and auto-detects a GPU**
at runtime: pick first available of **CUDA → Apple MPS → CPU**. Note recorded per
that doc: **nnU-Net/TotalSegmentator MPS support is weak/incomplete**, so on Apple
Silicon this sample falls back **CUDA → CPU** (MPS offered only behind an explicit
opt-in env). No Genblaze (the description names no Genblaze/genblaze-* stack).

Per-feature `deployment`:
- **Segmentation** — `deployment: local`; engine TotalSegmentator (`pip` package,
  wraps nnU-Net/torch); est. cost per demo run **$0** (no external API, B2 only);
  no provider key. Heavy deps (`TotalSegmentator`, `torch`, `nnunetv2`) live in a
  **separate optional `services/api/requirements-ml.txt`**, are **lazy-imported**
  inside `repo/segmentation.py`, and are **NOT** in the core `requirements.lock`,
  so `pnpm verify` / CI stay light and green without them. Demo defaults to
  `--fast` (3 mm) to keep a run to minutes; `roi_subset` supported to trim.
- **Volumetric Stats** — `deployment: local`; nibabel + NumPy (light, core deps).
- **Study Library / Dashboard / Bulk Ingest / Bucket Explorer / Settings** — no
  external deps.

Feature bullets (seed README + `docs/features/*.md` stubs): Study Library,
Segmentation, Volumetric Stats, Dashboard (write amplification), Bulk Volume
Ingest, Bucket Explorer, Settings.

**Primary entity = `Study`.** Lifecycle verbs — **ALL built in the UI**, none
omitted (`omitted_ui_verbs` = []):
- **create** — Study Library "New study" form (see form UX below).
- **read** — Study Library list + Study detail page.
- **edit** — edit descriptive metadata (description, patient_label) from detail.
- **delete** — delete study + every object under its prefix, with confirm.
- **run** — "Segment" action on the detail page → `POST /segment`, background run,
  status polled.

**Form UX conventions** (exemplar: `apps/web/src/components/settings/settings-form.tsx`):
- **Selectors, not free text**, for finite-value fields on BOTH create and edit:
  - `modality` ∈ {CT, MRI} → `RadioGroup`/segmented control.
  - `task` ∈ {`total`, `total_mr`, `lung_vessels`, `body`, …} → `Select`
    (default `total` for CT, `total_mr` for MRI).
  - `fast` (3 mm vs full 1.5 mm) → segmented control / `Switch`.
  - `source_key` → `Select` populated from `GET /studies/sources`.
- **CREATE-form safe-default hints** (placeholder / `FormDescription`, guidance
  only — never an autofill button): `modality=CT`, `task=total`, `fast=on`,
  `study_id=demo-ct-001`, source = the bundled example volume, so a first run is
  sound out of the box.
- **EDIT form** opens pre-filled (only description + patient_label editable); no
  default-hint requirement; modality/task/fast are create-time and read-only there.

**Demo data provenance** (for later screenshot/run steps, recorded now): use
TotalSegmentator's own bundled/official example CT (Apache-2.0) or a synthetic
phantom — **never real/identifiable PACS patient data** (sensitive-content rule).

## 5. Doc transforms

- **New** feature docs: `docs/features/studies.md`, `docs/features/segmentation.md`,
  `docs/features/volumetric-stats.md`.
- **Rewrite**: `docs/features/dashboard.md` (write-amplification + segmentation
  metrics), `docs/features/file-upload.md` (→ Bulk Volume Ingest),
  `docs/features/file-browser.md` (Bucket Explorer; now also documents the generic
  detail endpoint).
- **Keep**: `docs/features/settings.md`.
- **Delete**: `docs/features/metadata-extraction.md`.
- `ARCHITECTURE.md`, `README.md`, `docs/app-workflows.md`, infra runbook mechanical
  regions are regenerated by `pnpm gen:docs` from the manifest below — don't
  hand-edit generated regions.

**Declared identity — `docs/exec-plans/sample.json`** (written into the clone as the
last act of Phase 1, so the builder's copy carries it; authority = the kit's
`scripts/gen/sample.schema.json`). Every field:
- `schema_version` 1
- `name` "TotalSegmentator Batch Pipeline"
- `slug` "totalsegmentator-batch-pipeline"
- `package_scope` "@totalsegmentator-batch-pipeline"
- `purpose` (full sentence, §1)
- `tagline` "Segment 100+ anatomical structures into Backblaze B2 — at PACS scale."
- `primary_entity` { schema "Study", singular "study", plural "studies" }
- `features` (the 7 above)
- `b2_surface` (§3 ops with why)
- `b2_key_prefix` "studies/"
- `stack.web` Next.js 16 / React 19 / Tailwind v4 / shadcn / TanStack Query / Recharts;
  `stack.api` "FastAPI, Python 3.12+, boto3, Pydantic v2, TotalSegmentator, nibabel, NumPy";
  `stack.storage` "Backblaze B2 (S3-compatible API)"; `stack.package_manager` "pnpm workspaces"
- `deployment_targets` ["railway"]
- `env_vars` B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_REGION
  (required), B2_PUBLIC_URL_BASE, NEXT_PUBLIC_API_URL, TS_DEVICE (optional;
  auto|cpu|gpu|mps, default auto)
- `attribution_token` "b2ai-totalsegmentator-batch-pipeline"
- `repo` { org "backblaze-b2-samples", name "totalsegmentator-batch-pipeline" }
- `screenshots` [] (empty — captured by a later pipeline step)

## 6. Rename table

| From (`vibe-coding-starter-kit`) | To |
|---|---|
| Display name `Vibe Coding Starter Kit` | `TotalSegmentator Batch Pipeline` |
| slug `vibe-coding-starter-kit` | `totalsegmentator-batch-pipeline` |
| package scope `@vibe-coding-starter-kit` (`/web`, `/shared`) | `@totalsegmentator-batch-pipeline` |
| attribution token (user_agent_extra + every utm_content) | `b2ai-totalsegmentator-batch-pipeline` |
| `APP_NAME` in `apps/web/src/lib/app-config.ts` | `TotalSegmentator Batch Pipeline` |
| FastAPI `API_TITLE` (derived from APP_NAME) | `TotalSegmentator Batch Pipeline` |
| `localStorage` namespace / CORS rule id (derive from slug) | `totalsegmentator-batch-pipeline` |
| repo `org/name`, clone URL, deploy links | `backblaze-b2-samples/totalsegmentator-batch-pipeline` |
| image tags / workflow slugs / Railway service names | `totalsegmentator-batch-pipeline*` |
| Title-case prose in docs | `TotalSegmentator Batch Pipeline` |

All of the above derive from `sample.json` + `app-config.ts`, so the rename sweep
is driven by those two files plus `pnpm gen:docs`; `pnpm gen:check` catches misses.

## 7. Verification expectation

Builder runs `pnpm run setup` then `pnpm verify` (core, credential-free, no ML
deps) and applies `/b2-doctor` (S3 default, custom user agent on every client,
`B2_*` names). The ML path is exercised at runtime, not during `verify`.
