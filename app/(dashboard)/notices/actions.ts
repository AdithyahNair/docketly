"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase-server";
import { inngest } from "@/inngest/client";

// Retry a failed notice: put it back in 'classifying' and re-emit the
// ingestion event. classify skips any notice not in 'classifying', so a
// stray double-click cannot double-process.
export async function retryNotice(noticeId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("notices")
    .update({ status: "classifying" })
    .eq("id", noticeId)
    .eq("status", "failed");
  if (error) throw new Error(error.message);

  await inngest.send({ name: "notice/ingested", data: { noticeId } });
  revalidatePath("/notices");
  revalidatePath(`/notices/${noticeId}`);
}
