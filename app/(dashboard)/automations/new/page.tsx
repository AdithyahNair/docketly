import Link from "next/link";
import { AutomationForm } from "@/components/automation-form";
import { createAutomation } from "../actions";

export default function NewAutomationPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/automations" className="text-sm text-muted-foreground hover:underline">
          ← Automations
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New automation</h1>
      </div>
      <AutomationForm action={createAutomation} />
    </div>
  );
}
