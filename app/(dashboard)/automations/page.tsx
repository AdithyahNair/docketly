import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase-server";
import { fmtDateTime } from "@/lib/format";
import type { AutomationRow } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { AutomationToggle } from "@/components/automation-toggle";
import { Button } from "@/components/ui/button";
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

type Row = AutomationRow & {
  automation_runs: { status: string; created_at: string }[];
};

function filterSummary(a: AutomationRow) {
  const parts: string[] = [a.match_notice_type];
  if (a.match_chapter) parts.push(`Chapter ${a.match_chapter}`);
  if (a.match_judge) parts.push(`Judge ${a.match_judge}`);
  return parts.join(" · ");
}

export default async function AutomationsPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("automations")
    .select("*, automation_runs(status, created_at)")
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "automation_runs", ascending: false })
    .limit(1, { referencedTable: "automation_runs" });
  const automations = (data ?? []) as Row[];

  return (
    <div>
      <PageHeader
        title="Automations"
        subtitle="When a classified notice matches a rule, the rule emails its recipients."
        actions={
          <Button asChild>
            <Link href="/automations/new">
              <Plus className="h-[15px] w-[15px]" strokeWidth={1.7} />
              New automation
            </Link>
          </Button>
        }
      />

      <Card className="overflow-hidden p-0 shadow-[0_1px_2px_rgba(28,26,21,0.04)]">
        {automations.length === 0 ? (
          <EmptyState title="No automations yet">
            Create one to start emailing clients and attorneys when notices arrive.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[6%]">On</TableHead>
                <TableHead className="w-[34%]">Name</TableHead>
                <TableHead className="w-[32%]">Matches</TableHead>
                <TableHead>Last run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map((a) => {
                const lastRun = a.automation_runs?.[0];
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <AutomationToggle id={a.id} enabled={a.enabled} />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/automations/${a.id}`} className="hover:underline">
                        {a.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-ink-2">{filterSummary(a)}</TableCell>
                    <TableCell>
                      {lastRun ? (
                        <span className="flex items-center gap-2.5">
                          <StatusBadge status={lastRun.status} />
                          <span className="whitespace-nowrap text-ink-2">
                            {fmtDateTime(lastRun.created_at)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-2">never</span>
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
