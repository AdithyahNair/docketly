import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase-server";
import type { AutomationRow } from "@/lib/types";
import { AutomationForm } from "@/components/automation-form";
import { updateAutomation } from "../actions";

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("automations").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const automation = data as AutomationRow;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/automations" className="text-sm text-muted-foreground hover:underline">
          ← Automations
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{automation.name}</h1>
      </div>
      <AutomationForm initial={automation} action={updateAutomation.bind(null, id)} />
    </div>
  );
}
