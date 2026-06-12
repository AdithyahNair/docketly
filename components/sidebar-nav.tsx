"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Gauge, Inbox, ListChecks, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONES } from "@/design/tokens";

const ITEMS = [
  { href: "/notices", label: "Notices", icon: Inbox },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/runs", label: "Runs", icon: ListChecks },
  { href: "/evals", label: "Evals", icon: Gauge },
];

export function SidebarNav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <nav className="mt-3 flex flex-col gap-px">
      <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
        Workspace
      </div>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-[9px] rounded-[7px] px-2.5 py-1.5 text-[13.5px] font-medium transition-colors",
              active
                ? "bg-sidebar-accent font-semibold text-ink"
                : "text-ink-2 hover:bg-muted hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
            {label}
            {label === "Review" && reviewCount > 0 && (
              <span
                className={cn(
                  "ml-auto rounded-full px-[7px] text-[11.5px] font-semibold leading-[18px]",
                  TONES.warning
                )}
              >
                {reviewCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
