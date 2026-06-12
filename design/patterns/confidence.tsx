import { CONFIDENCE_THRESHOLD } from "@/lib/types";

// Confidence mini-bar + percentage + quiet gate note, per the redesign.
// The bar goes amber below the routing threshold so "would this have been
// held?" is readable at a glance.
export function Confidence({ pct, note }: { pct: number; note?: string }) {
  const low = pct < CONFIDENCE_THRESHOLD * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="h-1 w-11 shrink-0 overflow-hidden rounded-full bg-accent">
        <span
          className={`block h-full rounded-full opacity-75 ${
            low ? "bg-status-amber-ink" : "bg-status-green-ink"
          }`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </span>
      <span className="text-[13px] font-semibold tabular-nums">{pct}%</span>
      {note && <span className="text-[12.5px] text-ink-2">{note}</span>}
    </div>
  );
}
