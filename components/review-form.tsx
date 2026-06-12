"use client";

import { useActionState } from "react";
import { NOTICE_TYPES, type Classification } from "@/lib/types";
import type { ReviewFormState } from "@/app/(dashboard)/review/actions";
import { Button } from "@/components/ui/button";
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
  approveAction,
  markFailedAction,
}: {
  classification: Classification | null;
  approveAction: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
  markFailedAction: () => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(approveAction, { error: null });
  const c = classification;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Notice type</Label>
          <Select name="notice_type" defaultValue={c?.notice_type} required>
            <SelectTrigger>
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
        <div className="space-y-2">
          <Label>Chapter</Label>
          <Select name="chapter" defaultValue={c?.chapter ? String(c.chapter) : "none"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unknown</SelectItem>
              <SelectItem value="7">Chapter 7</SelectItem>
              <SelectItem value="13">Chapter 13</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="case_number">Case number</Label>
          <Input
            id="case_number"
            name="case_number"
            defaultValue={c?.case_number ?? ""}
            placeholder="26-10342"
            className="font-mono"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="judge_initials">Judge initials</Label>
          <Input
            id="judge_initials"
            name="judge_initials"
            defaultValue={c?.judge_initials ?? ""}
            placeholder="MEW"
          />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="hearing_datetime">Hearing date & time</Label>
          <Input
            id="hearing_datetime"
            name="hearing_datetime"
            type="datetime-local"
            defaultValue={toDatetimeLocal(c?.hearing_datetime ?? null)}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Approving…" : "Approve & run automations"}
        </Button>
        <Button
          type="submit"
          variant="outline"
          formAction={markFailedAction}
          formNoValidate
          disabled={pending}
        >
          Mark failed
        </Button>
      </div>
    </form>
  );
}
