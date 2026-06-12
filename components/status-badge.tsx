import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  // notice statuses
  classifying: "bg-blue-100 text-blue-800 border-blue-200",
  classified: "bg-green-100 text-green-800 border-green-200",
  needs_review: "bg-amber-100 text-amber-800 border-amber-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  // run statuses
  sent: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-blue-100 text-blue-800 border-blue-200",
  skipped: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

const LABELS: Record<string, string> = {
  needs_review: "needs review",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[status])}>
      {LABELS[status] ?? status}
    </Badge>
  );
}
