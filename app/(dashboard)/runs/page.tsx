import Link from "next/link";
import { requireUser } from "@/lib/supabase-server";
import { fmtDateTime } from "@/lib/format";
import type { Classification, Recipient } from "@/lib/types";
import { TEXT } from "@/design/tokens";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
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

interface RunRow {
  id: string;
  status: string;
  error: string | null;
  resend_email_id: string | null;
  created_at: string;
  notice_id: string;
  automations: { name: string; recipients: Recipient[] } | null;
  notices: { id: string; classification: Classification | null } | null;
}

function recipientSummary(recipients: Recipient[] | undefined) {
  if (!recipients?.length) return "—";
  return recipients
    .map((r) => (r.type === "role" ? (r.role === "client" ? "Client" : "Attorney") : r.email))
    .join(", ");
}

export default async function RunsPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("automation_runs")
    .select(
      "id, status, error, resend_email_id, created_at, notice_id, automations(name, recipients), notices(id, classification)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  const runs = (data ?? []) as unknown as RunRow[];

  return (
    <div>
      <PageHeader
        title="Runs"
        subtitle="Every automation fire: what sent, what failed, and why."
      />

      <Card className="overflow-hidden p-0 shadow-[0_1px_2px_rgba(28,26,21,0.04)]">
        {runs.length === 0 ? (
          <EmptyState title="No runs yet">
            Runs appear when a classified notice matches an enabled automation: the rule
            resolves its recipients, renders its templates, and sends the email — each
            attempt is recorded here, sent or failed. The same notice never triggers the
            same rule twice.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[16%]">Time</TableHead>
                <TableHead className="w-[24%]">Automation</TableHead>
                <TableHead className="w-[24%]">Notice</TableHead>
                <TableHead className="w-[13%]">Recipients</TableHead>
                <TableHead className="w-[9%]">Status</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => {
                const c = r.notices?.classification;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-ink-2">
                      {fmtDateTime(r.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.automations?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/notices/${r.notice_id}`} className="hover:underline">
                        {c?.notice_type ?? "notice"}
                        {c?.case_number && (
                          <span className={`ml-1 text-ink-2 ${TEXT.identifier}`}>
                            {c.case_number}
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-ink-2">
                      {recipientSummary(r.automations?.recipients)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell
                      className={`max-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${
                        r.status === "failed" ? "text-status-red-ink" : "text-ink-2"
                      } ${TEXT.identifier}`}
                    >
                      {r.status === "failed"
                        ? r.error
                        : r.resend_email_id && `Resend: ${r.resend_email_id}`}
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
