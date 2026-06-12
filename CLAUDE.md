# CLAUDE.md

Docketly: court notice automation for bankruptcy law firms. Notices arrive via
HMAC-signed webhook or PDF upload, Claude classifies them, automation rules fire
templated emails, and anything uncertain lands in a human review queue.
See docs/PRD.md (product) and BLUEPRINT.md (implementation) — they are the
source of truth for scope and design decisions.

## Stack

- **Next.js 15** App Router, TypeScript strict, React 19. One app serves dashboard + API.
- **Supabase**: Postgres (RLS, multi-tenant by `firm_id`), Auth (email magic link), Storage (bucket `notices` for PDFs).
- **Inngest**: all async pipeline work. Functions in `inngest/`: classify (`notice/ingested`), dispatch (`notice/classified`), sweeper cron, classify-failure handler.
- **Anthropic SDK**: `claude-sonnet-4-6`, forced tool call with strict schema (`lib/claude.ts`), merged with regex extraction (`lib/pipeline.ts`).
- **Resend**: email sending, called ONLY from `inngest/dispatch.ts`.

Path alias: `@/*` maps to the repo root (see tsconfig.json), e.g. `@/lib/types`.

**Design system** (`design/README.md`): theme in `app/globals.css`, shadcn
primitives in `components/ui/`, semantic tokens in `design/tokens.ts`
(tones, status→tone map, typography recipes), shared patterns in
`design/patterns/` (PageHeader, EmptyState, Field, GateBadge). Render
statuses only via `components/status-badge.tsx`; no raw palette classes in
page code.

## Already implemented — do not regenerate or refactor

The core pipeline is working, typechecked, and tested. Build around it:

`supabase/migrations/0001_init.sql`, `lib/types.ts`, `lib/claude.ts`,
`lib/extract.ts`, `lib/pipeline.ts`, `lib/templates.ts`, `lib/hash.ts`,
`lib/supabase.ts`, `inngest/*`, `app/api/ingest/route.ts`,
`app/api/notices/upload/route.ts`, `app/api/inngest/route.ts`,
`evals/run.ts`, `evals/dataset.json` (runtime appends allowed),
`scripts/seed.ts`, `scripts/simulate-feed.ts`.

## Conventions (inviolable)

- **Reads** go through server components using the user's RLS-scoped Supabase
  client. **Writes** go through server actions. **No new REST routes for CRUD** —
  the only API routes are ingest, upload, and the Inngest handler.
- **UI never calls Resend.** Any UI action that should trigger automations emits
  an Inngest event (e.g. review approval emits `notice/classified`); only the
  dispatch function sends email.
- **Two DB invariants are sacred.** `UNIQUE(firm_id, content_hash)` on notices
  (ingestion dedup) and `UNIQUE(automation_id, notice_id)` on automation_runs
  (at-most-once fires). No code path may work around them; constraint
  violations are skips by design, never errors to retry around.
- The service-role client (`lib/supabase.ts` `adminClient`) is server-side
  pipeline code only. Never expose secrets client-side.
- Confidence gate: `CONFIDENCE_THRESHOLD` (0.8) from `lib/types.ts`; routing is
  confidence >= 0.8 AND known type AND case resolved, else `needs_review`.

## Verification gates

- `npm run typecheck` after EVERY change.
- `npm run build` after UI milestones.
- Pipeline end-to-end: `npm run seed`, then `npm run dev` + `npm run inngest:dev`,
  then `npm run simulate-feed` → expect 4 notices classified, 1 in review,
  replay returns `deduped: true`.
- Classifier quality: `npm run eval` must pass the 85% accuracy gate
  (requires `ANTHROPIC_API_KEY`).
