import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase";
import { gateFailures } from "@/lib/gates";
import type { Classification } from "@/lib/types";
import { ReviewForm } from "@/components/review-form";
import { approveNotice, markNoticeFailed } from "../actions";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: notice } = await supabase
    .from("notices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!notice) notFound();
  if (notice.status !== "needs_review") redirect(`/notices/${id}`);

  const c = notice.classification as Classification | null;
  const failures = gateFailures(c, notice.case_id);

  let pdfUrl: string | null = null;
  if (notice.pdf_path) {
    const { data: signed } = await adminClient()
      .storage.from("notices")
      .createSignedUrl(notice.pdf_path, 3600);
    pdfUrl = signed?.signedUrl ?? null;
  }

  return (
    <div>
      <Link
        href="/review"
        className="-ml-2 mb-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-ink-2 hover:bg-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.7} />
        Review queue
      </Link>
      <ReviewForm
        classification={c}
        failures={failures}
        rawText={notice.raw_text}
        pdfUrl={pdfUrl}
        approveAction={approveNotice.bind(null, id)}
        markFailedAction={markNoticeFailed.bind(null, id)}
      />
    </div>
  );
}
