import { Resend } from "resend";
import { inngest } from "./client";
import { adminClient } from "@/lib/supabase";
import { buildTokenContext, renderTemplate, resolveRecipients } from "@/lib/templates";
import { AutomationRow, CaseRow, Classification, NoticeRow } from "@/lib/types";

export const dispatch = inngest.createFunction(
  { id: "dispatch-automations", retries: 3 },
  { event: "notice/classified" },
  async ({ event, step }) => {
    const db = adminClient();

    const ctx = await step.run("load-context", async () => {
      const { data: notice } = await db
        .from("notices")
        .select("*")
        .eq("id", event.data.noticeId)
        .single();
      if (!notice || !notice.case_id || !notice.classification) {
        throw new Error(`Notice ${event.data.noticeId} not dispatchable`);
      }
      const [{ data: caseRow }, { data: firm }, { data: automations }] = await Promise.all([
        db.from("cases").select("*").eq("id", notice.case_id).single(),
        db.from("firms").select("name").eq("id", notice.firm_id).single(),
        db.from("automations").select("*").eq("firm_id", notice.firm_id).eq("enabled", true),
      ]);
      if (!caseRow || !firm) throw new Error("Case or firm missing");
      return {
        notice: notice as NoticeRow,
        caseRow: caseRow as CaseRow,
        firmName: firm.name as string,
        automations: (automations ?? []) as AutomationRow[],
      };
    });

    const c = ctx.notice.classification as Classification;
    const matches = ctx.automations.filter(
      (a) =>
        a.match_notice_type === c.notice_type &&
        (a.match_chapter === null || a.match_chapter === c.chapter) &&
        (a.match_judge === null ||
          a.match_judge.toUpperCase() === (c.judge_initials ?? "").toUpperCase())
    );

    const results: Array<{ automation: string; status: string; error?: string }> = [];

    for (const automation of matches) {
      // Each automation runs in its own step with its own error boundary:
      // one bad recipient never blocks the siblings (failure isolation),
      // and the UNIQUE(automation_id, notice_id) insert makes retries
      // skip anything that already ran (idempotency).
      const result = await step.run(`run-${automation.id}`, async () => {
        const { data: inserted } = await db
          .from("automation_runs")
          .insert({ automation_id: automation.id, notice_id: ctx.notice.id, status: "pending" })
          .select("id")
          .maybeSingle();

        if (!inserted) return { status: "skipped" as const };

        try {
          const recipients = resolveRecipients(automation.recipients, ctx.caseRow);
          const tokens = buildTokenContext(c, ctx.caseRow, ctx.firmName);
          const resend = new Resend(process.env.RESEND_API_KEY);
          const { data: email, error: sendError } = await resend.emails.send({
            from: process.env.EMAIL_FROM ?? "Docketly <onboarding@resend.dev>",
            to: recipients,
            subject: renderTemplate(automation.subject_template, tokens),
            text: renderTemplate(automation.body_template, tokens),
          });
          if (sendError) throw new Error(sendError.message);

          await db
            .from("automation_runs")
            .update({ status: "sent", resend_email_id: email?.id ?? null })
            .eq("id", inserted.id);
          return { status: "sent" as const };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await db
            .from("automation_runs")
            .update({ status: "failed", error: message })
            .eq("id", inserted.id);
          return { status: "failed" as const, error: message };
        }
      });
      results.push({ automation: automation.name, ...result });
    }

    return { noticeId: ctx.notice.id, matched: matches.length, results };
  }
);
