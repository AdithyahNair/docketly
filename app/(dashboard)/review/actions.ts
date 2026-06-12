"use server";

import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase-server";
import { inngest } from "@/inngest/client";
import { NOTICE_TYPES, type Classification, type NoticeType } from "@/lib/types";

export interface ReviewFormState {
  error: string | null;
}

// Every human correction becomes a regression test: append the corrected
// labels to the eval dataset. Best-effort — the filesystem is read-only on
// Vercel, and a failed append must never block an approval.
async function appendToEvalDataset(
  noticeId: string,
  text: string,
  expected: {
    notice_type: NoticeType;
    chapter: 7 | 13 | null;
    case_number: string | null;
    judge_initials: string | null;
  }
) {
  try {
    const path = join(process.cwd(), "evals", "dataset.json");
    const dataset: { id: string }[] = JSON.parse(await readFile(path, "utf-8"));
    const id = `review-${noticeId.slice(0, 8)}`;
    if (dataset.some((ex) => ex.id === id)) return;
    dataset.push({ id, text, expected } as (typeof dataset)[number]);
    await writeFile(path, JSON.stringify(dataset, null, 2) + "\n");
  } catch (err) {
    console.error("eval dataset append failed (non-fatal):", err);
  }
}

export async function approveNotice(
  noticeId: string,
  _prev: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const { supabase, user } = await requireUser();

  const noticeType = String(formData.get("notice_type") ?? "");
  if (!(NOTICE_TYPES as readonly string[]).includes(noticeType)) {
    return { error: "Pick a notice type." };
  }
  const chapterRaw = String(formData.get("chapter") ?? "");
  const caseNumber = String(formData.get("case_number") ?? "").trim();
  const judge = String(formData.get("judge_initials") ?? "").trim();
  const hearingRaw = String(formData.get("hearing_datetime") ?? "").trim();

  if (!caseNumber) {
    return { error: "A case number is required — automations need a matched case." };
  }

  const { data: notice } = await supabase
    .from("notices")
    .select("id, raw_text, status, classification")
    .eq("id", noticeId)
    .maybeSingle();
  if (!notice) return { error: "Notice not found." };
  if (notice.status !== "needs_review") {
    return { error: `Notice is ${notice.status}, not awaiting review.` };
  }

  // Dispatch requires a resolved case; re-resolve from the corrected number.
  const { data: caseRow } = await supabase
    .from("cases")
    .select("id")
    .eq("case_number", caseNumber)
    .maybeSingle();
  if (!caseRow) {
    return {
      error: `Case number ${caseNumber} doesn't match any case at this firm. Correct it, or mark the notice failed.`,
    };
  }

  const prior = (notice.classification ?? {}) as Partial<Classification>;
  const corrected: Classification = {
    notice_type: noticeType as NoticeType,
    chapter: chapterRaw === "7" ? 7 : chapterRaw === "13" ? 13 : null,
    case_number: caseNumber,
    judge_initials: judge ? judge.toUpperCase() : null,
    hearing_datetime: hearingRaw || null,
    confidence: prior.confidence ?? 0,
    reasoning: prior.reasoning ?? "",
  };

  // Guarding on status=needs_review makes a double-submit a no-op instead of a
  // second approval; the UNIQUE(automation_id, notice_id) constraint downstream
  // makes even a duplicate classified event fire nothing twice.
  const { data: updated, error } = await supabase
    .from("notices")
    .update({
      classification: corrected,
      case_id: caseRow.id,
      status: "classified",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", noticeId)
    .eq("status", "needs_review")
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "Notice was already reviewed." };

  await inngest.send({ name: "notice/classified", data: { noticeId } });

  await appendToEvalDataset(noticeId, notice.raw_text, {
    notice_type: corrected.notice_type,
    chapter: corrected.chapter,
    case_number: corrected.case_number,
    judge_initials: corrected.judge_initials,
  });

  revalidatePath("/review");
  revalidatePath("/notices");
  redirect("/review");
}

// Junk/unsalvageable notices: out of the queue, nothing fires, kept in the
// inbox as failed for audit (US-6).
export async function markNoticeFailed(noticeId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("notices")
    .update({
      status: "failed",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", noticeId)
    .eq("status", "needs_review");
  if (error) throw new Error(error.message);
  revalidatePath("/review");
  revalidatePath("/notices");
  redirect("/review");
}
