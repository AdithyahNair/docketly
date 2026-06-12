import { STATUS_LABEL, STATUS_TONE, TONES } from "@/design/tokens";
import { cn } from "@/lib/utils";

// The single door for rendering a notice or run status: a soft pill with a
// leading dot, per the redesign. Colors and labels come from design/tokens.ts.
export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "info";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] text-xs font-medium leading-5",
        TONES[tone]
      )}
    >
      <span className="h-[5px] w-[5px] rounded-full bg-current opacity-70" aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
