import { classifyNotice } from "./claude";
import { extractCaseInfo } from "./extract";
import { Classification } from "./types";

// The real classification path: regex first, LLM classifies and confirms.
// Used by both the Inngest classify function and the eval harness, so evals
// measure the production path rather than the raw model.
export async function classifyWithExtraction(rawText: string): Promise<Classification> {
  const regex = extractCaseInfo(rawText);
  const llm = await classifyNotice(rawText);

  const merged: Classification = { ...llm };
  const notes: string[] = [];

  if (regex.case_number) {
    if (llm.case_number && llm.case_number !== regex.case_number) {
      merged.confidence = Math.min(merged.confidence, 0.6);
      notes.push(`Regex (${regex.case_number}) and model (${llm.case_number}) disagree on case number.`);
    }
    merged.case_number = regex.case_number;
  }
  if (regex.judge_initials) {
    if (llm.judge_initials && llm.judge_initials.toUpperCase() !== regex.judge_initials) {
      notes.push(`Regex (${regex.judge_initials}) and model (${llm.judge_initials}) disagree on judge.`);
    }
    merged.judge_initials = regex.judge_initials;
  }
  if (notes.length) merged.reasoning = `${llm.reasoning} ${notes.join(" ")}`.trim();
  return merged;
}
