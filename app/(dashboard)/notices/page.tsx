import Link from "next/link";
import { requireUser } from "@/lib/supabase-server";
import { gateFailures } from "@/lib/gates";
import { fmtDateTime } from "@/lib/format";
import type { Classification } from "@/lib/types";
import { TEXT } from "@/design/tokens";
import { StatusBadge } from "@/components/status-badge";
import { UploadButton } from "@/components/upload-button";
import { Confidence } from "@/design/patterns/confidence";
import { EmptyState } from "@/design/patterns/empty-state";
import { PageHeader } from "@/design/patterns/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "classifying", label: "Classifying" },
  { id: "classified", label: "Classified" },
  { id: "needs_review", label: "Needs review" },
  { id: "failed", label: "Failed" },
] as const;

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

  const { data } = await supabase
    .from("notices")
    .select("id, created_at, source, status, case_id, classification, cases(case_number)")
    .order("created_at", { ascending: false })
    .limit(200);
  const all = (data ?? []) as unknown as NoticeListRow[];
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.id, f.id === "all" ? all.length : all.filter((n) => n.status === f.id).length])
  );
  const notices = status === "all" ? all : all.filter((n) => n.status === status);

  return (
    <div>
      <PageHeader
        title="Notices"
        subtitle="Every notice ingested from the feed or uploaded by hand."
        actions={<UploadButton />}
      />

      <div className="mb-3.5 flex gap-[3px]" role="tablist">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            role="tab"
            href={f.id === "all" ? "/notices" : `/notices?status=${f.id}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[7px] px-[11px] py-[5px] text-[13px] font-medium transition-colors",
              status === f.id
                ? "bg-accent text-ink"
                : "text-ink-2 hover:bg-muted hover:text-ink"
            )}
          >
            {f.label}
            <span
              className={cn(
                "text-[11.5px] font-semibold",
                status === f.id ? "text-ink-2" : "text-ink-3"
              )}
            >
              {counts[f.id]}
            </span>
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden p-0 shadow-[0_1px_2px_rgba(28,26,21,0.04)]">
        {notices.length === 0 ? (
          <EmptyState title="No notices here yet">
            Run{" "}
            <code className="rounded-[5px] bg-muted px-1.5 py-px font-mono text-xs text-ink">
              npm run simulate-feed
            </code>{" "}
            to ingest demo notices from the simulated PACER feed, or upload a PDF.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[17%]">Received</TableHead>
                <TableHead className="w-[10%]">Source</TableHead>
                <TableHead className="w-[13%]">Status</TableHead>
                <TableHead className="w-[24%]">Notice type</TableHead>
                <TableHead className="w-[11%]">Case</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.map((n) => {
                const c = n.classification;
                const failures = gateFailures(c, n.case_id);
                const caseNo = n.cases?.case_number ?? c?.case_number;
                return (
                  <TableRow key={n.id} className="relative cursor-pointer">
                    <TableCell className="text-ink-2">
                      <Link href={`/notices/${n.id}`} className="block">
                        {fmtDateTime(n.created_at)}
                        <span className="absolute inset-0" aria-hidden />
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize text-ink-2">{n.source}</TableCell>
                    <TableCell>
                      <StatusBadge status={n.status} />
                    </TableCell>
                    <TableCell className="font-medium">{c?.notice_type ?? "—"}</TableCell>
                    <TableCell>
                      {caseNo ? (
                        <span className={TEXT.identifier}>{caseNo}</span>
                      ) : (
                        <span className="text-ink-2">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c ? (
                        <Confidence
                          pct={Math.round(c.confidence * 100)}
                          note={failures.length === 0 ? "All gates passed" : failures.join(" · ")}
                        />
                      ) : (
                        <span className="text-ink-2">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
