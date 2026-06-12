import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase";
import { contentHash } from "@/lib/hash";
import { inngest } from "@/inngest/client";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // pdf-parse's package entry runs debug code on import; import the lib directly.
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  let text = "";
  try {
    const parsed = await pdfParse(buffer);
    text = (parsed.text ?? "").trim();
  } catch {
    text = "";
  }

  const db = adminClient();
  const { data: firm } = await db.from("firms").select("id").limit(1).single();
  if (!firm) return NextResponse.json({ error: "no firm configured" }, { status: 500 });

  const pdfPath = `notices/${Date.now()}-${file.name}`;
  await db.storage.from("notices").upload(pdfPath, buffer, { contentType: "application/pdf" });

  const effectiveText = text || `[unextractable PDF: ${file.name}]`;
  const { data: notice } = await db
    .from("notices")
    .insert({
      firm_id: firm.id,
      source: "upload",
      pdf_path: pdfPath,
      raw_text: effectiveText,
      content_hash: contentHash(effectiveText),
      status: "classifying",
    })
    .select("id")
    .maybeSingle();

  if (!notice) return NextResponse.json({ deduped: true }, { status: 200 });

  await inngest.send({ name: "notice/ingested", data: { noticeId: notice.id } });
  return NextResponse.json({ noticeId: notice.id }, { status: 202 });
}
