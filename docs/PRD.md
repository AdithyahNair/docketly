# PRD: Docketly

Court notice automation for bankruptcy law firms.

| | |
|---|---|
| Status | Draft v1.0 |
| Author | Adithyah Nair |
| Date | June 12, 2026 |
| Related docs | BLUEPRINT.md (implementation), README.md (post-ship) |

---

## 1. Overview

Docketly is a standalone web application that automates what happens after a bankruptcy court notice arrives at a law firm. It ingests notices from a feed or manual upload, uses AI to classify each notice and extract its key facts, matches the classified notice against automation rules the firm configures, and sends templated emails to the right recipients. Any notice the AI is not confident about is held in a human review queue, and approving it fires the same automations on human-confirmed data.

The product thesis: notice handling is a high-volume, high-stakes, low-judgment task. The volume and repetition make it ideal for automation. The stakes (a missed hearing can cost a client their case) make a confidence-gated, human-in-the-loop design mandatory rather than optional.

## 2. Background and problem

Bankruptcy practices receive a continuous stream of documents from CM/ECF and PACER: hearing notices, Section 341 meeting notices, discharge orders, dismissal orders, deadline notices, and motions for relief from stay. In most small and mid-size firms, a paralegal or staff member triages this stream by hand. For each notice they must:

1. Identify what kind of notice it is.
2. Match it to the right case and client.
3. Decide who needs to know (client, attorney, both, sometimes a trustee or co-counsel).
4. Write or copy-paste an email with the right details (date, time, judge, location, consequences).

This work is repetitive, interrupt-driven, and unforgiving of error. The two failure modes are silence (a notice nobody acted on) and noise (a wrong or confusing email to a client). Firms compensate with checklists and redundancy, which costs staff hours and still leaks.

### Why now

LLMs are now reliable enough at document classification and extraction to handle the triage step, provided the system is honest about uncertainty. The design problem is no longer "can a model read a notice" but "how do you build the harness around the model so that wrong answers are caught before they reach a client."

## 3. Users and personas

**Priya, paralegal (primary user).** Owns the notice inbox today. Wants the routine 80 percent handled automatically and a short, trustworthy queue for the rest. Cares about: never missing a notice, seeing why the AI decided what it decided, fixing mistakes in seconds.

**Marcus, managing attorney (admin/buyer).** Configures the rules and is accountable for client communication quality. Wants control over exactly which notice types trigger which emails, to whom, with what wording. Cares about: audit trail, knowing every automation that fired and every one that failed, and being able to turn anything off instantly.

**Dana, client (indirect user).** Receives the emails. Never logs in. Cares about: clear, timely, accurate information about her case.

## 4. Goals

### Product goals

1. A clean, recognizable notice is classified, matched, and emailed with zero human touches, end to end in under 60 seconds from ingestion.
2. No automated email is ever sent on uncertain data. Confidence below threshold, unrecognized notice type, or an unmatched case number always routes to human review.
3. A reviewer can correct and approve a held notice in under 30 seconds.
4. Every automated action is auditable: which notice, which rule, which recipients, what was sent, what failed and why.
5. Classifier quality is measurable and regression-tested via a labeled eval set that grows from real reviewer corrections.

### Success metrics

| Metric | Target | How measured |
|---|---|---|
| Auto-handled rate | >= 70% of notices fully automated | notices classified / total |
| Classifier accuracy | >= 85% exact-match on eval set | pnpm eval, eval_runs table |
| False-fire rate | 0 automations fired on misclassified type | manual audit of runs vs corrected labels |
| Time to email | p95 < 60s ingestion to send | Inngest step timings |
| Review turnaround | median < 30s per held notice | reviewed_at minus created_at on needs_review notices |
| Duplicate fires | 0 | UNIQUE constraint violations are skips by design |

### Non-goals (v1)

