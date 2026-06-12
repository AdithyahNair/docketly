import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_TONE, TONES } from "@/design/tokens";
import { cn } from "@/lib/utils";

// The single door for rendering a notice or run status. Colors and labels
// come from design/tokens.ts; see design/README.md.
export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status];
  return (
    <Badge variant="outline" className={cn("font-medium", tone && TONES[tone])}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
