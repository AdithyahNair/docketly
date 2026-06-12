import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { classify, onClassifyFailure } from "@/inngest/classify";
import { dispatch } from "@/inngest/dispatch";
import { sweeper } from "@/inngest/sweeper";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [classify, onClassifyFailure, dispatch, sweeper],
});