- Live PACER/CM/ECF integration. Ingestion is webhook plus manual upload; the feed is simulated for the demo. Real PACER polling is a production roadmap item.
- E-filing, docketing, calendaring, or any write-back to court systems.
- SMS or in-app client notifications. Email only.
- Multi-firm onboarding flows. Schema is multi-tenant; UX serves one seeded firm.
- Notice types beyond the seven in the taxonomy. "Other" plus review absorbs the long tail.
- Editing or generating legal documents. Docketly reads notices; it never produces filings.

## 5. User stories and acceptance criteria

### Ingestion

- **US-1**: As a firm, I receive notices automatically via a webhook feed.
  - AC: POST /api/ingest with valid HMAC signature creates a notice and starts the pipeline. Invalid signature returns 401. Replayed payload returns 200 with deduped: true and creates nothing.
- **US-2**: As Priya, I can upload a notice PDF from the dashboard.
  - AC: Upload stores the PDF, extracts text, creates a notice with source=upload, starts the pipeline. Unparseable PDFs create a notice that routes to review with extraction failure noted.

### Classification

- **US-3**: As Priya, every ingested notice gets an AI classification with type, chapter, case number, judge, hearing datetime, confidence, and a one-sentence reasoning.
  - AC: Classification stored on the notice row. Confidence >= 0.8 AND known type AND case number resolved -> status classified. Otherwise status needs_review. Model/API failure after retries -> status failed with a visible retry action.
- **US-4**: As Marcus, I can see why a notice was held.
  - AC: Review queue shows the reasoning string and which gate failed (low confidence, unknown type, or unmatched case).

### Review

- **US-5**: As Priya, I can correct any classification field and approve.
  - AC: Approve saves corrections, records reviewed_by and reviewed_at, sets status classified, and fires automations on the corrected data. The correction is appended to the eval dataset.
- **US-6**: As Priya, I can reject a notice as junk.
  - AC: Mark failed removes it from the queue; nothing fires; the notice remains in the inbox with status failed for audit.

### Automations

- **US-7**: As Marcus, I can create a rule: when notice type X arrives (optionally filtered to chapter and judge), email these recipients with this template.
  - AC: Recipients support roles (Client, Attorney) and raw email addresses. Templates support tokens: client_name, case_number, notice_type, hearing_date, hearing_time, judge_initials, chapter, firm_name. A token reference is visible in the editor.
- **US-8**: As Marcus, I can disable a rule instantly.
  - AC: Disabled rules are never matched. Toggle takes effect on the next dispatched notice with no deploy or delay.
- **US-9**: As Marcus, the same notice never triggers the same rule twice.
  - AC: Enforced by UNIQUE(automation_id, notice_id). Pipeline retries and replays result in skips, not duplicate emails.
- **US-10**: As Marcus, one broken rule never blocks the others.
  - AC: A rule that fails (invalid recipient, send error) records a failed run with the error; sibling rules on the same notice still send.

### Observability and audit

- **US-11**: As Marcus, I can see every run: when, which rule, which notice, which recipients, sent or failed, and the error if failed.
  - AC: Runs page joined across runs, automations, notices. Each automation shows last run time and status in the list view.
- **US-12**: As the operator, I can see pipeline health.
  - AC: Errors in Sentry tagged with notice and automation ids. Inngest dashboard shows per-event traces and retries.

### Evals

- **US-13**: As the operator, I can measure classifier quality on demand.
  - AC: pnpm eval runs the live classifier on the labeled set, prints accuracy, per-type precision/recall, confusion matrix, and confidence calibration, exits nonzero below 85% accuracy, and records the run.

## 6. Functional requirements by area

### 6.1 Notice taxonomy (v1)

Notice of Hearing, Notice of 341 Meeting, Order of Discharge, Order of Dismissal, Notice of Deadline, Motion for Relief from Stay, Other. "Other" is a first-class outcome, not an error: it always routes to review and never matches a rule.

### 6.2 Confidence gating

Single threshold 0.8 in v1, applied uniformly. The system prompt instructs the model to be conservative and explains the asymmetry (wrong email is expensive, review is cheap). Per-type thresholds and auto-approve policies are a fast-follow (see Open Questions).

