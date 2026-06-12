"use server";

import { requireUser } from "@/lib/supabase-server";
import type { Classification } from "@/lib/types";

export interface SearchEntry {
  id: string;
  status: string;
  noticeType: string | null;
  caseNumber: string | null;
  clientName: string | null;
}

// Index for the ⌘K palette: the recent notices with the fields people search
// by (case number, client, type). Small enough to filter client-side.
export async function searchIndex(): Promise<SearchEntry[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("notices")
    .select("id, status, classification, cases(case_number, client_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []).map((n) => {
    const c = n.classification as Classification | null;
    const caseRow = n.cases as unknown as { case_number: string; client_name: string } | null;
    return {
      id: n.id as string,
      status: n.status as string,
      noticeType: c?.notice_type ?? null,
      caseNumber: caseRow?.case_number ?? c?.case_number ?? null,
      clientName: caseRow?.client_name ?? null,
    };
  });
}
