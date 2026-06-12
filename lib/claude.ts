import Anthropic from "@anthropic-ai/sdk";
import { Classification, NOTICE_TYPES } from "./types";

const anthropic = new Anthropic();

export const CLASSIFIER_MODEL = "claude-sonnet-4-6";

const tool: Anthropic.Tool = {
  name: "record_classification",
  description: "Record the structured classification of a bankruptcy court notice.",
  input_schema: {
    type: "object" as const,
    properties: {
      notice_type: {
        type: "string",
        enum: [...NOTICE_TYPES],
        description:
          "The notice category. Use 'Other' if the document does not clearly fit a listed type.",
      },
      chapter: {
        type: ["integer", "null"],
        enum: [7, 13, null],
        description: "Bankruptcy chapter, if stated.",
      },
      case_number: {
        type: ["string", "null"],
        description: "Court case number, normalized like 26-10342. Null if absent.",
      },
      judge_initials: {
        type: ["string", "null"],
        description: "Presiding judge's initials in uppercase, often the suffix of the case number (e.g. 26-10342-MEW -> MEW). Null if absent.",
      },
      hearing_datetime: {
        type: ["string", "null"],
        description: "ISO 8601 datetime of any hearing or meeting. Null if none.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "Calibrated confidence that notice_type and case_number are correct. Below 0.8 routes to human review.",
      },
      reasoning: {
        type: "string",
        description: "One sentence explaining the classification, shown to the human reviewer.",
      },
    },
    required: [
      "notice_type",
      "chapter",
      "case_number",
      "judge_initials",
      "hearing_datetime",
      "confidence",
      "reasoning",
    ],
  },
};

const SYSTEM = `You classify United States bankruptcy court notices (CM/ECF and PACER documents) for a law firm's automation system.

Rules:
- Choose the single best notice_type. If the document is ambiguous, truncated, or garbled, choose "Other" and lower your confidence.
- Be conservative with confidence. A wrong classification sends a wrong email to a client; an uncertain one goes to a human reviewer, which is cheap. If the case number is unreadable or the type is inferred rather than stated, confidence must be below 0.8.
- Extract the case number exactly as printed, minus the judge-initial suffix (26-10342-MEW means case_number 26-10342 and judge_initials MEW).
- hearing_datetime applies to hearings and 341 meetings. Convert printed dates and times to ISO 8601, assume the court's local time without offset.`;

export async function classifyNotice(rawText: string): Promise<Classification> {
  const response = await anthropic.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    tools: [tool],
    tool_choice: { type: "tool", name: "record_classification" },
    messages: [
      {
        role: "user",
        content: `Classify this court notice:\n\n<notice>\n${rawText.slice(0, 12000)}\n</notice>`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Classifier returned no tool_use block");
  }

  const c = block.input as Classification;
  if (!NOTICE_TYPES.includes(c.notice_type)) {
    return { ...c, notice_type: "Other", confidence: Math.min(c.confidence, 0.5) };
  }
  return c;
}
