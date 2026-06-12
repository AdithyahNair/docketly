// Regex-first extraction for fields with rigid CM/ECF formats.
// The LLM classifies and confirms; deterministic parsing wins where it applies.

const NEAR_CASE = /case\s*(?:no\.?|number|#)?\s*:?\s*(\d{2})-(\d{4,5})(?:-([A-Za-z]{2,4}))?/i;
const ANYWHERE = /\b(\d{2})-(\d{4,5})(?:-([A-Za-z]{2,4}))?\b/;

export interface RegexExtraction {
  case_number: string | null;
  judge_initials: string | null;
}

export function extractCaseInfo(text: string): RegexExtraction {
  const m = text.match(NEAR_CASE) ?? text.match(ANYWHERE);
  if (!m) return { case_number: null, judge_initials: null };
  return {
    case_number: `${m[1]}-${m[2]}`,
    judge_initials: m[3] ? m[3].toUpperCase() : null,
  };
}
