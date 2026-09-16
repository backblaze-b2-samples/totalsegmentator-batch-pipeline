<!-- last_verified: 2026-08-12 -->
<!-- gen:begin readme-header -->
# TotalSegmentator Batch Pipeline

Segment 100+ anatomical structures into Backblaze B2 — at PACS scale. A batch medical-imaging pipeline that ingests raw 3D CT/MRI volumes to Backblaze B2, runs TotalSegmentator locally to produce multi-label masks covering 100+ anatomical structures plus per-structure volumetric statistics, and writes the masks and stats back to a B2 derived prefix — building a scalable segmented imaging dataset with B2 as the sole storage layer.

Built for developers and AI coding agents: the scaffolding, the storage
wiring and the agent-facing docs are already done, so you start on your
app's own features instead of rebuilding the same shell. Storage is
**[Backblaze B2](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-totalsegmentator-batch-pipeline)**, integrated through the S3-compatible API.

**What you get out of the box:**
- Full-stack dashboard UI (Next.js 16, React 19, Tailwind v4, shadcn/ui, TanStack Query, Recharts)
- Study Library — browse, create, edit, delete and segment CT/MRI studies
- Segmentation — run TotalSegmentator locally to produce a 100+ structure multi-label mask
- Volumetric Stats — per-structure volume (mL), bounding box and CT Hounsfield stats as JSON
- Dashboard — studies processed, structures segmented, and source-to-derived write amplification
- Bulk Volume Ingest — drag-and-drop bulk upload of NIfTI volumes to the B2 source prefix
- Bucket Explorer — full-bucket browse, preview, download, delete
- Settings — theme plus labelled demo preference fields
- Backend with a strict layered architecture and structural tests (FastAPI, Python 3.12+, boto3, Pydantic v2, TotalSegmentator, nibabel, NumPy)
- Agent-optimized docs — your AI coding agent can read the repo and start contributing immediately
<!-- gen:end readme-header -->

<!-- gen:begin readme-screenshots -->

<!-- gen:end readme-screenshots -->

## Quick Start

You need: Node.js >= 20, pnpm >= 10, Python >= 3.12, and a free **[Backblaze B2 account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-totalsegmentator-batch-pipeline)**.

### Start a new project

**Option 1: GitHub Template (recommended)**

Click the green **"Use this template"** button at the top of this repo, name your project, then:

```bash
git clone https://github.com/yourorg/my-cool-app.git
cd my-cool-app
```

**Option 2: Clone and reinitialize**

```bash
git clone https://github.com/backblaze-b2-samples/totalsegmentator-batch-pipeline.git my-cool-app
cd my-cool-app
rm -rf .git
git init
git add .
git commit -m "Initial commit from totalsegmentator-batch-pipeline"
```

Either way you get a clean project with no upstream history — ready to push to your own repo and point your agent at it.

### Setup

**1. Run setup**

```bash
pnpm run setup
```

This copies `.env.example` to `.env` only when `.env` does not already exist,
installs workspace dependencies from `pnpm-lock.yaml`, creates
`services/api/.venv` if missing, validates that an existing venv uses Python
3.12+, and installs the API's committed Python 3.12 resolution from
`services/api/requirements.lock`. It is safe to rerun and never overwrites an
existing `.env`.

> Use the `pnpm run` form: `setup` (like `doctor`) is a built-in pnpm command
> before pnpm 11, so bare `pnpm setup` would run pnpm's own command instead of
> this script.

**2. Add your B2 credentials**

