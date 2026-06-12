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
import { Badge } from "@/components/ui/badge";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
        <p className="text-sm text-muted-foreground">
          Notices the AI wasn&apos;t confident about. Approving one fires automations on
          your corrected data.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing needs your attention.
        </div>
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
                        <Badge
                          key={f}
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-800"
                        >
                          {f}
                        </Badge>
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
