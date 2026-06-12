import { Badge } from "@/components/ui/badge";
import { TONES } from "@/design/tokens";
import { cn } from "@/lib/utils";

// A "held because" reason from lib/gates.ts gateFailures(). Always warning-
// toned: a failed gate is a request for human judgment, not an error.
export function GateBadge({ failure }: { failure: string }) {
  return (
    <Badge variant="outline" className={cn(TONES.warning)}>
      {failure}
    </Badge>
  );
}
