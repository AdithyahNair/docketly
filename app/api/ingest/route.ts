import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase";
import { contentHash } from "@/lib/hash";
import { inngest } from "@/inngest/client";

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", process.env.WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers.get("x-docketly-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { text?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!payload.text || payload.text.trim().length === 0) {
    return NextResponse.json({ error: "missing text" }, { status: 400 });
  }

  const db = adminClient();
  const { data: firm } = await db.from("firms").select("id").limit(1).single();
  if (!firm) return NextResponse.json({ error: "no firm configured" }, { status: 500 });

  // Dedup at the DB layer: UNIQUE(firm_id, content_hash). A replayed webhook
  // inserts nothing and returns deduped: true.
  const { data: notice } = await db
    .from("notices")
    .insert({
      firm_id: firm.id,
      source: "webhook",
      raw_text: payload.text,
      content_hash: contentHash(payload.text),
      status: "classifying",
    })
    .select("id")
    .maybeSingle();

  if (!notice) return NextResponse.json({ deduped: true }, { status: 200 });

  await inngest.send({ name: "notice/ingested", data: { noticeId: notice.id } });
  return NextResponse.json({ noticeId: notice.id }, { status: 202 });
}
