import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase";
import { gateFailures } from "@/lib/gates";
import { fmtConfidence, fmtDateTime } from "@/lib/format";
import type { Classification } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Field } from "@/design/patterns/field";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/notices" className="text-sm text-muted-foreground hover:underline">
            ← Notices
          </Link>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {c?.notice_type ?? "Unclassified notice"}
            <StatusBadge status={notice.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            Received {fmtDateTime(notice.created_at)} via {notice.source}
            {notice.reviewed_at && ` · reviewed ${fmtDateTime(notice.reviewed_at)}`}
          </p>
        </div>
        <div className="flex gap-2">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Source text</CardTitle>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted-foreground underline"
              >
                Open PDF
              </a>
            )}
          </CardHeader>
          <CardContent>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-4 font-mono text-xs leading-relaxed">
              {notice.raw_text}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {c ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Notice type" value={c.notice_type} />
                  <Field label="Chapter" value={c.chapter ? `Chapter ${c.chapter}` : "—"} />
                  <Field
                    label="Case number"
                    value={
                      <span className="font-mono">
                        {c.case_number ?? "—"}
                        {notice.cases && (
                          <span className="ml-2 font-sans text-muted-foreground">
                            {notice.cases.client_name}
                          </span>
                        )}
                      </span>
                    }
                  />
                  <Field label="Judge initials" value={c.judge_initials ?? "—"} />
                  <Field label="Hearing" value={fmtDateTime(c.hearing_datetime)} />
                  <Field
                    label="Confidence"
                    value={
                      <span>
                        {fmtConfidence(c.confidence)}{" "}
                        <span className="text-xs text-muted-foreground">
                          {failures.length === 0 ? "all gates passed" : failures.join(", ")}
                        </span>
                      </span>
                    }
                  />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    AI reasoning
                  </div>
                  <p className="text-sm italic text-muted-foreground">{c.reasoning}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not classified yet. The pipeline updates this row when classification
                completes.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automation runs for this notice</CardTitle>
        </CardHeader>
        <CardContent>
          {!runs?.length ? (
            <p className="text-sm text-muted-foreground">
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
                    <TableCell>{fmtDateTime(r.created_at)}</TableCell>
                    <TableCell>
                      {(r.automations as unknown as { name: string } | null)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.status === "failed" ? r.error : (r.resend_email_id ?? "")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
