import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase";
import { gateFailures } from "@/lib/gates";
import { fmtConfidence, fmtDateTime } from "@/lib/format";
import type { Classification } from "@/lib/types";
import { TEXT } from "@/design/tokens";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Callout } from "@/design/patterns/callout";
import { Field } from "@/design/patterns/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { retryNotice } from "../actions";

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: notice } = await supabase
    .from("notices")
    .select("*, cases(case_number, client_name)")
    .eq("id", id)
    .maybeSingle();
  if (!notice) notFound();

  const { data: runs } = await supabase
    .from("automation_runs")
    .select("id, status, error, resend_email_id, created_at, automations(name)")
    .eq("notice_id", id)
    .order("created_at", { ascending: false });

  const c = notice.classification as Classification | null;
  const failures = gateFailures(c, notice.case_id);

  let pdfUrl: string | null = null;
  if (notice.pdf_path) {
    const { data: signed } = await adminClient()
      .storage.from("notices")
      .createSignedUrl(notice.pdf_path, 3600);
    pdfUrl = signed?.signedUrl ?? null;
  }

  return (
    <div>
      <Link
        href="/notices"
        className="-ml-2 mb-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-ink-2 hover:bg-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.7} />
        Notices
      </Link>

      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h1 className={`${TEXT.pageTitle} flex items-center gap-3`}>
            {c?.notice_type ?? "Unclassified notice"}
            <StatusBadge status={notice.status} />
          </h1>
          <p className={TEXT.pageSubtitle}>
            Received {fmtDateTime(notice.created_at)} via {notice.source}
            {notice.reviewed_at && ` · reviewed ${fmtDateTime(notice.reviewed_at)}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {notice.status === "failed" && (
            <form
              action={async () => {
                "use server";
                await retryNotice(id);
              }}
            >
              <Button variant="outline">Retry classification</Button>
            </form>
          )}
          {notice.status === "needs_review" && (
            <Button asChild>
              <Link href={`/review/${id}`}>Review</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="block p-5">
          <div className={TEXT.cardTitle}>Source text</div>
          <div className={`${TEXT.cardSub} mb-3.5`}>
            Raw text from the ingested document.
            {pdfUrl && (
              <>
                {" "}
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  Open PDF
                </a>
              </>
            )}
          </div>
          <div className={`${TEXT.sourceText} max-h-[32rem] overflow-auto`}>
            {notice.raw_text}
          </div>
        </Card>

        <Card className="block p-5">
          <div className={TEXT.cardTitle}>Classification</div>
          <div className={`${TEXT.cardSub} mb-3.5`}>
            {c
              ? failures.length === 0
                ? "All gates passed."
                : `Held: ${failures.join(" · ")}`
              : "Not classified yet."}
          </div>
          {c ? (
            <>
              {c.reasoning && (
                <div className="mb-[18px]">
                  <Callout>
                    <b>AI confidence {fmtConfidence(c.confidence)}</b> — {c.reasoning}
                  </Callout>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <Field label="Notice type" value={c.notice_type} />
                <Field label="Chapter" value={c.chapter ? `Chapter ${c.chapter}` : "—"} />
                <Field
                  label="Case number"
                  value={
                    <span className={TEXT.identifier}>
                      {c.case_number ?? "—"}
                      {notice.cases && (
                        <span className="ml-2 font-sans text-ink-2">
                          {notice.cases.client_name}
                        </span>
                      )}
                    </span>
                  }
                />
                <Field label="Judge initials" value={c.judge_initials ?? "—"} />
                <Field label="Hearing" value={fmtDateTime(c.hearing_datetime)} />
                <Field label="Confidence" value={fmtConfidence(c.confidence)} />
              </div>
            </>
          ) : (
            <p className="text-[13.5px] text-ink-2">
              The pipeline updates this panel when classification completes.
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden p-0 shadow-[0_1px_2px_rgba(28,26,21,0.04)]">
        <div className="p-5 pb-2">
          <div className={TEXT.cardTitle}>Automation runs for this notice</div>
        </div>
        {!runs?.length ? (
          <p className="px-5 pb-5 text-[13.5px] text-ink-2">
            No automations have fired for this notice.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Automation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-ink-2">{fmtDateTime(r.created_at)}</TableCell>
                  <TableCell className="font-medium">
                    {(r.automations as unknown as { name: string } | null)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell
                    className={`max-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${
                      r.status === "failed" ? "text-status-red-ink" : "text-ink-2"
                    } ${TEXT.identifier}`}
                  >
                    {r.status === "failed" ? r.error : (r.resend_email_id ?? "")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
