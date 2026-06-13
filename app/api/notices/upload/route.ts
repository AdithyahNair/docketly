import { NextRequest, NextResponse } from "next/server";
import { userClient } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase";
import { contentHash } from "@/lib/hash";
import { inngest } from "@/inngest/client";

export async function POST(req: NextRequest) {
  // Authenticated uploads only. An open endpoint here would let anyone inject
  // notices into a firm — spending classification budget and potentially
  // firing real client emails. The notice is scoped to the caller's own firm
  // from their verified session, never to "whichever firm is first".
  const auth = await userClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  const firmId = user?.app_metadata?.firm_id as string | undefined;
  if (!user || !firmId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  // Sanitize the client-supplied filename to a safe storage key segment and
  // namespace stored PDFs by firm.
  const safeName = (file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "upload") + "";
  const pdfPath = `notices/${firmId}/${Date.now()}-${safeName}`;
  await db.storage.from("notices").upload(pdfPath, buffer, { contentType: "application/pdf" });

  const effectiveText = text || `[unextractable PDF: ${file.name}]`;
  const { data: notice } = await db
    .from("notices")
    .insert({
      firm_id: firmId,
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
