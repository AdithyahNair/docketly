import { Inbox } from "lucide-react";

// Teaching empty state (PRD §8: "empty states teach"): centered icon circle,
// bold title, quiet explanation. Render inside a Card.
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-full bg-muted text-ink-3">
        {icon ?? <Inbox className="h-4 w-4" />}
      </div>
      {title && <div className="text-sm font-semibold">{title}</div>}
      <div className="mt-1 text-[13.5px] text-ink-2">{children}</div>
    </div>
  );
}
