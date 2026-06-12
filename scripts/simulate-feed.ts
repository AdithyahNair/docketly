/* Simulated PACER feed: posts sample notices to /api/ingest with valid HMAC
 * signatures, spaced a few seconds apart so the inbox visibly fills on camera.
 * One notice is garbled and will land in the review queue by design.
 * Usage: pnpm simulate-feed  (BASE_URL defaults to http://localhost:3000)
 */
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.WEBHOOK_SECRET;
if (!SECRET) {
  console.error("WEBHOOK_SECRET is required");
  process.exit(1);
}

const dataset: Array<{ id: string; text: string }> = JSON.parse(
  readFileSync(join(__dirname, "..", "evals", "dataset.json"), "utf-8")
);
const FEED_IDS = ["hearing-ch13-01", "341-ch7-01", "discharge-ch7-01", "mfr-ch13-01", "ambiguous-01"];

async function send(text: string, label: string) {
  const body = JSON.stringify({ text });
  const signature = createHmac("sha256", SECRET!).update(body).digest("hex");
  const res = await fetch(`${BASE_URL}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-docketly-signature": signature },
    body
  });
  const json = await res.json();
  console.log(`[${label}] ${res.status}`, json);
}

async function main() {
  for (const id of FEED_IDS) {
    const ex = dataset.find((d) => d.id === id);
    if (!ex) continue;
    await send(ex.text, id);
    await new Promise((r) => setTimeout(r, 3000));
  }
  const first = dataset.find((d) => d.id === FEED_IDS[0])!;
  await send(first.text, `${FEED_IDS[0]} (replay, expect deduped)`);
}

main();
