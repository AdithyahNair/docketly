import Link from "next/link";
import { requireUser } from "@/lib/supabase-server";
import { gateFailures } from "@/lib/gates";
import { fmtDateTime } from "@/lib/format";
import type { Classification } from "@/lib/types";
import { TEXT } from "@/design/tokens";
import { Confidence } from "@/design/patterns/confidence";
import { EmptyState } from "@/design/patterns/empty-state";
import { GateBadge } from "@/design/patterns/gate-badge";
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
    <div>
      <PageHeader
        title="Review queue"
        subtitle="Notices the AI wasn't confident about. Approving one fires automations on your corrected data."
      />

      <Card className="overflow-hidden p-0 shadow-[0_1px_2px_rgba(28,26,21,0.04)]">
        {queue.length === 0 ? (
          <EmptyState title="Nothing needs your attention.">
            Clear, matched notices are handled automatically — only the uncertain ones
            land here.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[17%]">Received</TableHead>
                <TableHead className="w-[10%]">AI guess</TableHead>
                <TableHead className="w-[11%]">Confidence</TableHead>
                <TableHead className="w-[36%]">Held because</TableHead>
                <TableHead>AI reasoning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((n) => {
                const c = n.classification;
                return (
                  <TableRow key={n.id} className="relative cursor-pointer">
                    <TableCell className="text-ink-2">
                      <Link href={`/review/${n.id}`} className="block">
                        {fmtDateTime(n.created_at)}
                        <span className="absolute inset-0" aria-hidden />
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {c?.notice_type ?? "—"}
                      {c?.case_number && (
                        <span className={`ml-1 text-ink-2 ${TEXT.identifier}`}>
                          {c.case_number}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Confidence pct={Math.round((c?.confidence ?? 0) * 100)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {gateFailures(c, n.case_id).map((f) => (
                          <GateBadge key={f} failure={f} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink-2">
                      {c?.reasoning ?? ""}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      {queue.length > 0 && (
        <p className={TEXT.fieldHint + " mt-2.5"}>
          Select a notice to review and correct its classification.
        </p>
      )}
    </div>
  );
}
