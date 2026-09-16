<!-- last_verified: 2026-09-16 -->
# App Workflows

User journeys inside the application.

## Manage Studies

- User navigates to `/studies` — the study-scoped Library (distinct from the full-bucket Explorer)
- The table lists every `Study` newest-first with a status badge (`pending` / `running` / `done` / `failed`)
- **New study**: a dialog opens with selectors, not free text — modality (CT/MRI radio), task (Select, defaulting to `total` for CT and `total_mr` for MRI), a fast/full switch, and a source-volume Select populated from ingested volumes. The create form carries safe-default hints (CT, `total`, fast on, `study_id=demo-ct-001`, the bundled example volume) so a first run is sound out of the box
- On create, the chosen volume is server-side-moved from `uploads/` into `studies/<id>/source/` and the study is persisted as `record.json` in B2
- Opening a study shows its source, status, per-structure stats and a mask download; **Edit** changes description/patient-label only (modality/task/fast are create-time and read-only), and **Delete** removes the study and every object under its prefix after a confirm
- Empty state: "No studies yet — ingest a volume and create one"
- See: [Study Library](features/studies.md)

## View Dashboard

- User navigates to `/` (home)
- Two parallel API calls load: the segmentation aggregate (`GET /studies/stats`) and the recent study list
- Stat cards show studies processed (done / total), structures segmented, total source bytes, total derived bytes, and the headline **write-amplification ratio** (derived ÷ source across completed studies)
- A chart contrasts total source bytes with total derived bytes so the amplification — each source volume yielding a comparable-size mask plus stats — is visible, not just a number
- A recent-studies table links each row to its detail page
- Empty state: zeros and "No studies processed yet"
- See: [Dashboard](features/dashboard.md)

## Ingest Volumes

- User navigates to `/upload` — Bulk Volume Ingest
- Drops or selects one or more NIfTI `.nii.gz` volumes (raw CT/MRI, up to 600 MB each)
- Each file uploads **directly from the browser to B2** via a presigned PUT (size and content-type signed into the URL); the bytes never pass through the API. A progress bar tracks the browser→B2 leg, then a "Verifying upload…" phase runs while the API HEADs the object and confirms the gzip magic bytes
- Uploaded volumes land in the `uploads/` staging prefix and immediately appear as unassigned sources in the Study Library's "New study" picker
- The queue is app-wide: navigating away keeps uploads running and the duplicate guard armed; a mid-upload reload is confirmed first
- On success: a toast and a path through to create a study from the volume
- See: [Bulk Volume Ingest](features/file-upload.md)

## Browse the Bucket

- User navigates to `/files` — the non-negotiable full-bucket Explorer that sits alongside the study-scoped Library
- The tree lists the 100 most recent objects (with an on-screen notice while the cold bucket scan runs), so you can see the raw `studies/<id>/…` objects exactly as they land — records, source volumes, masks and stats
- Clicking an object opens a preview with an on-demand rich-metadata panel (checksums, and image/PDF fields where they apply) computed by the generic detail endpoint
- Per-row actions (preview / download / delete) are always visible; download issues a presigned attachment URL, delete removes the object and reconciles the listing
- Empty bucket shows "No files found"
- See: [Bucket Explorer](features/file-browser.md)

## Change Preferences

- User navigates to `/settings`
- A banner at the top states that the page is mostly a demonstration: only Theme is wired up for real, the rest showcases what a settings page can look like when you adapt the kit
- **Theme** (real): editing it and saving applies it immediately and persists it (`next-themes`), and the header's theme toggle drives the same state
- **Profile and preference fields** (demo): labelled "Demo field", persisted to `localStorage` only, driving no behaviour — there is no account system, mailer, quota banner, or activity log behind them yet
- Saving reports honestly, separating the real theme change from the locally-stored demo values, and never claims a save that did not happen
- See: [Settings](features/settings.md)
