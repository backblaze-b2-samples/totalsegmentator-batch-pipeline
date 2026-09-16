<!-- last_verified: 2026-09-16 -->
# Feature: Volumetric Stats

## Purpose
Derive per-structure volumetric statistics from a segmentation mask — volume in
mL, voxel bounding box, and (for CT) Hounsfield intensity stats — and persist
them as a compact JSON artifact alongside the mask in B2.

## Used By
- UI: the stats table on `/studies/{study_id}`
- API: returned inside `GET /studies/{study_id}` as `StudyStats`
- Job: computed during the segmentation background run

## Core Functions
- `services/api/app/repo/nifti_stats.py` — `compute_structure_stats()` (nibabel + NumPy, lazy-imported)
- `services/api/app/repo/segmentation.py` — supplies the TotalSegmentator label→name map and calls the stats function
- `services/api/app/service/studies.py` — reads `stats.json` back into `StudyStats` for the detail response

## Canonical Files
- Volumetrics: `services/api/app/repo/nifti_stats.py`

## Inputs
- mask_path: local NIfTI mask just produced by TotalSegmentator
- source_path: local source volume (for CT Hounsfield sampling)
- label_names: `dict[int, str]` from TotalSegmentator's `class_map[task]`
- modality: `CT | MRI`

## Outputs
- `stats.json` under `studies/<id>/stats.json`, shaped as `StudyStats`:
  - `structures: StructureStat[]` — `label_id`, `name`, `voxel_count`, `volume_ml`, `bbox` (6 ints), `hu_mean?`, `hu_std?`
  - `structure_count`, `total_volume_ml`, `voxel_spacing_mm`

## Flow
- After the mask is written, `compute_structure_stats` loads it with nibabel and reads voxel spacing from the header
- Voxel volume (mm³ → mL) is derived from the header zooms; each non-zero label's voxel count gives its volume
- The voxel bounding box is computed per structure; for CT, mean/std Hounsfield values are sampled from the source inside each structure mask
- Structures are sorted largest-volume-first and written to `stats.json`

## Edge Cases
- Label present in the mask but absent from the class map → `name` falls back to `label_<id>`
- MRI (or a shape mismatch between source and mask) → HU stats are omitted (`null`)
- Empty label → skipped

## UX States
- Loading: stats table skeleton while the run completes
- Empty: "No stats yet — run segmentation"
- Loaded: sortable table of structures with volume and (CT) HU columns

## Verification
- Test files: covered indirectly by `services/api/tests/test_studies.py` (stats round-trip through the detail response) and `test_structure.py` (nibabel/NumPy confined to the engine layer)
- Required cases: stats surfaced on the detail page; imaging deps never imported at boot
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green; real values produced on a host with `requirements-ml.txt`

## Related Docs
- [Segmentation](segmentation.md)
- [Study Library](studies.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
