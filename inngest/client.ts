import { Inngest, EventSchemas } from "inngest";

type Events = {
  "notice/ingested": { data: { noticeId: string } };
  "notice/classified": { data: { noticeId: string } };
};

export const inngest = new Inngest({
  id: "docketly",
  schemas: new EventSchemas().fromRecord<Events>(),
});
