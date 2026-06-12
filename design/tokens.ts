// Semantic design tokens. Single source of truth for every meaning-bearing
// class string in the dashboard. Pages and components import from here;
// raw color classes (bg-amber-100 etc.) should not appear in page code.

// ---------------------------------------------------------------------------
// Tones: the five semantic colors. Every badge, banner, or accent maps a
// domain state to a tone here, never to a palette color directly.
// ---------------------------------------------------------------------------

export const TONES = {
  info: "bg-blue-100 text-blue-800 border-blue-200",
  success: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-red-100 text-red-800 border-red-200",
  neutral: "bg-neutral-100 text-neutral-600 border-neutral-200",
} as const;

export type Tone = keyof typeof TONES;

// ---------------------------------------------------------------------------
// Domain state → tone. Notice statuses (lib/types.ts NoticeRow.status) and
// automation run statuses (automation_runs.status) share one badge language:
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

// Display overrides for statuses whose DB value isn't presentable as-is.
export const STATUS_LABEL: Record<string, string> = {
  needs_review: "needs review",
};

// ---------------------------------------------------------------------------
// Typography recipes. The dashboard uses exactly these text styles; new
// pages should compose from this list before inventing another.
// ---------------------------------------------------------------------------

export const TEXT = {
  /** h1 on every dashboard page */
  pageTitle: "text-2xl font-semibold tracking-tight",
  /** the one-line explanation under every h1 */
  pageSubtitle: "text-sm text-muted-foreground",
  /** uppercase micro-label above a read-only field value */
  fieldLabel: "text-xs font-medium uppercase tracking-wide text-muted-foreground",
  /** case numbers and other court identifiers */
  identifier: "font-mono text-xs",
  /** the AI's one-sentence reasoning, always set off in italics */
  reasoning: "text-sm italic text-muted-foreground",
  /** raw notice text */
  sourceText: "whitespace-pre-wrap rounded-md bg-muted/50 p-4 font-mono text-xs leading-relaxed",
} as const;
