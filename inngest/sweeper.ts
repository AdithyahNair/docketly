import { inngest } from "./client";
import { adminClient } from "@/lib/supabase";

// Self-healing for the dual-write gap: a notice row can exist without its
// pipeline event if the process died between insert and emit. Every 5 minutes,
// re-emit for anything stuck in 'classifying'. Safe to re-emit because classify
// skips non-'classifying' notices and dispatch is idempotent at the DB layer.
export const sweeper = inngest.createFunction(
  { id: "sweep-stuck-notices" },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const stuck = await step.run("find-stuck", async () => {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await adminClient()
        .from("notices")
        .select("id")
        .eq("status", "classifying")
        .lt("created_at", cutoff)
        .limit(50);
      return (data ?? []).map((n) => n.id as string);
    });

    if (stuck.length > 0) {
      await step.sendEvent(
        "re-emit",
        stuck.map((noticeId) => ({ name: "notice/ingested" as const, data: { noticeId } }))
      );
    }
    return { reEmitted: stuck.length };
  }
);
