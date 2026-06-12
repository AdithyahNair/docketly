import Link from "next/link";
import { requireUser } from "@/lib/supabase-server";
import { gateFailures } from "@/lib/gates";
import { fmtConfidence, fmtDateTime } from "@/lib/format";
import type { Classification } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/design/patterns/empty-state";
import { GateBadge } from "@/design/patterns/gate-badge";
import { PageHeader } from "@/design/patterns/page-header";

interface QueueRow {
  id: string;
  created_at: string;
  case_id: string | null;
  classification: Classification | null;
}

export default async function ReviewPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("notices")
    .select("id, created_at, case_id, classification")
    .eq("status", "needs_review")
    .order("created_at", { ascending: true });
  const queue = (data ?? []) as QueueRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review queue"
        subtitle="Notices the AI wasn't confident about. Approving one fires automations on your corrected data."
      />

      {queue.length === 0 ? (
        <EmptyState>Nothing needs your attention.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead>
              <TableHead>AI guess</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Held because</TableHead>
              <TableHead>AI reasoning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.map((n) => {
              const c = n.classification;
              return (
                <TableRow key={n.id} className="relative cursor-pointer hover:bg-muted/50">
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/review/${n.id}`} className="block">
                      {fmtDateTime(n.created_at)}
                      <span className="absolute inset-0" aria-hidden />
                    </Link>
                  </TableCell>
                  <TableCell>
                    {c?.notice_type ?? "—"}
                    {c?.case_number && (
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        {c.case_number}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{fmtConfidence(c?.confidence)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {gateFailures(c, n.case_id).map((f) => (
                        <GateBadge key={f} failure={f} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-96 text-xs italic text-muted-foreground">
                    {c?.reasoning ?? ""}
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
