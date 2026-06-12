import { requireUser } from "@/lib/supabase-server";
import { fmtDateTime } from "@/lib/format";
import { NOTICE_TYPES } from "@/lib/types";
import { TEXT } from "@/design/tokens";
import { Card } from "@/components/ui/card";
import { Callout } from "@/design/patterns/callout";
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

interface EvalRun {
  id: string;
  model: string;
  dataset_size: number;
  accuracy: number | string;
  per_type: Record<string, { tp: number; fp: number; fn: number }>;
  confusion: Record<string, Record<string, number>>;
  created_at: string;
}

const PASS_THRESHOLD = 0.85;

const SUBTITLE =
  "Classifier quality, measured against the labeled dataset. Review corrections grow the dataset, so every human fix becomes a regression test.";

export default async function EvalsPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("eval_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  const runs = (data ?? []) as EvalRun[];
  const latest = runs[0];

  if (!latest) {
    return (
      <div>
        <PageHeader title="Evals" subtitle={SUBTITLE} />
        <Card className="overflow-hidden p-0 shadow-[0_1px_2px_rgba(28,26,21,0.04)]">
          <EmptyState title="No eval runs recorded yet">
            Run{" "}
            <code className="rounded-[5px] bg-muted px-1.5 py-px font-mono text-xs text-ink">
              npm run eval
            </code>{" "}
            (requires ANTHROPIC_API_KEY) to score the live classifier against the labeled
            dataset.
          </EmptyState>
        </Card>
      </div>
    );
  }

  const accuracy = Number(latest.accuracy);
  const passed = accuracy >= PASS_THRESHOLD;
  const typesWithData = NOTICE_TYPES.filter((t) => {
    const s = latest.per_type[t];
    return s && s.tp + s.fp + s.fn > 0;
  });
  const confusedPairs = NOTICE_TYPES.flatMap((expected) =>
    NOTICE_TYPES.filter(
      (predicted) => expected !== predicted && (latest.confusion[expected]?.[predicted] ?? 0) > 0
    ).map((predicted) => ({
      expected,
      predicted,
      count: latest.confusion[expected][predicted],
    }))
  );

  return (
    <div>
      <PageHeader title="Evals" subtitle={SUBTITLE} />

      <div className="mb-5">
        <Callout>
          <b>How this is measured:</b> each example in the test set is a real notice
          with the correct answers recorded by a person. Running{" "}
          <code className="font-mono text-xs">npm run eval</code> has Docketly re-read
          every example from scratch and compares its answers — notice type, chapter,
          case number, judge — against the human answers. A score counts only if all
          four match exactly. <b>Precision</b>: when Docketly says a notice is this
          type, how often is it right? <b>Recall</b>: of all notices that truly are
          this type, how many did it find? <b>n</b> is how many examples of that type
          are in the test set. Every correction made in Review is added to the test
          set, so the score is always checked against the mistakes humans actually
          caught.
        </Callout>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.55fr]">
        <div className="flex flex-col gap-5">
          <Card className="block p-5">
            <div className={TEXT.cardTitle}>Exact-match accuracy</div>
            <div
              className={cn(
                "my-2 text-[42px] font-semibold leading-[1.1] tracking-[-0.02em] tabular-nums",
                passed ? "text-status-green-ink" : "text-status-red-ink"
              )}
            >
              {(accuracy * 100).toFixed(1)}%
            </div>
            <div className="flex flex-wrap items-center gap-[7px] text-[13px] text-ink-2">
              <span>
                {passed ? "Passing" : "Failing"} the {PASS_THRESHOLD * 100}% gate
              </span>
              <span className="h-[3px] w-[3px] rounded-full bg-ink-3" />
              <span>{latest.dataset_size} examples</span>
              <span className="h-[3px] w-[3px] rounded-full bg-ink-3" />
              <span className="font-mono text-xs">{latest.model}</span>
            </div>
            <div className="mt-1.5 text-[13px] text-ink-2">
              Last run {fmtDateTime(latest.created_at)}
            </div>
          </Card>

          <Card className="block p-5">
            <div className={TEXT.cardTitle}>Run history</div>
            <div className={TEXT.cardSub}>
              How to run:{" "}
              <code className="rounded-[5px] bg-muted px-1.5 py-px font-mono text-xs text-ink">
                npm run eval
              </code>{" "}
              — exits nonzero below {PASS_THRESHOLD * 100}%, so it can gate deploys.
            </div>
            <div className="my-4 flex h-[88px] items-end gap-2">
              {[...runs].reverse().map((r) => {
                const a = Number(r.accuracy);
                return (
                  <div
                    key={r.id}
                    title={`${(a * 100).toFixed(1)}% · ${fmtDateTime(r.created_at)}`}
                    className={cn(
                      "w-[26px] rounded-t-[5px] rounded-b-sm opacity-80",
                      a >= PASS_THRESHOLD ? "bg-status-green-ink" : "bg-status-red-ink"
                    )}
                    style={{ height: `${Math.max(a * 100, 4)}%` }}
                  />
                );
              })}
            </div>
            <p className={TEXT.fieldHint}>
              {runs.length} recorded run{runs.length === 1 ? "" : "s"}, oldest → newest.
            </p>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="overflow-hidden p-0 shadow-[0_1px_2px_rgba(28,26,21,0.04)]">
            <div className="p-5 pb-2">
              <div className={TEXT.cardTitle}>Per-type precision / recall</div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Notice type</TableHead>
                  <TableHead className="text-right">Precision</TableHead>
                  <TableHead className="text-right">Recall</TableHead>
                  <TableHead className="text-right">n</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typesWithData.map((t) => {
                  const { tp, fp, fn } = latest.per_type[t];
                  const p = tp + fp ? tp / (tp + fp) : 0;
                  const r = tp + fn ? tp / (tp + fn) : 0;
                  return (
                    <TableRow key={t}>
                      <TableCell className="font-medium">{t}</TableCell>
                      <TableCell className={`text-right ${TEXT.identifier}`}>
                        {p.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right ${TEXT.identifier}`}>
                        {r.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right text-ink-2 ${TEXT.identifier}`}>
                        {tp + fn}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          <Card className="block p-5">
            <div className={TEXT.cardTitle}>Confusion</div>
            <div className={`${TEXT.cardSub} mb-3.5`}>
              Off-diagonal cells: expected → predicted.
            </div>
            {confusedPairs.length === 0 ? (
              <Callout>
                No confusions — every example classified as its expected type.
              </Callout>
            ) : (
              <ul className="space-y-1 text-[13.5px]">
                {confusedPairs.map(({ expected, predicted, count }) => (
                  <li key={`${expected}-${predicted}`}>
                    <span className="font-medium">{expected}</span>
                    <span className="text-ink-2"> classified as </span>
                    <span className="font-medium">{predicted}</span>
                    <span className={`text-ink-2 ${TEXT.identifier}`}> ×{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
