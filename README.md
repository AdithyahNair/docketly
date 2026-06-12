# Docketly

Court notice automation for bankruptcy law firms. A notice arrives, AI classifies it,
firm-configured rules email the right people — and anything the AI isn't sure about
waits for a human instead of guessing.

## Problem

Bankruptcy firms receive a constant stream of court notices from CM/ECF and PACER:
hearing notices, 341 meeting notices, discharge orders, dismissals, deadlines, motions
for relief from stay. Today a staff member reads each one, matches it to a case, and
manually emails the client, the attorney, or both. The work is repetitive and
unforgiving: a missed hearing notice can cost a client their case; a wrong email
confuses a client and damages trust.

## What it does

1. **Ingests** notices via an HMAC-signed webhook feed (simulated PACER) or PDF upload.
   Content-hash dedup makes replayed deliveries a no-op.
2. **Classifies** each notice with Claude (forced tool call, strict schema): notice type,
   chapter, case number, judge, hearing datetime, confidence, one-sentence reasoning.
   Regex extracts case number and judge first; disagreement with the LLM lowers
   effective confidence.
3. **Gates** on confidence: `>= 0.8` AND a recognized type AND a case number that
   resolves against the firm's cases → automations fire. Anything else → human review
   queue. No automated email is ever sent on uncertain data.
4. **Dispatches** matching automation rules: resolve recipients (Client/Attorney roles or
   raw emails), render `{{token}}` templates, send via Resend, record every run.
5. **Reviews**: a human corrects any field and approves — the same dispatch pipeline
   fires on human-confirmed data, and the correction is appended to the eval dataset as
   a regression test.

## Architecture

```
PDF upload (dashboard)        Webhook feed (simulated PACER, HMAC-signed)
        \                          /
         v                        v
   POST /api/notices/upload   POST /api/ingest
              \                  /
               v                v
        Ingest: sha256 content hash dedup, store PDF in
        Supabase Storage, extract text, insert notice row,
        emit Inngest event "notice/ingested"
                      |
                      v
        Inngest fn: classify
          - Claude tool call -> structured classification
          - resolve case_number against cases table
          - confidence >= 0.8 AND type recognized AND case matched
              -> status=classified, emit "notice/classified"
          - otherwise -> status=needs_review (stop)
                      |
                      v                <- review approval also emits
        Inngest fn: dispatch              "notice/classified"
          - load enabled automations for firm
          - match: notice_type exact, chapter filter, judge filter
          - per match (isolated try/catch):
              insert run row (UNIQUE constraint = idempotency)
              resolve recipients (roles -> case emails)
              render {{tokens}} into subject/body
              send via Resend, record run status
                      |
                      v
        Runs log, email in recipient inbox
```

Stack: Next.js 15 (App Router), Supabase (Postgres + RLS + Auth + Storage), Inngest,
Anthropic API (`claude-sonnet-4-6`), Resend. A 5-minute Inngest sweeper cron re-emits
events for notices stuck in `classifying`, closing the dual-write gap (row inserted but
event lost), so the pipeline is self-healing.

## Why these choices

- **Inngest over SQS/Lambda or a hand-rolled worker.** At this timescale, managed
  durable execution with retries, backoff, step memoization, and a trace dashboard beats
  infrastructure you babysit. At scale you'd either keep Inngest or move to SQS + DLQ;
  both are defensible, and the dispatch idempotency lives in the database either way, so
  the queue is swappable.
- **Confidence gating, not confidence theater.** The model is instructed to be
  conservative, and the asymmetry is explicit: a wrong email is expensive, a review is
  cheap. "Other" is a first-class classification outcome that always routes to review —
  the system degrades safely instead of guessing.
- **Idempotency at the database layer, not in application logic.** Two UNIQUE
  constraints carry the core guarantees: `UNIQUE(firm_id, content_hash)` on notices
  (replayed webhooks are no-ops) and `UNIQUE(automation_id, notice_id)` on runs (the
  same notice never triggers the same rule twice, even across Inngest retries or a
  double-clicked approval). Constraint violations are skips by design.
- **Failure isolation per rule.** Each automation runs in its own try/catch and its own
  run row: one bad recipient email records a failed run and the sibling rules still send.
- **Multi-tenant RLS from day one.** Every table carries `firm_id` and RLS keys on the
  JWT's `app_metadata.firm_id`. The demo serves one seeded firm, but the schema doesn't
  need a rewrite to serve fifty. The service-role key is confined to server-side
  pipeline code.
- **Evals that grow themselves.** Every review-queue correction is appended to the
  labeled dataset, so the eval (`npm run eval`) regression-tests exactly the cases the
  model got wrong in production. It exits nonzero below 85% accuracy and can gate
  deploys.

## Data sensitivity

Court notices contain PII. v1 sends notice text to the Anthropic API for
classification. A production deployment adds PII redaction before model calls and
zero-data-retention API configuration; see the roadmap below.

## What I'd build next for production

- PII redaction before model calls; zero-retention API terms.
- Live PACER/CM/ECF polling with per-district adapters (ingestion is webhook + upload today).
- Per-firm webhook secrets and rate limits.
- Dead-letter queue + alerting on exhausted retries (today: `failed` status + manual retry).
- Per-type confidence thresholds and auto-approve policies driven by observed calibration
  (low-risk discharge orders vs. high-stakes hearing notices).
- Notice-type taxonomy versioning so the eval dataset survives taxonomy changes.
- Batch backfill for onboarding a firm's historical notices.
- SOC 2 posture: audit log export, retention policies, access reviews.

## Running locally

Prereqs: Node 20+, a Supabase project, an Anthropic API key, a Resend API key.

1. **Env**: copy `.env.example` → `.env.local` and fill in your keys.
2. **Database**: apply `supabase/migrations/0001_init.sql` (Supabase SQL editor or
   `supabase db push`).
3. **Storage**: create a **private bucket named `notices`** in Supabase Storage
   (Dashboard → Storage → New bucket). Uploaded notice PDFs are stored there; the
   dashboard serves them via short-lived signed URLs.
4. **Auth**: enable the Email provider (magic link) in Supabase Auth. First sign-in
   automatically claims the seeded demo firm.
5. **Seed**: `npm run seed` — one firm, 15 cases, 4 automations. Set `DEMO_INBOX` to an
   email you control so automation sends land somewhere visible.
6. **Run**: `npm run dev` and, in a second terminal, `npm run inngest:dev` (local
   Inngest dev server at http://localhost:8288).
7. **Demo data**: `npm run simulate-feed` — posts HMAC-signed notices to the webhook.
   Expect 4 to classify and auto-email, 1 to land in review, and the replayed payload to
   return `deduped: true`.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run inngest:dev` | Local Inngest dev server (pipeline execution) |
| `npm run seed` | Seed demo firm, cases, automations |
| `npm run simulate-feed` | Fire signed demo notices at the webhook |
| `npm run eval` | Score the live classifier; exits nonzero under 85% |
| `npm run typecheck` / `npm run build` | Verification gates |

## Eval results

`npm run eval` runs the production classification path (regex + LLM merge) against the
labeled dataset and prints exact-match accuracy, per-type precision/recall, a confusion
matrix, and confidence calibration (mean confidence on correct vs. incorrect answers —
the signal that the 0.8 gate is actually load-bearing). Results are recorded in the
`eval_runs` table and rendered on the dashboard's Evals page. The dataset ships with 13
labeled examples and grows with every review correction.
