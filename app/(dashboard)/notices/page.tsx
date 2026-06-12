import Link from "next/link";
import { requireUser } from "@/lib/supabase-server";
import { gateFailures } from "@/lib/gates";
import { fmtConfidence, fmtDateTime } from "@/lib/format";
import type { Classification } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { UploadButton } from "@/components/upload-button";
import { EmptyState } from "@/design/patterns/empty-state";
import { PageHeader } from "@/design/patterns/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "classifying", "classified", "needs_review", "failed"] as const;

interface NoticeListRow {
  id: string;
  created_at: string;
  source: string;
  status: string;
  case_id: string | null;
  classification: Classification | null;
  cases: { case_number: string } | null;
}

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const { supabase } = await requireUser();

  let query = supabase
    .from("notices")
    .select("id, created_at, source, status, case_id, classification, cases(case_number)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") query = query.eq("status", status);
  const { data } = await query;
  const notices = (data ?? []) as unknown as NoticeListRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notices"
        subtitle="Every notice ingested from the feed or uploaded by hand."
        actions={<UploadButton />}
      />

      <div className="flex gap-1 border-b">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/notices" : `/notices?status=${f}`}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium capitalize",
              status === f
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {f.replace("_", " ")}
          </Link>
        ))}
      </div>

      {notices.length === 0 ? (
        <EmptyState>
          No notices yet. Run <code className="font-mono">npm run simulate-feed</code> to
          ingest demo notices from the simulated PACER feed, or upload a PDF.
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notice type</TableHead>
              <TableHead>Case</TableHead>
              <TableHead>Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notices.map((n) => {
              const c = n.classification;
              const failures = gateFailures(c, n.case_id);
              return (
                <TableRow key={n.id} className="relative cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/notices/${n.id}`} className="block">
                      {fmtDateTime(n.created_at)}
                      <span className="absolute inset-0" aria-hidden />
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{n.source}</TableCell>
                  <TableCell>
                    <StatusBadge status={n.status} />
                  </TableCell>
                  <TableCell>{c?.notice_type ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {n.cases?.case_number ?? c?.case_number ?? "—"}
                  </TableCell>
                  <TableCell>
                    {c ? (
                      <span>
                        {fmtConfidence(c.confidence)}{" "}
                        <span className="text-xs text-muted-foreground">
                          {failures.length === 0 ? "all gates passed" : failures.join(", ")}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
