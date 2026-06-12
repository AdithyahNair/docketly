/* Eval harness. Runs the PRODUCTION classification path (regex + LLM merge)
 * against the labeled dataset and reports:
 *  - exact-match accuracy across notice_type, chapter, case_number, judge_initials
 *  - per-type precision / recall
 *  - confusion matrix
 *  - confidence calibration (mean confidence on correct vs incorrect)
 * Exits 1 if accuracy < 0.85 so it can gate CI/deploys.
 * Records a row in eval_runs when Supabase env is present.
 *
 * Usage: pnpm eval
 */
import { readFileSync } from "fs";
import { join } from "path";
import { classifyWithExtraction } from "../lib/pipeline";
import { CLASSIFIER_MODEL } from "../lib/claude";
import { NOTICE_TYPES, NoticeType } from "../lib/types";

interface Example {
  id: string;
  text: string;
  expected: {
    notice_type: NoticeType;
    chapter: 7 | 13 | null;
    case_number: string | null;
    judge_initials: string | null;
  };
}

const THRESHOLD = 0.85;

async function main() {
  const dataset: Example[] = JSON.parse(
    readFileSync(join(__dirname, "dataset.json"), "utf-8")
  );

  console.log(`Running ${dataset.length} examples against ${CLASSIFIER_MODEL}...\n`);

  const confusion: Record<string, Record<string, number>> = {};
  const perType: Record<string, { tp: number; fp: number; fn: number }> = {};
  for (const t of NOTICE_TYPES) {
    perType[t] = { tp: 0, fp: 0, fn: 0 };
    confusion[t] = Object.fromEntries(NOTICE_TYPES.map((u) => [u, 0]));
  }

  let exactCorrect = 0;
  const confCorrect: number[] = [];
  const confIncorrect: number[] = [];
  const failures: string[] = [];

  for (const ex of dataset) {
    const got = await classifyWithExtraction(ex.text);
    const e = ex.expected;

    confusion[e.notice_type][got.notice_type]++;
    if (got.notice_type === e.notice_type) perType[e.notice_type].tp++;
    else {
      perType[e.notice_type].fn++;
      perType[got.notice_type].fp++;
    }

    const fieldChecks = [
      got.notice_type === e.notice_type,
      got.chapter === e.chapter,
      (got.case_number ?? null) === e.case_number,
      (got.judge_initials ?? null) === e.judge_initials,
    ];
    const exact = fieldChecks.every(Boolean);
    if (exact) {
      exactCorrect++;
      confCorrect.push(got.confidence);
    } else {
      confIncorrect.push(got.confidence);
      failures.push(
        `  ${ex.id}: expected ${e.notice_type}/${e.chapter}/${e.case_number}/${e.judge_initials}` +
          ` got ${got.notice_type}/${got.chapter}/${got.case_number}/${got.judge_initials}` +
          ` (conf ${got.confidence.toFixed(2)})`
      );
    }
    process.stdout.write(exact ? "." : "F");
  }
  console.log("\n");

  const accuracy = exactCorrect / dataset.length;
  const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

  console.log(`Exact-match accuracy: ${(accuracy * 100).toFixed(1)}% (${exactCorrect}/${dataset.length})`);
  console.log(`Mean confidence when correct:   ${mean(confCorrect).toFixed(3)}`);
  console.log(`Mean confidence when incorrect: ${mean(confIncorrect).toFixed(3)}\n`);

  console.log("Per-type precision / recall:");
  for (const t of NOTICE_TYPES) {
    const { tp, fp, fn } = perType[t];
    if (tp + fp + fn === 0) continue;
    const p = tp + fp ? tp / (tp + fp) : 0;
    const r = tp + fn ? tp / (tp + fn) : 0;
    console.log(`  ${t.padEnd(30)} P=${p.toFixed(2)} R=${r.toFixed(2)} (n=${tp + fn})`);
  }

  console.log("\nConfusion (rows = expected, cols = predicted, nonzero off-diagonals):");
  for (const t of NOTICE_TYPES) {
    for (const u of NOTICE_TYPES) {
      if (t !== u && confusion[t][u] > 0) {
        console.log(`  ${t} -> ${u}: ${confusion[t][u]}`);
      }
    }
  }

  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(f));
  }

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { adminClient } = await import("../lib/supabase");
    await adminClient().from("eval_runs").insert({
      model: CLASSIFIER_MODEL,
      dataset_size: dataset.length,
      accuracy,
      per_type: perType,
      confusion,
    });
    console.log("\nRecorded run in eval_runs.");
  }

  if (accuracy < THRESHOLD) {
    console.error(`\nFAIL: accuracy ${(accuracy * 100).toFixed(1)}% below ${THRESHOLD * 100}% threshold.`);
    process.exit(1);
  }
  console.log(`\nPASS (threshold ${THRESHOLD * 100}%).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
