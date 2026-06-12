import { Classification, CONFIDENCE_THRESHOLD } from "@/lib/types";

// Mirrors the routing gates in inngest/classify.ts so the UI can show
// why a notice was held without re-deriving pipeline logic ad hoc.
export function gateFailures(c: Classification | null, caseId: string | null): string[] {
  if (!c) return ["no classification"];
  const failures: string[] = [];
  if (c.confidence < CONFIDENCE_THRESHOLD) {
    failures.push(`low confidence (${Math.round(c.confidence * 100)}% < ${CONFIDENCE_THRESHOLD * 100}%)`);
  }
  if (c.notice_type === "Other") failures.push("unknown type");
  if (caseId === null) failures.push("unmatched case");
  return failures;
}
