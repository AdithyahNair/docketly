/* Seed: one firm, 15 cases matching the eval dataset case numbers, 4 automations.
 * Usage: pnpm seed
 * Set DEMO_INBOX to an email you control so automation sends land somewhere visible.
 */
import { adminClient } from "../lib/supabase";

const DEMO_INBOX = process.env.DEMO_INBOX ?? "delivered@resend.dev";

const CASES = [
  { case_number: "26-10342", client_name: "Maria T. Alvarez", chapter: 13 },
  { case_number: "26-41877", client_name: "Devon Carter", chapter: 7 },
  { case_number: "25-29914", client_name: "Samuel Okafor", chapter: 7 },
  { case_number: "26-13320", client_name: "Kelly Nguyen", chapter: 13 },
  { case_number: "26-07215", client_name: "Harold Brewster", chapter: 7 },
  { case_number: "26-11458", client_name: "Joanna Reyes", chapter: 13 },
  { case_number: "26-10881", client_name: "Patrick Doyle", chapter: 7 },
  { case_number: "26-50677", client_name: "Brianna Holt", chapter: 13 },
  { case_number: "23-04412", client_name: "Miguel Santos", chapter: 13 },
  { case_number: "26-02156", client_name: "Angela Pruitt", chapter: 13 },
  { case_number: "26-30901", client_name: "Curtis Webb", chapter: 7 },
  { case_number: "26-10509", client_name: "Thomas Greer", chapter: 13 },
  { case_number: "26-18804", client_name: "Felicia Mbeki", chapter: 7 },
  { case_number: "26-22301", client_name: "Robert Kaminski", chapter: 13 },
  { case_number: "26-09115", client_name: "Dana Whitfield", chapter: 7 }
];

async function main() {
  const db = adminClient();

  const { data: firm, error: firmErr } = await db
    .from("firms")
    .insert({ name: "Hudson & Vance Bankruptcy Law", owner_email: DEMO_INBOX })
    .select("id")
    .single();
  if (firmErr || !firm) throw firmErr ?? new Error("firm insert failed");

  const { error: caseErr } = await db.from("cases").insert(
    CASES.map((c) => ({
      ...c,
      firm_id: firm.id,
      client_email: DEMO_INBOX,
      attorney_email: DEMO_INBOX
    }))
  );
  if (caseErr) throw caseErr;

  const { error: autoErr } = await db.from("automations").insert([
    {
      firm_id: firm.id,
      name: "Hearing notice to client",
      match_notice_type: "Notice of Hearing",
      recipients: [{ type: "role", role: "client" }],
      subject_template: "Hearing scheduled in your case {{case_number}}",
      body_template:
        "Dear {{client_name}},\n\nA hearing has been scheduled in your bankruptcy case {{case_number}} on {{hearing_date}} at {{hearing_time}} before Judge {{judge_initials}}.\n\nYour attorney will contact you with preparation details. Please do not miss this date.\n\n{{firm_name}}"
    },
    {
      firm_id: firm.id,
      name: "Hearing notice to attorney",
      match_notice_type: "Notice of Hearing",
      recipients: [{ type: "role", role: "attorney" }],
      subject_template: "[Action] Hearing on {{hearing_date}}: case {{case_number}}",
      body_template:
        "Hearing scheduled on case {{case_number}} ({{client_name}}, Chapter {{chapter}}) for {{hearing_date}} {{hearing_time}}, Judge {{judge_initials}}. Calendar and prepare.\n\nAutomated by Docketly."
    },
    {
      firm_id: firm.id,
      name: "341 meeting prep, Chapter 7 only",
      match_notice_type: "Notice of 341 Meeting",
      match_chapter: 7,
      recipients: [{ type: "role", role: "client" }],
      subject_template: "Your creditors meeting: case {{case_number}}",
      body_template:
        "Dear {{client_name}},\n\nYour Section 341 meeting of creditors is set for {{hearing_date}} at {{hearing_time}}. Bring government photo ID and proof of your social security number. Your attorney will attend with you.\n\n{{firm_name}}"
    },
    {
      firm_id: firm.id,
      name: "Discharge congratulations",
      match_notice_type: "Order of Discharge",
      recipients: [
        { type: "role", role: "client" },
        { type: "role", role: "attorney" }
      ],
      subject_template: "Discharge granted in case {{case_number}}",
      body_template:
        "Dear {{client_name}},\n\nGood news: the court has entered your Order of Discharge in case {{case_number}}. Discharged debts can no longer be collected from you. We will send a copy of the order and next steps shortly.\n\nCongratulations,\n{{firm_name}}"
    }
  ]);
  if (autoErr) throw autoErr;

  console.log(`Seeded firm ${firm.id}, ${CASES.length} cases, 4 automations.`);
  console.log(`All emails route to ${DEMO_INBOX}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
