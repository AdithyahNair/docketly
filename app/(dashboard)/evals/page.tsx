import { requireUser } from "@/lib/supabase-server";
import { fmtDateTime } from "@/lib/format";
import { NOTICE_TYPES } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="space-y-6">
        <Header />
        <div className="space-y-2 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No eval runs recorded yet.</p>
          <p>
            Run <code className="font-mono">npm run eval</code> (requires
            ANTHROPIC_API_KEY) to score the live classifier against the labeled dataset.
            Every review-queue correction grows the dataset.
          </p>
        </div>
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
    <div className="space-y-6">
      <Header />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Exact-match accuracy</CardDescription>
            <CardTitle
              className={cn("text-4xl", passed ? "text-green-700" : "text-destructive")}
            >
              {(accuracy * 100).toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              {passed ? "Passing" : "FAILING"} the {PASS_THRESHOLD * 100}% gate ·{" "}
              {latest.dataset_size} examples · {latest.model}
            </p>
            <p>Last run {fmtDateTime(latest.created_at)}</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Per-type precision / recall</CardTitle>
          </CardHeader>
          <CardContent>
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
                      <TableCell>{t}</TableCell>
                      <TableCell className="text-right font-mono">{p.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{r.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{tp + fn}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confusion</CardTitle>
            <CardDescription>Off-diagonal cells: expected → predicted.</CardDescription>
          </CardHeader>
          <CardContent>
            {confusedPairs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No confusions — every example classified as its expected type.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {confusedPairs.map(({ expected, predicted, count }) => (
                  <li key={`${expected}-${predicted}`}>
                    <span className="font-medium">{expected}</span>
                    <span className="text-muted-foreground"> classified as </span>
                    <span className="font-medium">{predicted}</span>
                    <span className="font-mono text-muted-foreground"> ×{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run history</CardTitle>
            <CardDescription>
              How to run: <code className="font-mono">npm run eval</code> — exits nonzero
              below {PASS_THRESHOLD * 100}%, so it can gate deploys.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-24 items-end gap-1">
              {[...runs].reverse().map((r) => {
                const a = Number(r.accuracy);
                return (
                  <div
                    key={r.id}
                    title={`${(a * 100).toFixed(1)}% · ${fmtDateTime(r.created_at)}`}
                    className={cn(
                      "w-6 rounded-t",
                      a >= PASS_THRESHOLD ? "bg-green-500" : "bg-red-400"
                    )}
                    style={{ height: `${Math.max(a * 100, 4)}%` }}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {runs.length} recorded run{runs.length === 1 ? "" : "s"}, oldest → newest.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Evals</h1>
      <p className="text-sm text-muted-foreground">
        Classifier quality, measured against the labeled dataset. Review corrections grow
        the dataset, so every human fix becomes a regression test.
      </p>
    </div>
  );
}
