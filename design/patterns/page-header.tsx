import { TEXT } from "@/design/tokens";

// The standard top block of every dashboard page: title, one-line subtitle,
// and an optional action slot (upload button, "New automation", …).
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className={TEXT.pageTitle}>{title}</h1>
        {subtitle && <p className={TEXT.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