Open `.env` in your editor and keep it visible. Then head to the [Backblaze B2 dashboard](https://secure.backblaze.com/b2_buckets.htm?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-totalsegmentator-batch-pipeline) and:

<!-- gen:begin readme-credentials -->
1. **Create a bucket** and an **application key** with `Read and Write`
   permission, then paste each value into `.env`:
   - `B2_APPLICATION_KEY_ID` — B2 application key ID (**keyID** in the B2 console)
   - `B2_APPLICATION_KEY` — B2 application key (**applicationKey**) — shown once at creation
   - `B2_BUCKET_NAME` — bucket unique name (**Bucket Unique Name** in the B2 console)
   - `B2_REGION` — the region inside the bucket's **Endpoint** (`s3.<region>.backblazeb2.com`); the S3 endpoint is derived from it

   B2 shows an application key once, at creation. The optional variables are
   documented in `.env.example` and in the delivery runbooks.
<!-- gen:end readme-credentials -->

> Want a walkthrough? See the docs for [creating a bucket](https://www.backblaze.com/docs/cloud-storage-create-and-manage-buckets) and [creating app keys](https://www.backblaze.com/docs/cloud-storage-create-and-manage-app-keys).

**3. Run it**

```bash
pnpm dev
```

That's it. Frontend at `localhost:3000`, API at `localhost:8000`. Ingest a NIfTI volume on the Upload page, create a study, and segment it. Interactive API docs (Swagger UI) are at `localhost:8000/docs`, with ReDoc at `/redoc`.

`pnpm dev` runs the preflight check first — it catches the common setup gotchas (wrong Node/Python version, missing venv, missing or placeholder `.env`, ports already taken) and tells you exactly how to fix each one. Run it standalone any time with `pnpm run doctor`.

### Running segmentation (the ML extension)

The core install is deliberately light: `pnpm run setup` installs only the
credential-free API + web stack, so `pnpm dev`, `pnpm verify` and CI stay fast.
The actual segmentation engine — TotalSegmentator, PyTorch, nnU-Net, nibabel —
is a **separate optional extension** in
[`services/api/requirements-ml.txt`](services/api/requirements-ml.txt), lazily
imported in `services/api/app/repo/segmentation.py`. Install it on a CUDA or CPU
host to run real segmentation:

```bash
services/api/.venv/bin/pip install -r services/api/requirements-ml.txt
```

Without it the app still runs and everything except the segmentation step works;
a segment run on a clone without the stack is recorded as `failed` with the
install hint (it never 500s). Device selection is automatic — CUDA GPU if
present, otherwise CPU. Set `TS_DEVICE` to force `cpu`, `gpu`, or `mps` (Apple
MPS is opt-in, since nnU-Net MPS support is weak). TotalSegmentator downloads its
own Apache-2.0 model weights on first use — no Hugging Face token needed.

### Supported local environments

Local scripts run on macOS, Linux, and WSL2 — native Windows isn't supported
yet (the dev scripts use POSIX shell syntax), so use WSL2 on Windows. Cloud or
sandboxed agent environments also need permission to install dependencies and to
bind localhost ports; see
[docs/verification.md](docs/verification.md#local-environments) for the sandbox,
port-fallback, and IPv6 behavior.

## When to use

Use this repository when you want a working, batch medical-imaging segmentation
pipeline backed entirely by Backblaze B2: ingest raw CT/MRI volumes, run
TotalSegmentator locally to produce 100+ structure masks plus per-structure
volumetric statistics, and write the derived artifacts back to B2 keyed by study.
It is a strong starting point for radiologists, medical-AI researchers and
clinical data teams building a scalable segmented imaging dataset, and it
demonstrates the **write-amplification** storage pattern — each source volume
yields comparable-size derived data — with real, production-minded engineering
controls (strict architecture, contract checks, tests, linting, a Railway
runbook).

## When not to use

This is a sample, not a medical device or a hosted service. Do not use it for
clinical diagnosis, and never feed it real, identifiable patient data — it has no
authentication, no tenant isolation, no PHI handling, and no hosted operations.
It expects synthetic phantoms or de-identified volumes. Before adapting it toward
any production use, you own its product-specific security, operations, capacity,
regulatory/compliance, and support decisions.

## Why Backblaze B2?

[Backblaze B2](https://www.backblaze.com/cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-totalsegmentator-batch-pipeline) is the object storage this kit is built around — a deliberate default, not just a demo backend:

- **S3-compatible API.** B2 speaks the S3 API, so the `boto3` calls, SDKs, and tooling you already use for AWS S3 work unchanged — you just point them at B2's endpoint. This app uses the S3-compatible API throughout (isolated in `services/api/app/repo/`), so nothing is locked to a proprietary client.
- **Built for data-heavy, write-amplified workloads.** Each 100–500 MB source volume yields a comparable-size mask plus a stats JSON, so a PACS-scale archive fills B2 with terabytes of derived data. B2 storage runs at a fraction of hyperscaler pricing with generous free egress — exactly what an imaging dataset that keeps growing needs.
- **B2 is the sole storage layer.** Study records, source volumes, masks and stats all live as objects under one `studies/` prefix — there is no separate database, and no second API key (segmentation is on-device OSS).
- **Free to start.** A [free B2 account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-totalsegmentator-batch-pipeline) is enough to run everything in this repo.

## Extending this app

This sample is built on the vibe-coding-starter-kit, so it keeps the kit's shared
scaffolding and layers the segmentation domain on top. If you fork it to build
your own imaging (or other) pipeline:

- **Keep** the UI kit (`apps/web/src/components/ui/` + design tokens in `globals.css` + `/design`).
- **Keep** the Bucket Explorer (`/files`) — the non-negotiable full-bucket view — and the Bulk Volume Ingest page (`/upload`), the reusable B2-backed surface.
- **Study Library** (`/studies`) and the **Dashboard** (`/`) are the app-specific screens; the primary entity is `Study`. Add or change endpoints by editing the FastAPI routers and Pydantic models, then run `pnpm contract:export && pnpm gen:api` — the shared types, route registry and query keys are generated.
- **Segmentation** lives entirely in `services/api/app/repo/segmentation.py` (the only module importing torch/TotalSegmentator), so you can swap the engine without touching the service or UI layers.
- **Rebrand** via `apps/web/src/lib/app-config.ts` (`APP_NAME`, `APP_DESCRIPTION`) and `docs/exec-plans/sample.json` + `pnpm gen:docs`.

Full contract and rationale: [AGENTS.md §2 — Shared Scaffolding Contract](AGENTS.md#2-shared-scaffolding-contract).

## Agent-First Architecture

This repo is optimized for coding agents. Use the template, point your agent at it, and start building.

The structure follows the principle that **repository knowledge is the system of record**. Anything an agent can't access in-context doesn't exist — so everything it needs to reason about the codebase is versioned, co-located, and discoverable from the repo itself.

### How it works

**[AGENTS.md](AGENTS.md) is the single source of truth for all coding agents.** Its bounded, agent-sized entry point gives agents the repository layout, architectural invariants, commands, conventions, and pointers to deeper docs. Agent-specific files (CLAUDE.md, GEMINI.md, Copilot instructions, etc.) are thin pointers back to AGENTS.md.

**Architecture is enforced mechanically, not by convention.** Layering rules, import boundaries, backend application Python file-size limits, and SDK containment are verified by structural tests and lints that run on every change. When rules are enforceable by code, agents follow them reliably.

**The knowledge base is structured for progressive disclosure:**

```
AGENTS.md              Single source of truth — layout, invariants, commands, conventions
ARCHITECTURE.md        System layout, layering rules, data flows
docs/
  features/            Feature docs (inputs, outputs, flows, edge cases)
  app-workflows.md     User journeys
  dev-workflows.md     Engineering workflows, command index, releases
  verification.md      What each gate checks, and failure recovery
  frontend-conventions.md  Frontend conventions and data fetching
  SECURITY.md          Security principles
  RELIABILITY.md       Reliability expectations
  exec-plans/          Execution plans and tech debt tracker
```

### Key design decisions

| Principle | Implementation |
|-----------|---------------|
| Give agents a single source of truth | AGENTS.md — bounded layout, invariants, commands, conventions |
| Enforce invariants mechanically | Structural tests + ruff + ESLint verify boundaries |
| DRY documentation | Each fact lives in one place; no redundant files to drift |
| Strict layered architecture | `types -> config -> repo -> service -> runtime`, enforced by tests |
| Prefer boring, composable libraries | stdlib logging over frameworks, Pydantic over ad-hoc validation |
| Contain external SDKs | `boto3` only in `repo/` layer — verified by structural test |
| Keep files agent-sized | 300-line limit for backend app Python, enforced by test |
| Docs updated with code | Same-PR requirement prevents documentation rot |
| Structured observability | JSON logging, `/metrics` endpoint, request tracing |

This approach draws from [OpenAI's experience building with Codex](https://openai.com/index/harness-engineering/): agents work best in environments with strict boundaries, predictable structure, and progressive context disclosure.

## Core Features

<!-- gen:begin readme-core-features -->
- [Study Library](docs/features/studies.md) — browse, create, edit, delete and segment CT/MRI studies
- [Segmentation](docs/features/segmentation.md) — run TotalSegmentator locally to produce a 100+ structure multi-label mask
- [Volumetric Stats](docs/features/volumetric-stats.md) — per-structure volume (mL), bounding box and CT Hounsfield stats as JSON
- [Dashboard](docs/features/dashboard.md) — studies processed, structures segmented, and source-to-derived write amplification
- [Bulk Volume Ingest](docs/features/file-upload.md) — drag-and-drop bulk upload of NIfTI volumes to the B2 source prefix
- [Bucket Explorer](docs/features/file-browser.md) — full-bucket browse, preview, download, delete
- [Settings](docs/features/settings.md) — theme plus labelled demo preference fields
<!-- gen:end readme-core-features -->
- [Design System](docs/design-system.md) — tokens, primitives, AI elements, the blaze generating loader, and inline `ErrorState` / `EmptyState` patterns. Live preview at `/design`.
- Inline error handling — fetch failures surface *what's wrong* (API offline, 401, 5xx) and offer a Retry, instead of silently rendering empty state.
- Single-source config — one `.env` at the repo root powers both API and web app, validated at startup so misconfig fails fast with a readable message.
- Centralized data layer — every fetch goes through TanStack Query hooks in `apps/web/src/lib/queries.ts`; cache invalidation is one call after a mutation. The types, route registry and query keys underneath are generated from the API contract by `pnpm gen:api`, so the client cannot drift from the backend.
- Checked local API contract — [`docs/api/openapi.json`](docs/api/openapi.json) plus `pnpm contract:check` catch FastAPI/client route drift; it describes the template API you run, not a hosted public endpoint.
- Structural tests — verify layering rules, import boundaries, SDK containment, and backend application Python file-size limits
- Structured JSON logging — every request traced with `request_id` and timing
- `/health` endpoint — B2 connectivity check
- `/metrics` endpoint — Prometheus-format counters (request count, latency, uploads)
- `/docs` + `/redoc` — auto-generated interactive API docs (toggle off in prod with `ENABLE_DOCS=false`)
- Per-IP rate limiting and magic-byte upload validation — see [SECURITY.md](docs/SECURITY.md)

## Tech Stack

- TypeScript, Next.js 16, React 19, Tailwind v4, shadcn/ui, Recharts
- TanStack Query — caching, dedup, retry, stale-while-revalidate for every fetch
- Python 3.12+, FastAPI, boto3, Pydantic v2 (core)
- TotalSegmentator, PyTorch, nnU-Net v2, nibabel, NumPy — the optional ML extension (`services/api/requirements-ml.txt`), lazy-imported and excluded from the core install/verify
- Backblaze B2 (S3-compatible object storage) — the sole storage layer
- pnpm workspaces (monorepo)

## Commands

The commands you reach for day to day:

<!-- gen:begin readme-commands -->
| Command | What it does |
| --- | --- |
| `pnpm run setup` | One-time cold start: copy `.env.example` → `.env` (only if missing), install workspace deps, create the backend venv, install locked API deps |
| `pnpm dev` | Start frontend + backend (runs the `pnpm run doctor` preflight first) |
| `pnpm wait-ready` | Block until the running web + API answer, print one line, exit 0/1 — use instead of sleeping before driving the app |
| `pnpm contract:export` | Export the FastAPI OpenAPI contract into `docs/api/openapi.json` |
| `pnpm contract:check` | Verify the exported contract and the generated client routes agree, both ways |
| `pnpm gen:api` | Regenerate the shared types, the client route registry and the query-key factory from the exported contract |
| `pnpm gen:docs` | Regenerate the marker-delimited doc regions from `docs/exec-plans/sample.json` |
| `pnpm gen:check` | Fail if any generated file or doc region is stale (first step of `pnpm verify:web`) |
| `pnpm verify` | Credential-free pre-PR suite — runs `check:agent-docs`, `verify:api`, then `verify:web` |
| `pnpm verify:full` | `pnpm verify` plus Playwright E2E; needs a live local stack, real `.env`, a free web port, and Chromium |
| `pnpm test:verify` | Run throwaway verification specs from `apps/web/e2e/verify/` against the app, with the shared browser fixtures |
<!-- gen:end readme-commands -->

`pnpm verify` is the gate to run before opening a PR. It needs
`services/api/.venv` from `pnpm run setup`, but no B2 credentials or browser, and
it breaks down into `pnpm verify:api` (backend lint, tests, structure),
`pnpm verify:web` (frontend lint, unit tests, typecheck + build), and
`pnpm check:agent-docs` (agent-doc drift).

For the full command reference (`dev:web`, `dev:api`, `lint`, `test:*`,
`check:structure`, `test:e2e`, live B2 tests), see
[docs/dev-workflows.md](docs/dev-workflows.md#commands). For worktree/parallel-run
notes, port-fallback behavior, and slow-run recovery, see
[docs/verification.md](docs/verification.md).

## Deploying

The primary intended use is **local** (`pnpm dev`). For a hosted demo, deploy to
**Railway**, which can give the API the CPU/GPU and memory segmentation needs.

This app is intentionally **not deployable to Vercel**: segmentation runs
PyTorch/nnU-Net inference that cannot fit or complete inside a serverless
function, so a one-click Vercel button would break the "the button deploys the
whole app" promise. There is no deploy button:

<!-- gen:begin readme-deploy-button -->
_This app does not ship a one-click deploy button._
<!-- gen:end readme-deploy-button -->

Before a real deploy:

- Your bucket's CORS must allow the deploy origin (uploads go **directly from the browser to B2** via presigned PUT).
- The deployed API is unauthenticated and bucket-wide — use a dedicated B2 bucket/prefix and key, and never real patient data.
- The API host must install the ML extension (`services/api/requirements-ml.txt`) with enough CPU/GPU and memory to run TotalSegmentator.

Full setup — services, variables, CORS, promotion and rollback — is in the
[Railway delivery contract](infra/railway/README.md).

## Documentation Map

<!-- gen:begin readme-doc-map -->
| Doc | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Agent table of contents — start here |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System layout, layering, data flows |
| [docs/features/](docs/features/) | Feature docs (study library, segmentation, volumetric stats, dashboard, bulk volume ingest, bucket explorer, settings) |
| [docs/design-system.md](docs/design-system.md) | Design tokens, primitives, loader, error/empty states |
| [docs/app-workflows.md](docs/app-workflows.md) | User journeys |
| [docs/dev-workflows.md](docs/dev-workflows.md) | Engineering workflows, command index, releases |
| [docs/verification.md](docs/verification.md) | What each gate checks, and failure recovery |
| [docs/frontend-conventions.md](docs/frontend-conventions.md) | Frontend conventions, screens, data fetching |
| [docs/SECURITY.md](docs/SECURITY.md) | Security principles |
| [docs/RELIABILITY.md](docs/RELIABILITY.md) | Reliability expectations |
| [docs/api/openapi.json](docs/api/openapi.json) | The checked-in API contract the client seam is generated from |
| [infra/railway/README.md](infra/railway/README.md) | Railway delivery contract |
| [docs/exec-plans/](docs/exec-plans/) | Execution plans, tech debt, and the sample manifest |
<!-- gen:end readme-doc-map -->

## FAQ

**What is the TotalSegmentator Batch Pipeline?**
An open-source, full-stack sample (Next.js 16 + FastAPI) that ingests raw 3D CT/MRI volumes to [Backblaze B2](https://www.backblaze.com/cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-totalsegmentator-batch-pipeline), runs TotalSegmentator locally to produce multi-label masks over 100+ anatomical structures plus per-structure volumetric statistics, and writes the derived artifacts back to B2 keyed by study — with B2 as the sole storage layer. It showcases the write-amplification storage pattern at PACS scale.

**Is it free?**
Yes. The code is MIT-licensed (see [License](#license)), and Backblaze B2 offers a free account to get started.

**Can I use it in production?**
It's a template/sample Backblaze maintains to help developers get started with B2. Production use is possible with caution and requires your own validation — you own the product-specific security, operations, capacity, compliance, and support decisions for anything you adapt, and the repository software carries no SLA. See [When not to use](#when-not-to-use) and [Maintenance and support](#maintenance-and-support).

**Does it include authentication, user accounts, or multi-tenant isolation?**
No. It does not provide managed hosting, user accounts, authentication, tenant isolation, billing, or on-call operations. Add whatever your application requires on top of the scaffold.

**Do I have to use Backblaze B2?**
It integrates Backblaze B2 through the S3-compatible API, and B2 is the storage the kit is built around. You supply your own B2 bucket and application key during setup.

**Is it really built for AI coding agents?**
Yes. [AGENTS.md](AGENTS.md) is the single source of truth for coding agents, architectural boundaries are enforced mechanically by structural tests and lints (not by convention), and the docs use progressive disclosure — so an agent can read the repo and start contributing immediately.

**What's the tech stack?**
Frontend: TypeScript, Next.js 16, React 19, Tailwind v4, shadcn/ui, TanStack Query. Backend: Python 3.12+, FastAPI, boto3, Pydantic v2. Storage: Backblaze B2 (S3-compatible). See [Tech Stack](#tech-stack).

**How do I rebrand or extend it?**
Edit `apps/web/src/lib/app-config.ts` (`APP_NAME`, `APP_DESCRIPTION`) and `docs/exec-plans/sample.json` (then `pnpm gen:docs`); the page title, sidebar, docs and generated regions update from there. See [Extending this app](#extending-this-app).

**How do I deploy it?**
It is designed to run locally (`pnpm dev`); for a hosted demo, deploy to Railway on a host with enough CPU/GPU and memory for TotalSegmentator. It is intentionally not deployable to Vercel — serverless functions can't run the PyTorch/nnU-Net inference. Deploying is always a human-approved action — see [Deploying](#deploying).

**Does it work on Windows?**
Local scripts are supported on macOS, Linux, and WSL2. Native Windows is not supported yet — use WSL2 on Windows.

**Where do I get help or report bugs?**
Report repository defects and feature requests through [GitHub Issues](https://github.com/backblaze-b2-samples/totalsegmentator-batch-pipeline/issues). For B2 account, billing, service, or API help, use [Backblaze Support](https://www.backblaze.com/help).

## Maintenance and support

Backblaze maintains this open-source template/sample to help developers get
started with B2. Production use is possible with caution and requires your own
validation. Report repository defects and feature requests through
[GitHub Issues](https://github.com/backblaze-b2-samples/totalsegmentator-batch-pipeline/issues);
for B2 account, billing, service, or API help, use
[Backblaze Support](https://www.backblaze.com/help). This template/sample is
not covered by the Backblaze service level agreement, and no SLA is provided
for the repository software; any B2 service or support commitments are governed
separately by the applicable Backblaze terms and support plan.

## Contributing

Start with [AGENTS.md](AGENTS.md). It's the map — everything else is discoverable from there. For local commit hooks, follow [the pre-commit workflow](docs/verification.md#pre-commit).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related projects

**Claude Agent B2 Skill** — manage Backblaze B2 from your terminal using natural language (list/search, audits, stale or large file detection, security checks, safe cleanup). Repo: [claude-skill-b2-cloud-storage](https://github.com/backblaze-b2-samples/claude-skill-b2-cloud-storage).
