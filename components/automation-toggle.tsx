"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleAutomation } from "@/app/(dashboard)/automations/actions";

export function AutomationToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      checked={enabled}
      disabled={pending}
      onCheckedChange={(next) => startTransition(() => toggleAutomation(id, next))}
      aria-label="Toggle automation"
    />
  );
}
