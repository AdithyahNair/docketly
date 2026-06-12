// Semantic design tokens. Single source of truth for every meaning-bearing
// class string in the dashboard. Pages and components import from here;
// raw color classes should not appear in page code.
//
// Palette: warm Notion/Attio-style light theme from the design handoff
// (Docketly Redesign.html). Color values live in app/globals.css; these
// recipes reference them through the @theme color names.

// ---------------------------------------------------------------------------
// Tones: the five semantic colors, as soft pills (tinted bg + deep ink).
// Every badge, chip, or accent maps a domain state to a tone here, never to
// a palette color directly.
// ---------------------------------------------------------------------------

export const TONES = {
  info: "bg-status-blue-bg text-status-blue-ink",
  success: "bg-status-green-bg text-status-green-ink",
  warning: "bg-status-amber-bg text-status-amber-ink",
  danger: "bg-status-red-bg text-status-red-ink",
  neutral: "bg-muted text-ink-2",
} as const;

export type Tone = keyof typeof TONES;

// ---------------------------------------------------------------------------
// Domain state → tone. Notice statuses (lib/types.ts NoticeRow.status) and
// automation run statuses (automation_runs.status) share one pill language:
// blue = in flight, green = done, amber = needs a human, red = went wrong,
// neutral = intentionally skipped.
// ---------------------------------------------------------------------------

export const STATUS_TONE: Record<string, Tone> = {
  // notice statuses
  classifying: "info",
  classified: "success",
  needs_review: "warning",
  failed: "danger",
  // run statuses
  pending: "info",
  sent: "success",
  skipped: "neutral",
};

// Display labels: sentence case per the redesign ("Needs review", "Sent").
export const STATUS_LABEL: Record<string, string> = {
  classifying: "Classifying",
  classified: "Classified",
  needs_review: "Needs review",
  failed: "Failed",
  pending: "Pending",
  sent: "Sent",
  skipped: "Skipped",
};

// ---------------------------------------------------------------------------
// Typography recipes. Sizes are the design's exact px values.
// ---------------------------------------------------------------------------

export const TEXT = {
  /** h1 on every dashboard page */
  pageTitle: "text-[22px] font-semibold tracking-[-0.012em] leading-tight",
  /** the one-line explanation under every h1 */
  pageSubtitle: "mt-[5px] max-w-[560px] text-sm text-ink-2",
  /** form / read-only field label */
  fieldLabel: "mb-1.5 block text-[13px] font-medium",
  /** quiet helper line under a field or table */
  fieldHint: "mt-1.5 text-[12.5px] text-ink-2",
  /** case numbers and other court identifiers */
  identifier: "font-mono text-[12.5px] tabular-nums",
  /** card heading + its quiet description */
  cardTitle: "text-sm font-semibold",
  cardSub: "text-[13px] text-ink-2",
  /** raw notice text */
  sourceText:
    "whitespace-pre-wrap rounded-lg border bg-raised p-4 font-mono text-[12.5px] leading-[1.85]",
} as const;
