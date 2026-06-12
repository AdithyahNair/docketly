"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FileText, Gauge, Inbox, ListChecks, Search, Zap } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { StatusBadge } from "@/components/status-badge";
import { searchIndex, type SearchEntry } from "@/app/(dashboard)/search-actions";

const PAGES = [
  { href: "/notices", label: "Notices", icon: Inbox },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/automations", label: "Automations", icon: Zap },
  { href: "/runs", label: "Runs", icon: ListChecks },
  { href: "/evals", label: "Evals", icon: Gauge },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);

  // Load the notice index lazily, once per palette lifetime.
  useEffect(() => {
    if (open && entries === null) {
      searchIndex().then(setEntries).catch(() => setEntries([]));
    }
  }, [open, entries]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-0.5 mb-1 mt-2.5 flex w-[calc(100%-4px)] items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-[13px] text-ink-3 shadow-[0_1px_2px_rgba(28,26,21,0.03)] transition-colors hover:border-input"
      >
        <Search className="h-3.5 w-3.5" strokeWidth={1.7} />
        <span>Search</span>
        <kbd className="ml-auto rounded bg-muted px-[5px] py-px font-sans text-[11px] text-ink-3">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search notices and pages">
        <CommandInput placeholder="Search notices by case, client, or type…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Go to">
            {PAGES.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} value={`page ${label}`} onSelect={() => go(href)}>
                <Icon className="h-4 w-4" strokeWidth={1.7} />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Notices">
            {(entries ?? []).map((n) => (
              <CommandItem
                key={n.id}
                value={`${n.caseNumber ?? ""} ${n.clientName ?? ""} ${n.noticeType ?? ""} ${n.status}`}
                onSelect={() => go(n.status === "needs_review" ? `/review/${n.id}` : `/notices/${n.id}`)}
              >
                <FileText className="h-4 w-4" strokeWidth={1.7} />
                <span className="font-medium">{n.noticeType ?? "Unclassified"}</span>
                {n.caseNumber && (
                  <span className="font-mono text-xs text-ink-2">{n.caseNumber}</span>
                )}
                {n.clientName && <span className="text-ink-2">{n.clientName}</span>}
                <span className="ml-auto">
                  <StatusBadge status={n.status} />
                </span>
              </CommandItem>
            ))}
            {open && entries === null && (
              <div className="px-3 py-2 text-[13px] text-ink-3">Loading notices…</div>
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