### 6.3 Recipient resolution

Roles resolve against the matched case: client -> client_email, attorney -> attorney_email. Raw emails pass through after format validation. An unresolvable role fails only that run.

### 6.4 Templates

Mustache-style double-brace tokens, plain text body v1 (Resend renders simple HTML wrapper). Missing token values render as empty string, never as the literal token. Hearing date and time render in the court's local convention (e.g. "July 9, 2026 at 10:00 AM").

### 6.5 Audit and data retention

Notices, classifications, corrections, and runs are never hard-deleted in v1. reviewed_by and reviewed_at capture the human accountability chain. The original raw_text and PDF are retained alongside any corrected classification so disagreements are reconstructable.

## 7. System design summary

Full detail in BLUEPRINT.md. One Next.js app on Vercel serves dashboard and API. Supabase provides Postgres (RLS, multi-tenant by firm_id), Auth, and PDF Storage. Inngest runs two durable functions: classify (notice/ingested) and dispatch (notice/classified). Anthropic claude-sonnet-4-6 performs classification through a forced tool call with a strict schema. Resend sends email. Sentry plus pino plus the Inngest dashboard cover observability.

Two database constraints carry the core guarantees: UNIQUE(firm_id, content_hash) on notices (ingestion dedup) and UNIQUE(automation_id, notice_id) on runs (at-most-once automation fires).

## 8. UX requirements

Five dashboard pages: Notices inbox, Review queue, Automations, Runs, Evals. Shared layout with sidebar nav. Key interactions:

- Inbox rows show status as a colored badge; confidence shown as a percentage with the gate outcome.
- Notice detail and review use a side-by-side layout: source text or PDF left, structured classification right.
- Review fields are pre-filled with the AI's answer; the reviewer edits only what is wrong.
- The automation editor shows a live token reference and a preview of the rendered email against a sample case.
- Empty states teach: an empty runs page explains how rules fire; an empty review queue says "Nothing needs your attention."

## 9. Security, privacy, compliance posture

- Webhook authenticated by HMAC SHA-256 over the raw body, constant-time comparison.
- RLS on all tables by firm_id; service-role key confined to server-side pipeline code.
- Court notices contain PII (names, addresses, case details). v1 sends notice text to the Anthropic API for classification; the README discloses this and the production roadmap includes PII redaction before model calls and zero-data-retention API configuration.
- No client-side exposure of any secret; all model and email calls are server-side.

## 10. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Misclassification fires a wrong email | Client confusion, firm liability | Confidence gate, conservative prompt, "Other" catch-all, review queue, eval regression gate |
| Dual write: notice inserted but pipeline event lost | Notice stuck in classifying forever | Sweeper cron re-emits events for notices stuck > 5 min (see Alternatives); Inngest retries cover the common case |
| Model API outage | Pipeline stalls | Inngest retries with backoff; failed status with manual retry; notices are never lost, only delayed |
| Garbled PDF extraction | Bad classification input | Low extraction quality routes to review; reviewer sees raw text and can act on the PDF directly |
| Template token typo by admin | Broken email content | Token reference in editor, rendered preview, unknown tokens render empty rather than leaking braces |
| Eval set too small to trust | False quality signal | Seed with 12+, grow from every review correction, report per-type sample sizes alongside scores |

## 11. Milestones

| Milestone | Scope | Target |
|---|---|---|
| M1 Pipeline | Ingestion, classification, dispatch, real email, idempotency proven | Hour 4 |
| M2 Dashboard | Inbox, automations CRUD, runs log | Hour 6.5 |
| M3 Human loop | Review queue, approve and correct flow | Hour 7.5 |
| M4 Quality | Eval script and dataset, evals page | Hour 8 |
| M5 Ship | Deploy, seed, README, Loom | End of day |

## 12. Open questions

