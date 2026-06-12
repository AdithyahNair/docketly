# Docketly: The Complete Walkthrough

A guided tour from first touch to last, for learning the product deeply before
demoing it. Every scene has three layers: **WHAT I DO** (the exact action),
**WHAT I SEE** (the UI and why), **WHAT JUST HAPPENED** (the code underneath,
with file paths and function names). Claims here match the implementation as
committed — when in doubt, the file wins.

Assumed starting state: signed-out browser, empty database (schema applied,
zero rows), `notices` storage bucket created, `npm run dev` and
`npm run inngest:dev` running locally (or the Vercel + Inngest Cloud pair in
production).

---

## Scene 1 — First touch, signed out

**WHAT I DO** — Open `http://localhost:3000/`.

**WHAT I SEE** — The login card: "Docketly — Court notice automation. Sign in
with a magic link." One email field, one button. I never see a flash of the
dashboard.

**WHAT JUST HAPPENED** — Two redirects, no page render in between:

1. `middleware.ts` runs on every non-API request (its `config.matcher`
   excludes `/api/*` and static assets — the pipeline routes authenticate
   themselves with HMAC and Inngest signing keys, not cookies). It builds a
   cookie-backed Supabase client, calls `supabase.auth.getUser()`, finds no
   user, and the path isn't `/login` or `/auth/*`, so it redirects to
   `/login`.
2. Had I been signed in, `app/page.tsx` would have done its only job:
   `redirect("/notices")`.

No tables were touched.

## Scene 2 — The magic link

**WHAT I DO** — Type my email, click "Send magic link", then open the link
from my inbox.

**WHAT I SEE** — The card swaps to "Check your email for a sign-in link"
(driven by `?sent=1` in the URL — the form is a server action that redirects,
so even this state is server-rendered). Clicking the emailed link bounces
through Supabase and lands me back in the app.

**WHAT JUST HAPPENED** —

- The form posts to the `sendMagicLink` server action defined inline in
  `app/login/page.tsx`. It calls `supabase.auth.signInWithOtp({ email,
  options: { emailRedirectTo: origin + "/auth/confirm" } })`. Supabase's
  mailer sends the link; Docketly's own code never sends auth email (and the
  UI never touches Resend — that is dispatch's monopoly).
- The link lands on `app/auth/confirm/route.ts` (`GET`). It accepts either
  flow: `?code=` → `supabase.auth.exchangeCodeForSession(code)` (PKCE), or
  `?token_hash=` + `?type=` → `supabase.auth.verifyOtp({ token_hash, type })`
  (`type` defaults to `email`). Either way the session cookie
  (`sb-<ref>-auth-token`) is written, and the route redirects to
  `/auth/bootstrap`.

Tables touched: only Supabase's internal `auth.*` schema.

## Scene 3 — The firm bootstrap (the RLS keystone)

**WHAT I DO** — Nothing. This happens inside the redirect chain.

