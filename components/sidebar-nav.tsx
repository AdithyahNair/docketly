"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Gauge, Inbox, ListChecks, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
    <nav className="flex flex-col gap-1">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {label === "Review" && reviewCount > 0 && (
              <Badge variant="secondary" className="ml-auto bg-amber-100 text-amber-800">
                {reviewCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
