import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
    <div>
      <Link
        href="/automations"
        className="-ml-2 mb-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-ink-2 hover:bg-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.7} />
        Automations
      </Link>
      <AutomationForm
        title={automation.name}
        initial={automation}
        action={updateAutomation.bind(null, id)}
      />
    </div>
  );
}
