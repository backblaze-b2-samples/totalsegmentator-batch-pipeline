<!-- last_verified: 2026-09-16 -->
# Feature: Dashboard

## Purpose
Tell the write-amplification story at a glance: how many studies were processed,
how many anatomical structures were segmented, and how the source volumes on B2
compare to the derived masks + stats they produce.

## Used By
- UI: `/` (dashboard home)
- API: `GET /studies/stats`, `GET /studies`

## Core Functions
- `apps/web/src/components/dashboard/segmentation-stats-cards.tsx` — stat cards (studies, structures, source vs derived bytes, amplification ratio)
- `apps/web/src/components/dashboard/amplification-chart.tsx` — source-vs-derived bytes bar chart
- `apps/web/src/components/dashboard/recent-studies-table.tsx` — most recent studies with status
- `apps/web/src/lib/queries.ts` — `useSegmentationStats()`, `useStudies()`
- `services/api/app/runtime/studies.py` — `GET /studies/stats` handler
- `services/api/app/service/studies.py` — `get_segmentation_stats()` aggregate

## Canonical Files
- Dashboard aggregate service: `services/api/app/service/studies.py`
- Headline metric UI: `apps/web/src/components/dashboard/segmentation-stats-cards.tsx`

## Inputs
- None (loads automatically)

## Outputs
- `GET /studies/stats` → `SegmentationStats` (studies_total, studies_done, structures_segmented, source_bytes_total, derived_bytes_total, amplification_ratio)
- `GET /studies` (limit) → `Study[]` for the recent-studies table

## Flow
- Page loads → parallel calls for segmentation stats and the study list
- Cards render: Studies (done / total), Structures segmented, Source bytes, Derived bytes, and the **write-amplification ratio** (derived ÷ source across completed studies)
- The chart contrasts total source bytes with total derived bytes so the amplification is visible, not just a number
- The table lists recent studies with a status badge, linking to each study's detail page

## Edge Cases
- No studies yet → empty cards (zeros) and an empty-state chart/table
- Studies pending/running (not done) → excluded from the byte totals and ratio, so source and derived are always measured on the same completed set
- API unavailable → inline ErrorState with retry

## UX States
- Loading: skeleton cards, chart, and table
- Empty: "No studies processed yet"
- Loaded: populated cards, amplification chart, recent-studies table

## Verification
- Test files: `services/api/tests/test_studies.py` (stats aggregate via the API)
- Required cases: aggregate over done studies; ratio zero when no source bytes
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [Study Library](studies.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
