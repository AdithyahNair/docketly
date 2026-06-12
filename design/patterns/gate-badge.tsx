import { TONES } from "@/design/tokens";
import { cn } from "@/lib/utils";

// A "held because" reason chip from lib/gates.ts gateFailures(). Always
// warning-toned: a failed gate is a request for human judgment, not an error.
// Squared corners distinguish reasons from status pills (which are round).
export function GateBadge({ failure }: { failure: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        TONES.warning
      )}
    >
      {failure}
    </span>
  );
}