1. ~~Regex-first case number extraction~~ Decided: in scope. Regex extracts case number and judge initials; the LLM classifies and confirms. Disagreement between regex and LLM lowers effective confidence and routes to review.
2. Per-type confidence thresholds and auto-approve policy: should low-risk types (Order of Discharge) auto-send at lower confidence while high-risk types (Notice of Hearing) require higher confidence or always review? v1 ships a single threshold; documented as fast-follow.
3. ~~Sweeper cron for the dual-write gap~~ Decided: in scope. A 5-minute Inngest cron re-emits events for notices stuck in classifying, making the pipeline self-healing. Safe because dispatch is idempotent at the database layer.
4. Should reviewer corrections also feed few-shot retrieval at classification time (similar corrected notices injected as examples), or remain eval-only in v1? Eval-only in v1; pgvector retrieval documented in the README roadmap.
5. ~~Final product name~~ Decided: Docketly.

## 13. Out-of-scope future direction

The honest production trajectory, useful for the application narrative: live PACER polling with per-district adapters, PII redaction pre-model, per-type auto-approve policies driven by observed calibration, multi-channel notification (SMS, client portal), generalization of the rule engine from flat filters to condition expressions, and eventually the inversion where notice automation becomes one trigger type inside a general trigger-action workflow engine, which is exactly Glade's architecture.

## 14. Implementation starting state (read before planning)

This repository is NOT empty. The core pipeline is already implemented, typechecked, and its deterministic logic is tested. Build around it; do not rewrite it.

### Already implemented (do not regenerate)

| Path | What it is |
|---|---|
| supabase/migrations/0001_init.sql | Full schema, RLS, the two UNIQUE constraints |
| lib/types.ts | Notice taxonomy, Classification contract, row types, threshold |
| lib/claude.ts | Anthropic classification, forced tool call, strict schema |
| lib/extract.ts | Regex-first case number and judge extraction |
| lib/pipeline.ts | classifyWithExtraction: regex + LLM merge, disagreement lowers confidence |
| lib/templates.ts | Token rendering, recipient resolution |
| lib/hash.ts, lib/supabase.ts | Content hashing, service-role client |
| inngest/client.ts, classify.ts, dispatch.ts, sweeper.ts | The three pipeline functions plus failure handler |
| app/api/ingest/route.ts | HMAC-verified webhook with DB-level dedup |
| app/api/notices/upload/route.ts | PDF upload, text extraction, storage |
| app/api/inngest/route.ts | Inngest serve handler |
| evals/dataset.json, evals/run.ts | 13 labeled examples, full eval harness |
| scripts/seed.ts, scripts/simulate-feed.ts | Demo data and HMAC-signed feed simulator |

### To be built

1. Next.js app shell: layout.tsx, globals, Tailwind, shadcn/ui init, Supabase auth (email magic link is fine), sidebar layout for the (dashboard) route group.
2. The five dashboard pages per section 8 and BLUEPRINT.md section 8: notices inbox, review queue (with the approve server action that emits notice/classified and appends the correction to the eval dataset), automations CRUD, runs log, evals page.
3. Supabase Storage bucket "notices" creation noted in setup docs.
4. Sentry wiring (optional, cut first if time-constrained).
5. README.md per BLUEPRINT.md section 15.

### Conventions

- Reads through server components with the user's Supabase client; writes through server actions. No new REST routes for CRUD.
- Path alias @/* maps to repo root.
- Never bypass the pipeline: UI actions that should trigger automations emit Inngest events; they never call Resend directly.
- The two DB invariants are sacred: UNIQUE(firm_id, content_hash) on notices, UNIQUE(automation_id, notice_id) on automation_runs. No code path may work around them.

### Verification gates

After every milestone: `npm run typecheck` passes. After dashboard work: `npm run build` passes. Pipeline end-to-end: `npm run seed`, start `npm run dev` plus `npm run inngest:dev`, then `npm run simulate-feed` and confirm 4 notices classify, 1 lands in review, and the replay returns deduped. Classifier quality: `npm run eval` passes the 85 percent gate (requires ANTHROPIC_API_KEY).
