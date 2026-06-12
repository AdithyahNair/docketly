import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/supabase-server";
import { userClient } from "@/lib/supabase-server";
import { SidebarNav } from "@/components/sidebar-nav";

async function signOut() {
  "use server";
  const supabase = await userClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, firmId } = await requireUser();

  const [{ data: firm }, { count: reviewCount }] = await Promise.all([
    supabase.from("firms").select("name").eq("id", firmId).maybeSingle(),
    supabase
      .from("notices")
      .select("id", { count: "exact", head: true })
      .eq("status", "needs_review"),
  ]);

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-[250px] shrink-0 flex-col border-r bg-sidebar px-2 py-2.5">
        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-ink text-[15px] font-semibold tracking-[.02em] text-primary-foreground">
            D
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Docketly</div>
            <div className="truncate text-xs leading-snug text-ink-2">
              {firm?.name ?? "Your firm"}
            </div>
          </div>
        </div>

        <div className="mx-0.5 mb-1 mt-2.5 flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-[13px] text-ink-3 shadow-[0_1px_2px_rgba(28,26,21,0.03)]">
          <Search className="h-3.5 w-3.5" strokeWidth={1.7} />
          <span>Search</span>
          <kbd className="ml-auto rounded bg-muted px-[5px] py-px font-sans text-[11px] text-ink-3">
            ⌘K
          </kbd>
        </div>

        <SidebarNav reviewCount={reviewCount ?? 0} />

        <div className="mt-auto border-t pt-2.5">
          <div className="flex items-center gap-[9px] rounded-[7px] px-2.5 py-1.5 hover:bg-muted">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-avatar-bg text-[11.5px] font-semibold text-avatar-ink">
              {initial}
            </div>
            <span className="truncate text-[12.5px] text-ink-2">{user.email}</span>
            <form action={signOut} className="ml-auto shrink-0">
              <button
                type="submit"
                className="rounded px-1 py-0.5 text-xs font-medium text-ink-3 hover:bg-accent hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-[1080px] px-12 pb-20 pt-11">{children}</div>
      </main>
    </div>
  );
}