**WHAT I SEE** — A brief hop through `/auth/bootstrap`, then the Notices page
(or, on a truly empty database, a bounce back to `/login` with the error "No
firm seeded. Run npm run seed first.").

**WHAT JUST HAPPENED** — Every RLS policy in
`supabase/migrations/0001_init.sql` keys on
`(auth.jwt() -> 'app_metadata' ->> 'firm_id')::uuid`, but a fresh magic-link
user has no `firm_id`. `app/auth/bootstrap/route.ts` closes the gap: if
`user.app_metadata.firm_id` is missing, it uses the service-role client
(`adminClient()` from `lib/supabase.ts`) to read the single seeded firm,
writes the claim with `auth.admin.updateUserById(user.id, { app_metadata:
{ firm_id } })`, then calls `supabase.auth.refreshSession()` so the *current*
JWT carries the claim immediately — without the refresh, every RLS read would
return empty rows until the token naturally rotated. This is a one-firm-demo
shortcut; multi-firm onboarding is an explicit v1 non-goal.

The guard also lives server-side for every later page: `requireUser()` in
`lib/supabase-server.ts` redirects to `/login` without a user and to
`/auth/bootstrap` without a `firm_id`.

Tables touched: `auth.users` (the `raw_app_meta_data` column).

## Scene 4 — Seeding, then the empty dashboard

**WHAT I DO** — Run `npm run seed` in a terminal. (On a truly empty database
this must happen *before* sign-in completes — Scene 3's bootstrap needs a
firm to claim. If I hit the "No firm seeded" bounce, I seed and click the
magic link again, or just revisit any page.)

**WHAT I SEE** — The sidebar shows the firm name "Hudson & Vance Bankruptcy
Law" and my email. Automations lists four enabled rules, each with "never"
under Last run. Every other page teaches its own empty state: the inbox says
to run `npm run simulate-feed`; Review says "Nothing needs your attention.";
Runs explains how rules fire; Evals points at `npm run eval`.

**WHAT JUST HAPPENED** — `scripts/seed.ts` (service-role client, bypasses
RLS) inserts: one row in `firms`, fifteen in `cases` (case numbers chosen to
match the eval dataset, e.g. `26-10342` Maria T. Alvarez, every
`client_email` and `attorney_email` pointed at `DEMO_INBOX` so demo sends are
visible in one inbox), and four in `automations`:

| Rule | Matches | Recipients |
|---|---|---|
| Hearing notice to client | Notice of Hearing | role: client |
| Hearing notice to attorney | Notice of Hearing | role: attorney |
| 341 meeting prep, Chapter 7 only | Notice of 341 Meeting + `match_chapter=7` | role: client |
| Discharge congratulations | Order of Discharge | client + attorney |

The dashboard reads all of this through the *user's* RLS-scoped client:
`app/(dashboard)/layout.tsx` fetches the firm name and the needs-review
count; `app/(dashboard)/automations/page.tsx` selects automations with their
latest `automation_runs` row joined (`limit(1, { referencedTable })`).

## Scene 5 — The feed arrives

**WHAT I DO** — `npm run simulate-feed`, then watch the Notices inbox.

**WHAT I SEE** — Terminal: five `202 { noticeId: ... }` lines, three seconds
apart, then one `200 { deduped: true }`. In the inbox: rows appear with a
blue `classifying` badge and flip to green `classified` within seconds —
except one, which turns amber `needs review`. Each classified row shows its
type, case number, and confidence like "97% all gates passed".

**WHAT JUST HAPPENED** — `scripts/simulate-feed.ts` reads five entries from
`evals/dataset.json` (four clean notices plus `ambiguous-01`, deliberately
OCR-garbled), signs each JSON body with
`createHmac("sha256", WEBHOOK_SECRET)` and posts it to `/api/ingest` with the
hex digest in the `x-docketly-signature` header. Then it re-sends the first
payload byte-for-byte.

`app/api/ingest/route.ts` (`POST`) does four things and nothing else:

1. **Verify** — recomputes the HMAC over the raw body and compares with
   `timingSafeEqual` (constant-time; a length mismatch short-circuits safely).
   Bad or missing signature → 401 before anything is read.
2. **Dedup + insert** — inserts into `notices` with
   `content_hash = sha256(text.trim())` (`lib/hash.ts` `contentHash`) and
   `status='classifying'`. The insert + `.select("id").maybeSingle()` returns
   no row when `UNIQUE(firm_id, content_hash)` rejects it.
3. **Enqueue** — `inngest.send({ name: "notice/ingested", data: { noticeId } })`.
4. **Return 202** — the request path never waits on AI; classification
   latency lives entirely in Inngest.

## Scene 6 — The replay (dedup proven)

**WHAT I DO** — Nothing extra; the simulator's last request *is* the replay.
(To do it by hand: re-run `simulate-feed`, or curl the same body + signature
twice.)

**WHAT I SEE** — `200 { deduped: true }` — not an error, not a sixth row. The
inbox still shows exactly five notices.

**WHAT JUST HAPPENED** — Same route, same code path, but the
`UNIQUE(firm_id, content_hash)` constraint rejected the insert, so
`maybeSingle()` yielded `null` and the route returned
`{ deduped: true }` with **200** — a constraint violation is a skip by
design, never an error to retry around. Crucially, no Inngest event is
emitted for a deduped payload, so nothing downstream can double-fire either.

## Scene 7 — Classification: regex + LLM, then three gates

**WHAT I DO** — Nothing; this is the async half of Scene 5. (Watchable live
at `http://localhost:8288` → Runs.)

**WHAT I SEE** — In the Inngest dev UI, each `notice/ingested` event runs the
`classify-notice` function with visible steps: `load-notice` → `classify` →
`resolve-case` → `route`, and for passing notices a final `emit-classified`
send.

**WHAT JUST HAPPENED** — `inngest/classify.ts` (`classify`, event
`notice/ingested`, `retries: 3`):

1. `load-notice` fetches the row; if `status !== 'classifying'` the function
   returns `{ skipped: true }` — this is what makes sweeper re-emits and
   duplicate events harmless.
2. `classify` calls `classifyWithExtraction(raw_text)` from
   `lib/pipeline.ts`, which is the *production path* (also what the eval
   measures):
   - `extractCaseInfo` (`lib/extract.ts`) regexes the case number and judge
     suffix (`26-10342-MEW` → `26-10342` + `MEW`), preferring a match near
     the word "case".
   - `classifyNotice` (`lib/claude.ts`) makes one `claude-sonnet-4-6` call
     with a **forced tool call** (`tool_choice: { type: "tool", name:
     "record_classification" }`) against a strict schema — the model cannot
     reply in prose. The system prompt states the asymmetry outright: a wrong
     email is expensive, review is cheap, so confidence must drop below 0.8
     when the case number is unreadable or the type is inferred. An
     out-of-taxonomy type from the model is coerced to `Other` with
     confidence capped at 0.5.
   - The merge: regex wins on `case_number` and `judge_initials` where it
     matched; a regex/LLM disagreement on case number caps confidence at 0.6
     and appends a note to `reasoning`. Finally, any merged case number that
     fails `/^\d{2}-\d{4,5}$/` (OCR garble like `26-10?42`) is **discarded to
     null** with a "not a valid format; discarded" note — it could never
     resolve against `cases` anyway, so the gate gets a clean signal.
3. `resolve-case` looks up `cases` by `(firm_id, case_number)`.
4. `route` computes the three gates — `confidence >= CONFIDENCE_THRESHOLD`
   (0.8, from `lib/types.ts`), `notice_type !== "Other"`, `caseId !== null` —
   and updates the notice to `classified` (all pass) or `needs_review` (any
   fail). The update is guarded with `.eq("status", "classifying")`.
5. Only if all gates passed: `step.sendEvent("emit-classified", ...)` emits
   `notice/classified`.

Tables touched: `notices` (classification jsonb, `case_id`, `status`).

## Scene 8 — A clean notice dispatches

**WHAT I DO** — Open the `DEMO_INBOX` mailbox.

**WHAT I SEE** — Real emails: "Hearing scheduled in your case 26-10342" with
the date, time, and judge filled in ("July 9, 2026 at 10:00 AM before Judge
MEW"); the attorney variant; the 341-prep email; the discharge
congratulations. No literal `{{braces}}` anywhere.

**WHAT JUST HAPPENED** — `inngest/dispatch.ts` (`dispatch`, event
`notice/classified`, `retries: 3`):

1. `load-context` loads the notice, its case, the firm name, and all
   **enabled** automations for the firm (a disabled rule is filtered out in
   this query — the toggle takes effect on the very next dispatch).
2. **Matching** is three predicates: exact `match_notice_type`, chapter
   filter (`null` = any), judge filter (`null` = any, compared
   case-insensitively on initials). The hearing notice matches two rules; the
   341 notice matches one (its `match_chapter=7` filter passes).
3. Per match, inside `step.run("run-<automationId>")` with its own try/catch:
   - **Idempotent insert** — `INSERT INTO automation_runs (automation_id,
     notice_id, status='pending')` with `.select("id").maybeSingle()`. If
     `UNIQUE(automation_id, notice_id)` rejects it, no row comes back and the
     automation is reported `skipped` — this is the at-most-once guarantee,
     and it's why Inngest retries and replayed events can never double-send.
   - **Recipient resolution** — `resolveRecipients` (`lib/templates.ts`):
     role `client` → `case.client_email`, role `attorney` →
     `case.attorney_email`, raw emails pass through; everything is
     format-validated, deduplicated, and an unresolvable role throws — which
     fails *this run only*.
   - **Token rendering** — `buildTokenContext` formats
     `hearing_date`/`hearing_time` in US conventions and stringifies the
     eight tokens; `renderTemplate` replaces `{{token}}` and renders unknown
     tokens as empty string, never literal braces.
   - **Send** — `new Resend(...).emails.send(...)`; success records
     `status='sent'` + `resend_email_id`, a thrown error records
     `status='failed'` + the message, and the loop continues to the next
     automation (failure isolation: one bad rule never blocks siblings).

Tables touched: `automation_runs` (one row per matched rule).

## Scene 9 — The garbled notice lands in review

**WHAT I DO** — Click "Review" in the sidebar (it shows an amber `1` badge).

**WHAT I SEE** — One queued row: AI guess "Other", confidence 30%, and three
amber "held because" badges — `low confidence (30% < 80%)`, `unknown type`,
`unmatched case` — plus the model's one-sentence reasoning about degraded OCR
quality (ending with the appended note that the garbled case number was
discarded).

**WHAT JUST HAPPENED** — Nothing fired for this notice — `classify` stopped
at the gates and never emitted `notice/classified`. The queue page
(`app/(dashboard)/review/page.tsx`) selects `status='needs_review'` rows, and
`gateFailures` in `lib/gates.ts` re-derives *which* gate failed from the
stored classification + `case_id`, mirroring the pipeline's gate logic so the
UI never invents its own. The sidebar badge is the count query in
`app/(dashboard)/layout.tsx`.

## Scene 10 — Reading a notice in full

**WHAT I DO** — From the inbox, click any classified notice's row.

**WHAT I SEE** — `app/(dashboard)/notices/[id]/page.tsx`: source text left
(monospace, scrollable; an "Open PDF" link appears for uploads), labeled
classification fields right (type, chapter, case number with client name,
judge, hearing, confidence with gate outcome, italic AI reasoning), and below,
every automation run this notice produced with status badges and Resend ids.

**WHAT JUST HAPPENED** — Pure server-component reads through the user's
RLS-scoped client: the notice with its case joined, plus `automation_runs`
with the automation name joined. The PDF link is a 1-hour signed URL minted
server-side with the service-role client
(`adminClient().storage.from("notices").createSignedUrl(...)`) — the bucket
is private and the browser never holds a key.

## Scene 11 — Correct and approve (the human loop)

**WHAT I DO** — Open the held notice from Review. Change Notice type to
"Notice of Hearing", Chapter to 13, Case number to `26-10342`, Judge to
`MEW`, set the hearing datetime. Click **Approve & run automations**.

**WHAT I SEE** — Same side-by-side layout as the detail page, but the right
column is an editable form pre-filled with the AI's answers — I fix only
what's wrong. On approve I land back on an empty queue ("Nothing needs your
attention."), and within seconds two new hearing emails arrive. If I'd typed
a case number that matches no case, the form would have shown "Case number
X doesn't match any case at this firm" and saved nothing.

**WHAT JUST HAPPENED** — The `approveNotice` server action in
`app/(dashboard)/review/actions.ts`, the densest single path in the app:

1. Validates the type against `NOTICE_TYPES` and requires a case number
   (dispatch cannot run caseless).
2. **Re-resolves** the corrected case number against `cases` — the reviewer's
   correction must land on a real case or the approve is rejected with a
   field error.
3. Updates the notice: corrected `classification`, resolved `case_id`,
   `status='classified'`, `reviewed_by` (my auth user id), `reviewed_at` —
   through the *user's* client, so RLS applies even to approvals. The update
   is guarded by `.eq("status", "needs_review")`; a double-submit finds zero
   rows and returns "Notice was already reviewed."
4. Emits `notice/classified` via `inngest.send` — the **same event** the
   pipeline emits, so approval rides the identical dispatch path. The UI
   never calls Resend.
5. Appends `{ id: "review-<8 chars>", text, expected }` to
   `evals/dataset.json` — every human fix becomes a regression test. It's
   best-effort in a try/catch (Vercel's filesystem is read-only; a failed
   append never blocks an approval) and skips if the id already exists.

The sibling action `markNoticeFailed` handles junk: `status='failed'` with
`reviewed_by/at` recorded, nothing fires, the notice stays in the inbox for
audit. (The "Mark failed" button submits with `formNoValidate`, so a junk
notice with no case number can still be rejected.)

Caveat learned the hard way: if the source text is genuinely the *same
garbled scan* used by an existing dataset entry labeled `Other`, the append
creates a contradictory example and drags eval accuracy down. Curate the
dataset after demo corrections.

## Scene 12 — The runs log, including a failure

**WHAT I DO** — Open `/runs`. Then, to manufacture a realistic failure: edit
"Discharge congratulations" and add a raw recipient like
`someone@example.com` (format-valid, but the sandbox `onboarding@resend.dev`
sender can only deliver to the account owner's email), and ingest a fresh
discharge notice.

**WHAT I SEE** — Every fire across the firm, newest first: time, automation
name, notice type + case number linking back to the notice, recipient
summary, status badge, and the Resend email id on sent rows. After the
manufactured failure: a red `failed` row carrying Resend's error message —
while the *sibling* discharge email to the client still shows `sent`.

**WHAT JUST HAPPENED** — `app/(dashboard)/runs/page.tsx` is one RLS-scoped
query joining `automation_runs` ← `automations` (name, recipients) and
`notices` (classification). The failed row exists because dispatch's
per-automation try/catch caught the Resend error and recorded
`status='failed'` + `error` on that run row, then moved on (US-10). The RLS
policy on `automation_runs` is read-only for users and scoped via an EXISTS
on the parent notice's firm.

## Scene 13 — The upload path

**WHAT I DO** — Back in the inbox, click **Upload PDF** and pick a notice
PDF.

**WHAT I SEE** — The row appears with source `upload` instead of `webhook`
and flows through the same badge lifecycle. On its detail page, "Open PDF"
shows the original document. An unreadable scan classifies as `Other` at
rock-bottom confidence and joins the review queue — where I can read the PDF
myself and correct from it.

**WHAT JUST HAPPENED** — The `UploadButton` client component
(`components/upload-button.tsx`) posts multipart form data to the existing
`app/api/notices/upload/route.ts`, which: parses text with `pdf-parse`
(importing `pdf-parse/lib/pdf-parse.js` directly to dodge the package's
debug-on-import entry point), stores the PDF in the private `notices` bucket,
inserts the notice with `source='upload'`, `pdf_path`, and the same
content-hash dedup (an unparseable PDF gets the placeholder text
`[unextractable PDF: <name>]` so the hash is still deterministic), and emits
`notice/ingested`. From there the pipeline is identical to the webhook path.

## Scene 14 — Failure recovery: retries, the failed status, the sweeper

**WHAT I DO** — (To stage it: kill the Anthropic key in `.env.local`,
restart dev, ingest a notice, watch it fail; restore the key, then click
**Retry classification** on the notice's detail page.)

**WHAT I SEE** — In the Inngest UI: the `classify` step throws, retries with
backoff (3 attempts), then the run is marked failed — and the notice's inbox
badge flips to red `failed` with a Retry button on its detail page. After
retry: blue `classifying`, then the normal outcome.

**WHAT JUST HAPPENED** — Three cooperating mechanisms in `inngest/`:

- **Retries** — `classify` is declared with `retries: 3`; a thrown error in
  the `classify` step (model outage, rate limit) re-runs with backoff, and
  step memoization means `load-notice` isn't re-fetched.
- **The failure handler** — `onClassifyFailure` (`inngest/classify.ts`)
  listens to Inngest's own `inngest/function.failed` event filtered with
  `if: "event.data.function_id == 'classify-notice'"`, and sets the notice to
  `failed` — guarded by `.eq("status", "classifying")` so it can't clobber a
  notice that recovered meanwhile. Notices are never lost, only delayed.
- **The retry button** — `retryNotice` in
  `app/(dashboard)/notices/actions.ts` flips `failed` back to `classifying`
  (guarded `.eq("status", "failed")`) and re-emits `notice/ingested`.
- **The sweeper** — `inngest/sweeper.ts` runs on cron `*/5 * * * *` and
  re-emits `notice/ingested` for up to 50 notices stuck in `classifying`
  older than 5 minutes. This closes the dual-write gap: a notice row inserted
  but whose event was lost (process died between insert and emit) heals
  itself. Re-emission is safe end to end because classify skips
  non-`classifying` notices and dispatch is idempotent at the DB layer.

## Scene 15 — Evals: measuring the classifier

**WHAT I DO** — Run `npm run eval` (needs `ANTHROPIC_API_KEY`), then open
`/evals`.

**WHAT I SEE** — Terminal: a dot-per-example progress line, exact-match
accuracy (currently 13/13 = 100%), mean confidence on correct vs incorrect
answers (the calibration signal — high/low spread means the 0.8 gate is
load-bearing), per-type precision/recall with sample sizes, any confusion
pairs, and `PASS (threshold 85%)`. The page shows the latest run as a
headline card (green ≥85%, red below), the per-type table, confusion list,
and a bar-per-run history.

**WHAT JUST HAPPENED** — `evals/run.ts` runs `classifyWithExtraction` — the
full production path, regex merge and all, not the raw model — over every
`evals/dataset.json` entry, comparing all four fields (type, chapter, case
number, judge) for exact match. It exits 1 below 0.85 so it can gate a deploy
in CI, and inserts a row into `eval_runs` when Supabase env is present.
`app/(dashboard)/evals/page.tsx` reads `eval_runs` (RLS: any authenticated
user) and computes precision/recall from the stored tp/fp/fn counts.

## Scene 16 — Where the dashboards fit

**WHAT I DO** — Keep `http://localhost:8288` (Inngest dev) open while
demoing; in production, the Inngest Cloud dashboard and Vercel's function
logs.

**WHAT I SEE** — Inngest: every event (`notice/ingested`,
`notice/classified`), every function run with step-by-step traces, timings,
payloads, retry attempts, and the sweeper firing on schedule — this is the
pipeline's flight recorder, and the strongest 30 seconds of the demo.
Vercel: request logs for the three API routes (the 401 on a bad HMAC
signature shows up here) and server-action invocations.

**WHAT JUST HAPPENED** — `app/api/inngest/route.ts` serves all four
functions (`classify`, `onClassifyFailure`, `dispatch`, `sweeper`) to
whichever Inngest backend is configured — the dev server locally, Inngest
Cloud in production (authenticated by `INNGEST_SIGNING_KEY`). The dashboards
are observability over the same code paths, not separate systems.

---

## Appendix A — Self-quiz (10 questions an interviewer might ask)

**1. How do you guarantee the same notice never emails twice, even if
Inngest retries dispatch mid-run?**
`UNIQUE(automation_id, notice_id)` on `automation_runs`
(`supabase/migrations/0001_init.sql`). Dispatch inserts the run row *first*
(`inngest/dispatch.ts`, inside `step.run("run-<id>")`); on retry the insert
returns no row and the automation is skipped. Idempotency lives in the
database, not in application memory, so it survives crashes, retries, and
replayed events alike.

**2. What stops a replayed webhook from creating a duplicate notice?**
`UNIQUE(firm_id, content_hash)` on `notices`, with the hash computed as
sha256 of trimmed text (`lib/hash.ts`). `app/api/ingest/route.ts` treats the
rejected insert as success: `200 { deduped: true }`, and emits no event, so
nothing downstream runs at all.

**3. Walk me through the three routing gates and where they're enforced.**
In `inngest/classify.ts`, after `resolve-case`:
`confidence >= CONFIDENCE_THRESHOLD` (0.8, `lib/types.ts`),
`notice_type !== "Other"`, and `caseId !== null`. All three must pass to set
`status='classified'` and emit `notice/classified`; any failure routes to
`needs_review` and stops. The review UI re-derives the failed gate with
`gateFailures` in `lib/gates.ts` rather than storing it redundantly.

**4. Why regex *and* an LLM for extraction?**
`lib/pipeline.ts` `classifyWithExtraction`: deterministic parsing wins where
formats are rigid (`lib/extract.ts` handles `26-10342-MEW`), the LLM
classifies and confirms. Disagreement on case number caps confidence at 0.6 —
disagreement is itself a signal — and a merged case number failing
`/^\d{2}-\d{4,5}$/` is nulled with a note. The eval runs this merged path, so
the score measures production, not the raw model.

**5. How does a wrong AI answer get fixed, and what does the fix trigger?**
`approveNotice` in `app/(dashboard)/review/actions.ts`: re-resolves the
corrected case number against `cases` (rejecting unmatched), updates the
notice with corrections + `reviewed_by/reviewed_at` + `status='classified'`
through the RLS-scoped client, emits the same `notice/classified` event the
pipeline uses, and appends the correction to `evals/dataset.json` as a future
regression test. Dispatch then fires on human-confirmed data.

**6. One automation has a bad recipient. What happens to the others?**
Each matched automation runs in its own try/catch inside its own Inngest step
(`inngest/dispatch.ts`). `resolveRecipients` (`lib/templates.ts`) throws for
an unresolvable role or invalid email; that run is recorded
`status='failed'` with the error, and the loop continues — siblings send.

**7. A notice row exists but its Inngest event was lost. How does the system
recover?**
`inngest/sweeper.ts`: a 5-minute cron re-emits `notice/ingested` for notices
stuck in `classifying` older than 5 minutes. Safe because `classify` returns
`{ skipped: true }` for any notice not in `classifying`
(`inngest/classify.ts`) and dispatch is DB-idempotent (Q1).

**8. How is the webhook authenticated, and why that way?**
HMAC-SHA256 over the *raw* request body with a shared secret, compared with
`crypto.timingSafeEqual` (`app/api/ingest/route.ts`, `verifySignature`).
Signing the raw body prevents tampering without key possession;
constant-time comparison prevents timing side-channels; verification happens
before any parsing or DB work.

**9. How does multi-tenancy work when the demo has one firm?**
Every table carries `firm_id` with RLS enabled
(`supabase/migrations/0001_init.sql`); policies key on the JWT's
`app_metadata.firm_id`, which `app/auth/bootstrap/route.ts` assigns on first
login. Dashboard reads/writes use the user's cookie-scoped client
(`lib/supabase-server.ts`), so RLS applies; only pipeline code (Inngest
functions, API routes) uses the service-role client (`lib/supabase.ts`),
which is never shipped client-side.

**10. Why is `UI never calls Resend` a rule rather than a preference?**
Because the email path must be single, audited, and idempotent. Routing every
send through `notice/classified` → `inngest/dispatch.ts` means each send is
preceded by the unique run-row insert (Q1), recorded in `automation_runs`,
isolated per-rule, and visible in the runs log and Inngest traces. A UI
shortcut would bypass all four guarantees at once — so review approval emits
the event (`app/(dashboard)/review/actions.ts`) instead of sending anything.

## Appendix B — Reset the demo stage

Goal: keep the firm, cases, and the four seeded automations; clear all
notices, runs, and eval history so the demo starts fresh.

**1. Clear pipeline data (Supabase SQL editor):**

```sql
-- automation_runs cascades from notices (notice_id ON DELETE CASCADE),
-- but delete it explicitly for clarity:
delete from automation_runs;
delete from notices;
delete from eval_runs;  -- optional: clears the /evals history
```

**2. Restore the eval dataset** (drop any `review-*` entries appended by demo
approvals):

```bash
git checkout -- evals/dataset.json
```

**3. Clear uploaded PDFs** (only if the upload path was demoed) — Supabase
Dashboard → Storage → `notices` → select all → delete. Webhook notices store
no files.

**4. Undo any demo automation edits** (e.g. the bad recipient from Scene 12)
by hand in `/automations`. Don't `delete from automations` selectively —
`scripts/seed.ts` inserts a *new firm* every run, so the seeded rules can't
be re-created in isolation; if the rules are mangled beyond hand-repair, do
the full wipe in step 5.

**5. Nuclear option — wipe everything and reseed:**

```sql
delete from automation_runs;
delete from notices;
delete from automations;
delete from cases;
delete from firms;
delete from eval_runs;
```

```bash
npm run seed
```

⚠️ After a full wipe + reseed, the new firm has a **new id**, but existing
auth users still carry the *old* `firm_id` in `app_metadata` — every RLS read
will come back empty and the dashboard will look broken. Repoint them:

```sql
update auth.users
set raw_app_meta_data =
  raw_app_meta_data || jsonb_build_object('firm_id', (select id from firms limit 1));
```

…then sign out and back in (or wait for token refresh) so the JWT picks up
the new claim.

**6. Sanity check the stage:** inbox empty with its teaching empty state,
Review shows "Nothing needs your attention.", Automations shows 4 enabled
rules with "never", Runs and Evals show their empty states. Then
`npm run simulate-feed` and the curtain rises.
