"use client";

import { useActionState } from "react";
import { NOTICE_TYPES, type Classification } from "@/lib/types";
import type { ReviewFormState } from "@/app/(dashboard)/review/actions";
import { TEXT } from "@/design/tokens";
import { Callout } from "@/design/patterns/callout";
import { GateBadge } from "@/design/patterns/gate-badge";
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

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReviewForm({
  classification,
  failures,
  rawText,
  pdfUrl,
  approveAction,
  markFailedAction,
}: {
  classification: Classification | null;
  failures: string[];
  rawText: string;
  pdfUrl: string | null;
  approveAction: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
  markFailedAction: () => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(approveAction, { error: null });
  const c = classification;

  return (
    <form action={formAction}>
      <PageHeader
        title="Review notice"
        subtitle={
          <span className="mt-0.5 flex flex-wrap gap-1.5">
            {failures.map((f) => (
              <GateBadge key={f} failure={f} />
            ))}
          </span>
        }
        actions={
          <div className="flex shrink-0 gap-2">
            <Button
              type="submit"
              variant="outline"
              formAction={markFailedAction}
              formNoValidate
              disabled={pending}
              className="text-status-red-ink"
            >
              Mark failed
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Approving…" : "Approve & run automations"}
            </Button>
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card className="block p-5">
          <div className={TEXT.cardTitle}>Source text</div>
          <div className={`${TEXT.cardSub} mb-3.5`}>
            Raw text from the ingested document.
            {pdfUrl && (
              <>
                {" "}
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  Open PDF
                </a>
              </>
            )}
          </div>
          <div className={`${TEXT.sourceText} max-h-[36rem] overflow-auto`}>{rawText}</div>
        </Card>

        <Card className="block p-5">
          <div className={TEXT.cardTitle}>Classification</div>
          <div className={`${TEXT.cardSub} mb-3.5`}>Edit what&apos;s wrong, then approve.</div>
          {c && (
            <div className="mb-[18px]">
              <Callout>
                <b>AI confidence {Math.round(c.confidence * 100)}%</b> — {c.reasoning}
              </Callout>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-5 gap-y-[18px]">
            <div>
              <Label className={TEXT.fieldLabel}>Notice type</Label>
              <Select name="notice_type" defaultValue={c?.notice_type} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {NOTICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={TEXT.fieldLabel}>Chapter</Label>
              <Select name="chapter" defaultValue={c?.chapter ? String(c.chapter) : "none"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unknown</SelectItem>
                  <SelectItem value="7">Chapter 7</SelectItem>
                  <SelectItem value="13">Chapter 13</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="case_number" className={TEXT.fieldLabel}>
                Case number
              </Label>
              <Input
                id="case_number"
                name="case_number"
                defaultValue={c?.case_number ?? ""}
                placeholder="26-10342"
                className="font-mono"
                required
              />
            </div>
            <div>
              <Label htmlFor="judge_initials" className={TEXT.fieldLabel}>
                Judge initials
              </Label>
              <Input
                id="judge_initials"
                name="judge_initials"
                defaultValue={c?.judge_initials ?? ""}
                placeholder="MEW"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="hearing_datetime" className={TEXT.fieldLabel}>
                Hearing date & time
              </Label>
              <Input
                id="hearing_datetime"
                name="hearing_datetime"
                type="datetime-local"
                defaultValue={toDatetimeLocal(c?.hearing_datetime ?? null)}
              />
            </div>
          </div>
          {state.error && (
            <p className="mt-4 text-[13px] font-medium text-destructive">{state.error}</p>
          )}
        </Card>
      </div>
    </form>
  );
}
