// Teaching empty state (PRD §8: "Empty states teach"). Every list page uses
// this dashed box; `title` bolds the first line when the state needs both a
// headline and an explanation (e.g. the Runs page).
export function EmptyState({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      {title && <p className="font-medium text-foreground">{title}</p>}
      <p>{children}</p>
    </div>
  );
}
