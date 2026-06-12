import { inngest } from "./client";
import { adminClient } from "@/lib/supabase";
import { classifyWithExtraction } from "@/lib/pipeline";
import { CONFIDENCE_THRESHOLD, Classification, NoticeRow } from "@/lib/types";

export const classify = inngest.createFunction(
  { id: "classify-notice", retries: 3 },
  { event: "notice/ingested" },
  async ({ event, step }) => {
    const db = adminClient();

    const notice = await step.run("load-notice", async () => {
      const { data, error } = await db
        .from("notices")
        .select("*")
        .eq("id", event.data.noticeId)
        .single();
      if (error || !data) throw new Error(`Notice not found: ${event.data.noticeId}`);
      return data as NoticeRow;
    });

    // Idempotency: a re-emitted event (sweeper, retry) for an already-routed
    // notice is a no-op. Only 'classifying' notices proceed.
    if (notice.status !== "classifying") {
      return { skipped: true, status: notice.status };
    }

    const classification = await step.run("classify", () =>
      classifyWithExtraction(notice.raw_text)
    ) as Classification;

    const caseId = await step.run("resolve-case", async () => {
      if (!classification.case_number) return null;
      const { data } = await db
        .from("cases")
        .select("id")
        .eq("firm_id", notice.firm_id)
        .eq("case_number", classification.case_number)
        .maybeSingle();
      return data?.id ?? null;
    });

    const gates = {
      confident: classification.confidence >= CONFIDENCE_THRESHOLD,
      knownType: classification.notice_type !== "Other",
      caseResolved: caseId !== null,
    };
    const passed = gates.confident && gates.knownType && gates.caseResolved;

    await step.run("route", async () => {
      const { error } = await db
        .from("notices")
        .update({
          classification,
          case_id: caseId,
          status: passed ? "classified" : "needs_review",
        })
        .eq("id", notice.id)
        .eq("status", "classifying");
      if (error) throw error;
    });

    if (passed) {
      await step.sendEvent("emit-classified", {
        name: "notice/classified",
        data: { noticeId: notice.id },
      });
    }

    return { noticeId: notice.id, passed, gates, confidence: classification.confidence };
  }
);

export const onClassifyFailure = inngest.createFunction(
  { id: "classify-notice-failed" },
  { event: "inngest/function.failed", if: "event.data.function_id == 'classify-notice'" },
  async ({ event }) => {
    const noticeId = (event.data.event as { data?: { noticeId?: string } })?.data?.noticeId;
    if (!noticeId) return;
    await adminClient()
      .from("notices")
      .update({ status: "failed" })
      .eq("id", noticeId)
      .eq("status", "classifying");
  }
);
