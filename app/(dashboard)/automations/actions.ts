"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase-server";
import { NOTICE_TYPES, type NoticeType, type Recipient } from "@/lib/types";

export interface AutomationFormState {
  error: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseForm(formData: FormData):
  | { error: string }
  | {
      values: {
        name: string;
        enabled: boolean;
        match_notice_type: NoticeType;
        match_chapter: 7 | 13 | null;
        match_judge: string | null;
        recipients: Recipient[];
        subject_template: string;
        body_template: string;
      };
    } {
  const name = String(formData.get("name") ?? "").trim();
  const noticeType = String(formData.get("match_notice_type") ?? "");
  const chapterRaw = String(formData.get("match_chapter") ?? "");
  const judge = String(formData.get("match_judge") ?? "").trim();
  const subject = String(formData.get("subject_template") ?? "").trim();
  const body = String(formData.get("body_template") ?? "").trim();

  if (!name) return { error: "Name is required." };
  if (!(NOTICE_TYPES as readonly string[]).includes(noticeType)) {
    return { error: "Pick a notice type." };
  }
  if (!subject || !body) return { error: "Subject and body templates are required." };

  let recipients: Recipient[];
  try {
    recipients = JSON.parse(String(formData.get("recipients") ?? "[]"));
  } catch {
    return { error: "Invalid recipients." };
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { error: "Add at least one recipient." };
  }
  for (const r of recipients) {
    if (r.type === "email" && !EMAIL_RE.test(r.email)) {
      return { error: `"${r.email}" is not a valid email address.` };
    }
  }

  return {
    values: {
      name,
      enabled: formData.get("enabled") === "on",
      match_notice_type: noticeType as NoticeType,
      match_chapter: chapterRaw === "7" ? 7 : chapterRaw === "13" ? 13 : null,
      match_judge: judge ? judge.toUpperCase() : null,
      recipients,
      subject_template: subject,
      body_template: body,
    },
  };
}

export async function createAutomation(
  _prev: AutomationFormState,
  formData: FormData
): Promise<AutomationFormState> {
  const parsed = parseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase, firmId } = await requireUser();
  const { error } = await supabase
    .from("automations")
    .insert({ ...parsed.values, firm_id: firmId });
  if (error) return { error: error.message };

  revalidatePath("/automations");
  redirect("/automations");
}

export async function updateAutomation(
  id: string,
  _prev: AutomationFormState,
  formData: FormData
): Promise<AutomationFormState> {
  const parsed = parseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("automations").update(parsed.values).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/automations");
  redirect("/automations");
}

// Disabled rules are never matched by dispatch; the toggle takes effect on the
// next dispatched notice with no deploy or delay (US-8).
export async function toggleAutomation(id: string, enabled: boolean) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("automations").update({ enabled }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/automations");
}
