export const NOTICE_TYPES = [
  "Notice of Hearing",
  "Notice of 341 Meeting",
  "Order of Discharge",
  "Order of Dismissal",
  "Notice of Deadline",
  "Motion for Relief from Stay",
  "Other",
] as const;

export type NoticeType = (typeof NOTICE_TYPES)[number];

export interface Classification {
  notice_type: NoticeType;
  chapter: 7 | 13 | null;
  case_number: string | null;
  judge_initials: string | null;
  hearing_datetime: string | null;
  confidence: number;
  reasoning: string;
}

export type RecipientRole = "client" | "attorney";
export type Recipient = { type: "role"; role: RecipientRole } | { type: "email"; email: string };

export interface CaseRow {
  id: string;
  firm_id: string;
  case_number: string;
  client_name: string;
  client_email: string;
  attorney_email: string;
  chapter: 7 | 13 | null;
}

export interface NoticeRow {
  id: string;
  firm_id: string;
  case_id: string | null;
  source: "upload" | "webhook";
  pdf_path: string | null;
  raw_text: string;
  content_hash: string;
  status: "classifying" | "classified" | "needs_review" | "failed";
  classification: Classification | null;
}

export interface AutomationRow {
  id: string;
  firm_id: string;
  name: string;
  enabled: boolean;
  match_notice_type: NoticeType;
  match_chapter: 7 | 13 | null;
  match_judge: string | null;
  recipients: Recipient[];
  subject_template: string;
  body_template: string;
}

export const CONFIDENCE_THRESHOLD = 0.8;
