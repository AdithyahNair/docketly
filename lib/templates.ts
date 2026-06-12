import { CaseRow, Classification, Recipient } from "./types";

export interface TokenContext {
  client_name: string;
  case_number: string;
  notice_type: string;
  hearing_date: string;
  hearing_time: string;
  judge_initials: string;
  chapter: string;
  firm_name: string;
}

export function buildTokenContext(
  classification: Classification,
  caseRow: CaseRow,
  firmName: string
): TokenContext {
  let hearingDate = "";
  let hearingTime = "";
  if (classification.hearing_datetime) {
    const d = new Date(classification.hearing_datetime);
    if (!isNaN(d.getTime())) {
      hearingDate = d.toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });
      hearingTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
  }
  return {
    client_name: caseRow.client_name,
    case_number: caseRow.case_number,
    notice_type: classification.notice_type,
    hearing_date: hearingDate,
    hearing_time: hearingTime,
    judge_initials: classification.judge_initials ?? "",
    chapter: classification.chapter ? String(classification.chapter) : "",
    firm_name: firmName,
  };
}

// Unknown tokens render empty, never as literal braces.
export function renderTemplate(template: string, ctx: TokenContext): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    key in ctx ? String(ctx[key as keyof TokenContext]) : ""
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveRecipients(recipients: Recipient[], caseRow: CaseRow): string[] {
  const emails: string[] = [];
  for (const r of recipients) {
    if (r.type === "role") {
      const email = r.role === "client" ? caseRow.client_email : caseRow.attorney_email;
      if (!email || !EMAIL_RE.test(email)) {
        throw new Error(`Unresolvable role "${r.role}" on case ${caseRow.case_number}`);
      }
      emails.push(email);
    } else {
      if (!EMAIL_RE.test(r.email)) throw new Error(`Invalid recipient email "${r.email}"`);
      emails.push(r.email);
    }
  }
  if (emails.length === 0) throw new Error("Automation has no recipients");
  return [...new Set(emails)];
}
