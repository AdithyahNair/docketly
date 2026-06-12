import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase-server";
import { userClient } from "@/lib/supabase-server";
import { SidebarNav } from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar p-4">
        <div className="mb-6 px-3">
          <div className="text-lg font-semibold tracking-tight">Docketly</div>
          <div className="truncate text-xs text-muted-foreground">
            {firm?.name ?? "Your firm"}
          </div>
        </div>
        <SidebarNav reviewCount={reviewCount ?? 0} />
        <div className="mt-auto space-y-2 px-3">
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          <form action={signOut}>
            <Button variant="outline" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
