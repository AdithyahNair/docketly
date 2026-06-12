"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { NOTICE_TYPES, type AutomationRow, type Recipient } from "@/lib/types";
import { renderTemplate, type TokenContext } from "@/lib/templates";
import type { AutomationFormState } from "@/app/(dashboard)/automations/actions";
import { TEXT } from "@/design/tokens";
import { PageHeader } from "@/design/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Sample context matches the seeded demo case so the preview reads real.
const SAMPLE_CONTEXT: TokenContext = {
  client_name: "Maria T. Alvarez",
  case_number: "26-10342",
  notice_type: "Notice of Hearing",
  hearing_date: "July 9, 2026",
  hearing_time: "10:00 AM",
  judge_initials: "MEW",
  chapter: "13",
  firm_name: "Hudson & Vance Bankruptcy Law",
};

const TOKENS = Object.keys(SAMPLE_CONTEXT) as (keyof TokenContext)[];

function recipientLabel(r: Recipient) {
  return r.type === "role" ? (r.role === "client" ? "Client" : "Attorney") : r.email;
}

export function AutomationForm({
  title,
  initial,
  action,
}: {
  title: string;
  initial?: AutomationRow;
  action: (prev: AutomationFormState, formData: FormData) => Promise<AutomationFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [recipients, setRecipients] = useState<Recipient[]>(initial?.recipients ?? []);
  const [emailDraft, setEmailDraft] = useState("");
  const [subject, setSubject] = useState(initial?.subject_template ?? "");
  const [body, setBody] = useState(initial?.body_template ?? "");

  const hasRole = (role: "client" | "attorney") =>
    recipients.some((r) => r.type === "role" && r.role === role);

  function toggleRole(role: "client" | "attorney") {
    setRecipients((prev) =>
      hasRole(role)
        ? prev.filter((r) => !(r.type === "role" && r.role === role))
        : [...prev, { type: "role", role }]
    );
  }

  function addEmail() {
    const email = emailDraft.trim();
    if (!email) return;
    if (!recipients.some((r) => r.type === "email" && r.email === email)) {
      setRecipients((prev) => [...prev, { type: "email", email }]);
    }
    setEmailDraft("");
  }

  const renderedSubject = renderTemplate(subject, SAMPLE_CONTEXT);
  const renderedBody = renderTemplate(body, SAMPLE_CONTEXT);

  return (
    <form action={formAction}>
      <input type="hidden" name="recipients" value={JSON.stringify(recipients)} />
      {enabled && <input type="hidden" name="enabled" value="on" />}

      <PageHeader
        title={title}
        actions={
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] font-medium text-ink-2">
              {enabled ? "Enabled" : "Disabled"}
            </span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="block p-5">
          <div className="grid grid-cols-2 gap-x-5 gap-y-[18px]">
            <div className="col-span-2">
              <Label htmlFor="name" className={TEXT.fieldLabel}>
                Name
              </Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={initial?.name}
                placeholder="Hearing notice to client"
              />
            </div>
            <div>
              <Label className={TEXT.fieldLabel}>Notice type</Label>
              <Select
                name="match_notice_type"
                defaultValue={initial?.match_notice_type}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="When this arrives…" />
                </SelectTrigger>
                <SelectContent>
                  {NOTICE_TYPES.filter((t) => t !== "Other").map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={TEXT.fieldLabel}>Chapter filter</Label>
              <Select
                name="match_chapter"
                defaultValue={initial?.match_chapter ? String(initial.match_chapter) : "any"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any chapter</SelectItem>
                  <SelectItem value="7">Chapter 7</SelectItem>
                  <SelectItem value="13">Chapter 13</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="match_judge" className={TEXT.fieldLabel}>
                Judge filter (initials)
              </Label>
              <Input
                id="match_judge"
                name="match_judge"
                defaultValue={initial?.match_judge ?? ""}
                placeholder="Any judge"
              />
            </div>
            <div className="col-span-2">
              <Label className={TEXT.fieldLabel}>Recipients</Label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleRole("client")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border bg-background px-[13px] py-[5px] text-[13px] font-medium transition-colors",
                    hasRole("client")
                      ? "border-brand/45 bg-brand/10 text-brand"
                      : "border-input text-ink-2 hover:bg-sidebar"
                  )}
                >
                  Client
                </button>
                <button
                  type="button"
                  onClick={() => toggleRole("attorney")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border bg-background px-[13px] py-[5px] text-[13px] font-medium transition-colors",
                    hasRole("attorney")
                      ? "border-brand/45 bg-brand/10 text-brand"
                      : "border-input text-ink-2 hover:bg-sidebar"
                  )}
                >
                  Attorney
                </button>
                <Input
                  className="w-60 flex-auto"
                  placeholder="Add email and press Enter"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                />
              </div>
              {recipients.filter((r) => r.type === "email").length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recipients.map((r, i) =>
                    r.type === "email" ? (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                      >
                        {recipientLabel(r)}
                        <button
                          type="button"
                          onClick={() =>
                            setRecipients((prev) => prev.filter((_, j) => j !== i))
                          }
                          aria-label={`Remove ${recipientLabel(r)}`}
                          className="text-ink-3 hover:text-ink"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null
                  )}
                </div>
              )}
              <p className={TEXT.fieldHint}>
                Roles resolve against the matched case: Client → client email, Attorney →
                attorney email.
              </p>
            </div>
            <div className="col-span-2">
              <Label htmlFor="subject_template" className={TEXT.fieldLabel}>
                Subject template
              </Label>
              <Input
                id="subject_template"
                name="subject_template"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Hearing scheduled in your case {{case_number}}"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="body_template" className={TEXT.fieldLabel}>
                Body template
              </Label>
              <Textarea
                id="body_template"
                name="body_template"
                required
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"Dear {{client_name}},\n\n…\n\n{{firm_name}}"}
                className="min-h-[120px] font-mono text-[12.5px] leading-[1.7]"
              />
            </div>
          </div>
          {state.error && (
            <p className="mt-4 text-[13px] font-medium text-destructive">{state.error}</p>
          )}
          <div className="mt-5">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : initial ? "Save changes" : "Create automation"}
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="block p-5">
            <div className={TEXT.cardTitle}>Token reference</div>
            <div className={`${TEXT.cardSub} mb-3.5`}>
              Tokens render from the matched case and classification. Unknown tokens
              render empty, never as literal braces.
            </div>
            <div>
              {TOKENS.map((t) => (
                <div
                  key={t}
                  className="flex items-baseline justify-between gap-3 border-b border-row-line py-[5.5px] last:border-b-0"
                >
                  <code className="font-mono text-xs text-brand">{`{{${t}}}`}</code>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-right text-[12.5px] text-ink-2">
                    {SAMPLE_CONTEXT[t]}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="block p-5">
            <div className={TEXT.cardTitle}>Preview</div>
            <div className={`${TEXT.cardSub} mb-3.5`}>
              Rendered against the sample case above.
            </div>
            <div className="whitespace-pre-wrap rounded-lg border bg-raised px-[18px] py-4 text-[13px] leading-[1.85] text-ink-2">
              {renderedSubject ? (
                <span className="font-semibold text-ink">{renderedSubject}</span>
              ) : (
                <span className="italic">(empty subject)</span>
              )}
              {"\n\n"}
              {renderedBody || <span className="italic">(empty body)</span>}
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
