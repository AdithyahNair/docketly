import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AutomationForm } from "@/components/automation-form";
import { createAutomation } from "../actions";

export default function NewAutomationPage() {
  return (
    <div>
      <Link
        href="/automations"
        className="-ml-2 mb-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-ink-2 hover:bg-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.7} />
        Automations
      </Link>
      <AutomationForm title="New automation" action={createAutomation} />
    </div>
  );
}
