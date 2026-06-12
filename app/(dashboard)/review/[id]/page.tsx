import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase";
import { gateFailures } from "@/lib/gates";
import { fmtConfidence } from "@/lib/format";
import type { Classification } from "@/lib/types";
import { ReviewForm } from "@/components/review-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { approveNotice, markNoticeFailed } from "../actions";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: notice } = await supabase
    .from("notices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!notice) notFound();
  if (notice.status !== "needs_review") redirect(`/notices/${id}`);

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
      <div className="space-y-1">
        <Link
          href="/review"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Review queue
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Review notice</h1>
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <span>Held because:</span>
          {failures.map((f) => (
            <Badge
              key={f}
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-800"
            >
              {f}
            </Badge>
          ))}
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
            <pre className="max-h-144 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-4 font-mono text-xs leading-relaxed">
              {notice.raw_text}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Classification — edit what&apos;s wrong
            </CardTitle>
            {c && (
              <p className="text-sm text-muted-foreground">
                AI confidence {fmtConfidence(c.confidence)} ·{" "}
                <span className="italic">{c.reasoning}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ReviewForm
              classification={c}
              approveAction={approveNotice.bind(null, id)}
              markFailedAction={markNoticeFailed.bind(null, id)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
