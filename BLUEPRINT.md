# Docketly: Court Notice Automation for Bankruptcy Firms

Implementation blueprint. Built as a standalone application solving the same problem as Glade's Court Notice Automations feature: when a classified court notice arrives on a case, fire the right emails to the right people automatically, with humans in the loop wherever the AI is uncertain.

Target: ship in one day. Stack: Next.js 15 (App Router, TypeScript), Supabase (Postgres + Auth + Storage), Inngest, Anthropic API (claude-sonnet-4-6), Resend, Sentry.

---

## 1. Problem

Bankruptcy firms receive a constant stream of court notices from CM/ECF and PACER: hearing notices, 341 meeting notices, discharge orders, dismissals, deadlines, motions for relief from stay. Today a staff member reads each one, figures out which case it belongs to, and manually emails the client, the attorney, or both. This is slow, error-prone, and the failure mode is bad: a missed hearing notice can cost a client their case.

Docketly ingests notices, classifies them with AI, matches them against firm-configured automation rules, and sends templated emails. Anything the AI is not confident about lands in a human review queue instead of firing. AI never acts on uncertain data without a human confirming it.

## 2. Success criteria

Each maps directly to a hiring signal:

1. A notice ingested via webhook is classified, matched, and emailed within seconds, with zero manual steps. (0-to-1 shipping)
2. A low-confidence or unrecognized notice is held for review, and approving it fires the automations on human-confirmed data. (Product judgment)
3. The same notice can be ingested twice and the same automation never fires twice. Enforced at the database level. (Engineering fundamentals)
4. One automation failing (bad recipient email) does not block other automations on the same notice. (Engineering fundamentals)
5. `pnpm eval` runs the live classifier against a labeled dataset and prints per-type precision/recall and a confusion matrix. (AI evaluation frameworks)
6. Deployed on Vercel with a public URL, seeded demo data, README with architecture and tradeoffs, 2-minute Loom. (Professional packaging)

## 3. Architecture

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

Everything async happens in Inngest, not in the request path. Inngest gives durable execution, automatic retries with backoff, step-level memoization, and a runs dashboard for free. The webhook endpoint only verifies, dedupes, stores, and enqueues; it returns in under a second regardless of AI latency.

Why not SQS/Lambda or a hand-rolled worker: at this timescale, managed durability with an observability dashboard beats infrastructure you have to babysit. The README tradeoffs section covers what changes at scale (move to SQS + DLQ, or keep Inngest, both defensible).

## 4. Data model

See `supabase/migrations/0001_init.sql` for the full DDL. Tables:

- **firms**: id, name, owner_email. One seeded demo firm.
- **users**: Supabase auth, joined to firm via firm_id in app_metadata.
- **cases**: firm_id, case_number (UNIQUE per firm), client_name, client_email, attorney_email, chapter. ~15 seeded.
- **notices**: firm_id, case_id (nullable), source (upload|webhook), pdf_path (nullable), raw_text, content_hash (UNIQUE per firm), status (classifying|classified|needs_review|failed), classification jsonb, reviewed_by, reviewed_at.
- **automations**: firm_id, name, enabled, match_notice_type, match_chapter (nullable), match_judge (nullable, initials), recipients jsonb, subject_template, body_template.
- **automation_runs**: automation_id, notice_id, status (sent|failed|skipped), error, resend_email_id. UNIQUE(automation_id, notice_id).
- **eval_runs**: model, dataset_size, accuracy, per_type jsonb, confusion jsonb, created_at.

Two load-bearing constraints:
- `UNIQUE(firm_id, content_hash)` on notices: ingestion dedup. A replayed webhook is a no-op.
- `UNIQUE(automation_id, notice_id)` on automation_runs: idempotency. The same notice never triggers the same automation twice, even after Inngest retries.

Every table carries firm_id and has RLS enabled. The demo runs one firm, but the schema is multi-tenant from day one.

## 5. Classification contract

One Claude call (`claude-sonnet-4-6`), forced tool use, strict JSON schema. Fields:

| Field | Type | Notes |
|---|---|---|
| notice_type | enum | Notice of Hearing, Notice of 341 Meeting, Order of Discharge, Order of Dismissal, Notice of Deadline, Motion for Relief from Stay, Other |
| chapter | 7, 13, or null | |
| case_number | string or null | e.g. 26-10342 |
| judge_initials | string or null | uppercase, e.g. MEW |
| hearing_datetime | ISO 8601 or null | only for hearing-type notices |
| confidence | number 0-1 | calibrated self-assessment |
| reasoning | string | one sentence, shown in the review queue |

Routing rule, in order: confidence < 0.8 OR notice_type = Other OR case_number unresolved against the cases table -> needs_review. Everything else -> dispatch.

The "Other" catch-all plus the review queue means the system degrades safely instead of guessing. Review corrections are appended to the eval dataset, so every human fix becomes a regression test.

## 6. API surface

| Route | Method | Auth | Purpose |
|---|---|---|---|
| /api/ingest | POST | HMAC SHA-256 over raw body, `x-docketly-signature` | Webhook feed. JSON: `{ text, source_id? }` |
| /api/notices/upload | POST | Supabase session | Multipart PDF upload from dashboard |
| /api/inngest | GET/POST/PUT | Inngest signing key | Inngest function handler |
| Dashboard data access | n/a | Supabase client + RLS | Server components query directly, mutations via server actions |

Keep the API thin. CRUD for automations and review actions are Next.js server actions, not REST routes; less surface, same security via RLS.

## 7. Inngest functions

**classify** (event `notice/ingested`, retries: 3)
1. step.run("load-notice"): fetch notice row.
2. step.run("classify"): call `classifyNotice(raw_text)`. On API error, throw (Inngest retries with backoff).
3. step.run("resolve-case"): look up case by (firm_id, classification.case_number).
4. step.run("route"): update notice with classification + status. If classified, emit `notice/classified`.

**dispatch** (event `notice/classified`, retries: 3)
1. Load notice + case + enabled automations for firm.
2. Filter: `match_notice_type === classification.notice_type`, chapter filter null or equal, judge filter null or case-insensitive equal on initials.
3. For each match, inside its own try/catch:
   a. INSERT run with status=pending ON CONFLICT DO NOTHING. If no row inserted, skip (already ran).
   b. Resolve recipients: role "client" -> case.client_email, role "attorney" -> case.attorney_email, raw emails pass through. Unresolvable role -> mark this run failed, continue to next automation.
   c. Render tokens: client_name, case_number, notice_type, hearing_date, hearing_time, judge_initials, chapter, firm_name.
   d. Send via Resend. Record resend_email_id, status=sent. On send error, status=failed with error message.

Failure isolation lives in step 3's per-automation try/catch. Idempotency lives in 3a. Both are one screen of code; both are the point.

## 8. Dashboard (build with Claude Code)

Five pages under `app/(dashboard)/`, shadcn/ui, Supabase server components. Layout: sidebar nav (Notices, Review, Automations, Runs, Evals), firm name header, sign out.

1. **/notices**: table of notices (created, source, status badge, notice type, case number, confidence). Status filter tabs. Row click opens detail: extracted text (and PDF link if uploaded) on the left, classification JSON rendered as labeled fields plus reasoning on the right, and the runs this notice produced.
2. **/review**: queue of needs_review notices. Same side-by-side layout, but classification fields are editable inputs. Buttons: "Approve & run automations" (saves corrections, sets status=classified, records reviewed_by/at, emits notice/classified via server action -> Inngest), "Mark failed". On approve, also append `{ text, expected }` to the eval dataset table (or evals/dataset.json in dev).
3. **/automations**: list with enabled toggle, name, filters summary, last run time + status (join latest automation_run). Create/edit form: name, notice type select, optional chapter select, optional judge initials input, recipients (multi: Client, Attorney, custom email chips), subject + body textareas with a token reference panel listing available {{tokens}}.
4. **/runs**: table joined across runs, automations, notices: time, automation name, notice type + case number, recipient(s), status badge, error text on failed, link to Resend email id.
5. **/evals**: latest eval_runs row rendered: headline accuracy, per-type precision/recall table, confusion matrix grid, run history sparkline. "How to run" snippet: `pnpm eval`.

Claude Code prompt to use per page: "Implement <page> per BLUEPRINT.md section 8 item N. Use the existing supabase client in lib/supabase.ts and types in lib/types.ts. Server components for reads, server actions for writes. shadcn/ui table, badge, dialog, form components."

## 9. Eval framework

