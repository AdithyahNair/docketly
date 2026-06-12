import { TEXT } from "@/design/tokens";

// The standard top block of every dashboard page: title, one-line subtitle
// (or any node, e.g. gate chips), and an optional action slot.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-6">
      <div>
        <h1 className={TEXT.pageTitle}>{title}</h1>
        {subtitle && <div className={TEXT.pageSubtitle}>{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}
