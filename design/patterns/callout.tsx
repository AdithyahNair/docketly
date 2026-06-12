import { Sparkles } from "lucide-react";

// Friendly callout for AI-authored text (reasoning, eval notes): soft ivory
// block with a sparkle, per the redesign. Bold lead via <b> in children.
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border bg-sidebar px-[15px] py-[13px] text-[13.5px] leading-relaxed text-ink-2 [&_b]:font-semibold [&_b]:text-ink">
      <Sparkles className="mt-0.5 h-[15px] w-[15px] shrink-0 text-ink-3" />
      <span>{children}</span>
    </div>
  );
}
