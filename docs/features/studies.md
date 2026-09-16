<!-- last_verified: 2026-09-16 -->
# Feature: Study Library

## Purpose
Manage the primary entity — a `Study` (one CT/MRI volume and its segmentation
run) — with full create / read / edit / delete / run verbs, scoped to this app's
own `studies/` prefix.

## Used By
- UI: `/studies` (list + "New study" dialog) and `/studies/{study_id}` (detail)
- API: `GET /studies`, `POST /studies`, `GET /studies/{study_id}`,
  `PATCH /studies/{study_id}`, `DELETE /studies/{study_id}`, `GET /studies/sources`
- Job: background segmentation thread (see [Segmentation](segmentation.md))

## Core Functions
- `apps/web/src/components/studies/study-list.tsx` — the library table with row verbs
- `apps/web/src/components/studies/study-form.tsx` — create/edit form (selectors + safe-default hints)
- `apps/web/src/components/studies/study-detail.tsx` — source, status, mask download, stats table
- `apps/web/src/lib/queries.ts` — `useStudies`, `useStudyDetail`, `useStudySources`, create/update/delete/segment mutations
- `services/api/app/runtime/studies.py` — route handlers
- `services/api/app/service/studies.py` — lifecycle logic (validation, staging move, aggregates)
- `services/api/app/repo/studies.py` — B2 record CRUD + object staging/move/delete/presign

## Canonical Files
- Primary-entity CRUD service: `services/api/app/service/studies.py`
- Create/edit form UX: `apps/web/src/components/studies/study-form.tsx`

## Inputs
- study_id: string (create form; alphanumeric with `-` `_` `.`)
- modality: `CT | MRI` (RadioGroup)
- task: `total | total_mr | lung_vessels | body` (Select; default `total` for CT, `total_mr` for MRI)
- fast: boolean (Switch; default on)
- source_key: string (Select, from `GET /studies/sources`)
- description, patient_label: optional strings (patient_label is a non-identifying label only)

## Outputs
- `POST /studies` → `Study` (status `pending`); moves the chosen volume from `uploads/` into `studies/<id>/source/`
- `GET /studies` → `Study[]` (newest first)
- `GET /studies/{id}` → `StudyDetail` (study + presigned source/mask URLs + `StudyStats`)
- `PATCH /studies/{id}` → `Study` (description / patient_label only)
- `DELETE /studies/{id}` → `DeleteStudyResponse`; removes every object under the study prefix
- Side effect: each study is persisted as `studies/<id>/record.json` in B2 — no database

## Flow
- Ingest one or more volumes first (see [Bulk Volume Ingest](file-upload.md)); they land in `uploads/`
- Open `/studies` → "New study" → pick modality/task/fast and a source volume → Create
- The API validates the id, server-side-copies the volume into `studies/<id>/source/`, and writes `record.json` with status `pending`
- On success the dialog closes and the app navigates straight to the new study's detail page — no manual click back into the list to find the row just created
- Open the study → "Segment" starts the run (status → `running`); the page polls until `done`/`failed`
- When more than one study is `pending`, the Studies list also offers "Segment all
  pending", which calls the same per-study `POST /studies/{id}/segment` once per
  pending study, sequentially — a frontend-only convenience, not a batch endpoint.
  It snapshots the pending ids at click time and submits that fixed set exactly
  once each — the list can refetch and shrink mid-run (each segment call still
  invalidates it once, after the whole batch) without dropping a later id. Any id
  that fails to start is reported by name and stays `pending`, so it's still
  visible and retryable from the same button
- Edit metadata or delete the study (and all its objects) from the detail page

## Edge Cases
- Duplicate study_id → 409
- source_key not an ingested `.nii.gz` under `uploads/`, or already claimed → 400/404
- Invalid study_id (slashes, spaces) → 400
- Delete while running → objects are removed; a daemon run thread may still be writing, so delete when a study is not `running`

## UX States
- Empty: "No studies yet — ingest a volume and create one"
- Loading: skeleton rows / detail skeleton
- Error: inline ErrorState with retry
- Loaded: table with status badges; detail with stats table
- Running (detail page): the status badge, the Segment button, and a live
  elapsed-time readout ("Segmenting… 0:34", ticking client-side from when the
  run was first observed — there is no server-side percentage) all flip
  together off the same optimistic signal, instead of the badge lagging the
  button until the next poll

## Verification
- Test files: `services/api/tests/test_studies.py`
- Required cases: create→list→detail round trip, duplicate/bad-source rejection, sources filter, segment returns `running` (never 500)
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Segmentation](segmentation.md)
- [Volumetric Stats](volumetric-stats.md)
- [App Workflows](../app-workflows.md)
