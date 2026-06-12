"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { NOTICE_TYPES, type AutomationRow, type Recipient } from "@/lib/types";
import { renderTemplate, type TokenContext } from "@/lib/templates";
import type { AutomationFormState } from "@/app/(dashboard)/automations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  initial,
  action,
}: {
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="recipients" value={JSON.stringify(recipients)} />

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initial?.name}
              placeholder="Hearing notice to client"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              id="enabled"
              name="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="enabled">{enabled ? "Enabled" : "Disabled"}</Label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Notice type</Label>
            <Select
              name="match_notice_type"
              defaultValue={initial?.match_notice_type}
              required
            >
              <SelectTrigger>
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
          <div className="space-y-2">
            <Label>Chapter filter</Label>
            <Select
              name="match_chapter"
              defaultValue={initial?.match_chapter ? String(initial.match_chapter) : "any"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any chapter</SelectItem>
                <SelectItem value="7">Chapter 7</SelectItem>
                <SelectItem value="13">Chapter 13</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="match_judge">Judge filter (initials)</Label>
            <Input
              id="match_judge"
              name="match_judge"
              defaultValue={initial?.match_judge ?? ""}
              placeholder="Any judge"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Recipients</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={hasRole("client") ? "default" : "outline"}
              onClick={() => toggleRole("client")}
            >
              Client
            </Button>
            <Button
              type="button"
              size="sm"
              variant={hasRole("attorney") ? "default" : "outline"}
              onClick={() => toggleRole("attorney")}
            >
              Attorney
            </Button>
            <Input
              className="w-56"
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
          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {recipients.map((r, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {recipientLabel(r)}
                  <button
                    type="button"
                    onClick={() => setRecipients((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove ${recipientLabel(r)}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Roles resolve against the matched case: Client → client email, Attorney →
            attorney email.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject_template">Subject template</Label>
          <Input
            id="subject_template"
            name="subject_template"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Hearing scheduled in your case {{case_number}}"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body_template">Body template</Label>
          <Textarea
            id="body_template"
            name="body_template"
            required
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Dear {{client_name}},\n\n…\n\n{{firm_name}}"}
          />
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create automation"}
        </Button>
      </form>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Token reference</CardTitle>
            <CardDescription>
              Tokens render from the matched case and classification. Unknown tokens
              render empty, never as literal braces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {TOKENS.map((t) => (
              <div key={t} className="flex justify-between gap-2 text-xs">
                <code className="font-mono">{`{{${t}}}`}</code>
                <span className="truncate text-muted-foreground">{SAMPLE_CONTEXT[t]}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
            <CardDescription>Rendered against the sample case above.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm font-medium">
              {renderTemplate(subject, SAMPLE_CONTEXT) || (
                <span className="text-muted-foreground">(empty subject)</span>
              )}
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-sans text-xs leading-relaxed">
              {renderTemplate(body, SAMPLE_CONTEXT) || "(empty body)"}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
