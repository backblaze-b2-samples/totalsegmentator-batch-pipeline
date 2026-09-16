# Product

## Users

Radiologists, medical-AI researchers, and clinical data teams who need to build a
scalable, segmented imaging dataset. Their context: they have raw 3D CT/MRI
volumes and want a repeatable pipeline that segments anatomy and derives
quantitative statistics at scale, with storage they can trust to hold terabytes
of derived data. Secondary users are developers and AI coding agents adapting the
sample into their own imaging or batch-inference pipeline — they read the repo,
keep the shared B2-backed scaffolding, and extend the segmentation domain.

## Product Purpose

A batch medical-imaging **segmentation pipeline** (Next.js 16 + React 19 +
Tailwind v4 + shadcn/ui frontend, FastAPI backend) with Backblaze B2 as the sole
storage layer. Raw NIfTI (`.nii.gz`) volumes are ingested to B2, **TotalSegmentator
runs locally** on each volume to produce a multi-label mask over 100+ anatomical
structures, per-structure volumetrics (volume in mL, bounding box, CT Hounsfield
stats) are derived as JSON, and mask + stats are written back to a B2 derived
prefix keyed by study. The star of the product is the **write-amplification**
story: each 100–500 MB input volume yields a comparable-size mask plus a stats
JSON, so a PACS-scale archive fills B2 with terabytes of derived data — exercised
over the S3-compatible API with a custom user agent, standard `B2_*` env vars,
and **no second API key** (segmentation is on-device OSS). Success = a team can
ingest volumes, segment them into structured masks + stats on B2, and watch the
source-to-derived amplification grow, all from one working app.

## Maturity and Support Boundary

This is a maintained open-source sample, not a medical device or a hosted service.
It is built with production-minded controls and can be adapted with caution, but
it is **not for clinical diagnosis** and must never be fed real, identifiable
patient data — it has no authentication, tenant isolation, or PHI handling, and
expects synthetic phantoms or de-identified volumes. Adopters own product-specific
validation, security, regulatory/compliance, deployment, and operations.
Repository defects and feature requests go through the public GitHub issue
tracker; B2 account, billing, service, and API questions go through Backblaze
Support. The sample itself is not covered by the Backblaze service level
agreement, and no SLA is provided for the repository software.

## Brand Personality

Confident, precise, quietly professional. Voice is direct and free of hype. The
interface should feel like a modern clinical-data / developer tool — considered,
calm, trustworthy — not a marketing showpiece. Restraint over spectacle: the data
(studies, structures, volumetrics, amplification) is the hero, not the chrome.

## Anti-references

- **Generic AI/SaaS slop.** No gradient text, hero-metric templates, identical
  icon-card grids, tracked uppercase eyebrows, or decorative glassmorphism.
- **Over-branded / loud.** No heavy brand-color drenching, decorative motion, or
  flashy effects. The imaging data carries the interest, not effects.
- **Toy / prototype feel.** No missing states, inconsistent components, or
  placeholder polish. Must read as polished, dependable tooling.
- **Enterprise-drab.** No Bootstrap-era gray boxes or dense-but-lifeless
  admin-panel look. Considered, like modern dev tools (Linear, GitHub Primer,
  Stripe).

## Design Principles

- **Practice what you preach.** The sample must model the engineering quality it
  demonstrates — strict layering, contract-generated seams, tested boundaries.
- **The data is the interface.** Studies, per-structure volumetrics, and the
  source-vs-derived write-amplification metric are surfaced clearly; the UI
  disappears into the task.
- **Earned familiarity over novelty.** Standard, trusted affordances (top bar +
  side nav, command palette, data tables).
- **Every state is designed.** Default, hover, focus, active, disabled, loading
  (skeleton), empty (teaches the interface), and error (says what's wrong +
  offers retry) — plus the segmentation lifecycle (`pending` → `running` →
  `done`/`failed`) shown honestly while a run is in flight.
- **Consistency is the feature.** One button vocabulary, one form-control set, one
  icon style across every screen. Divergence is a bug.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text ≥ 4.5:1, large/bold text ≥ 3:1, visible focus
indicators on every interactive element, full keyboard navigation, correct
semantic landmarks and heading order, labelled form controls, and a
`prefers-reduced-motion` alternative for every animation. Full light and dark
theme parity.