- `evals/dataset.json`: labeled examples, each `{ id, text, expected: { notice_type, chapter, case_number, judge_initials } }`. Ship with 12+, grow toward 20+ with review-queue corrections.
- `evals/run.ts` (tsx script): for each example call the live `classifyNotice`, compare fields, compute exact-match accuracy, per-type precision/recall, confusion matrix, mean confidence on correct vs incorrect (calibration signal). Print a table; insert a row into eval_runs when SUPABASE env is present.
- Failing threshold: exit code 1 if accuracy < 0.85, so it can run in CI before deploys.

## 10. Observability

- Sentry on client + server + Inngest functions (errors with notice/automation ids as tags).
- pino structured logs in API routes and Inngest steps: one log line per state transition (ingested, classified, routed_review, dispatched, sent, failed) with ids. Vercel log drains can ship these anywhere later.
- Inngest dashboard is the pipeline trace viewer: per-event runs, step timings, retries, payloads. Demo this on camera.

## 11. Security

- Webhook: HMAC SHA-256 of raw body with shared secret, constant-time compare. Reject missing/invalid signature with 401.
- RLS on every table keyed by firm_id; service-role key only used server-side (Inngest functions, ingest route).
- No PDF or notice text ever leaves the system except to the Anthropic API; note this in the README (legal data sensitivity, and what a production version adds: BAA-equivalent terms, zero-retention API config, PII redaction before model calls).

## 12. Edge cases handled

- Duplicate webhook delivery: content hash no-op, returns 200 with `deduped: true`.
- Inngest retry after partial dispatch: run-row UNIQUE constraint makes re-execution skip already-sent automations.
- Invalid recipient on one automation: that run fails with recorded error, siblings send.
- Notice for unknown case number: needs_review, reviewer can correct the number or leave null and mark failed.
- Disabled automation: never matched.
- Judge filter case mismatch ("mew" vs "MEW"): case-insensitive compare.
- Claude API outage: Inngest retries with backoff; after final failure notice status=failed, visible in inbox with retry button (re-emits notice/ingested).
- Empty/garbled PDF text: classifier returns Other with low confidence -> review queue.

## 13. Task breakdown (one day)

| # | Task | Est | Output |
|---|---|---|---|
| 1 | Scaffold: create-next-app, shadcn init, deps, env wiring | 30m | repo boots |
| 2 | Apply migration, seed script (firm, 15 cases, 4 default automations) | 30m | `pnpm seed` |
| 3 | Core pipeline (provided in this repo): lib/, inngest/, api routes | 60m | wire up + local Inngest dev server test |
| 4 | Dispatch + Resend end-to-end: simulate-feed sends real email | 60m | screenshot inbox |
| 5 | Dashboard pages 1, 3, 4 (notices, automations, runs) | 120m | Claude Code, section 8 |
| 6 | Review queue page + approve action | 60m | Claude Code, section 8 item 2 |
| 7 | Eval script + dataset + /evals page | 45m | `pnpm eval` output |
| 8 | Sentry, auth polish, deploy to Vercel + Inngest cloud | 45m | live URL |
| 9 | README (architecture diagram, tradeoffs, production roadmap), Loom | 60m | application-ready |

Cut list if behind: /evals page (keep the CLI script), PDF upload route (webhook only), Sentry.

## 14. Demo script (Loom, ~2 min)

1. "Firms drown in court notices; here's one." Run `pnpm simulate-feed`.
2. Notices inbox fills. Open a clean Notice of Hearing: classification fields, confidence, reasoning.
3. Switch to the recipient inbox: two real emails, tokens filled.
4. Back to app: one notice sat down in Review. Correct the judge initials, Approve, watch runs fire.
5. Runs log: one sent, one failed (bad recipient), siblings unaffected.
6. Inngest dashboard: retries, step traces. "This is the production story."
7. `pnpm eval`: accuracy table. "Every review correction becomes a regression test."

## 15. README outline

Problem -> What it does (gif) -> Architecture diagram -> Why these choices (Inngest vs SQS, confidence gating, idempotency at the DB layer, multi-tenant RLS) -> What I'd build next for production (PII redaction before model calls, per-firm webhook secrets and rate limits, DLQ + alerting, notice-type taxonomy versioning, batch backfill, SOC 2 posture) -> Running locally -> Eval results.
