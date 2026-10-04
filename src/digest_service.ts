import { z } from "zod";
import { infrai } from "./infrai.js";

export const DigestRequest = z.object({
  subscribers: z.array(z.string().email()).min(1),
  title: z.string().min(1),
  entries: z.array(z.object({ title: z.string(), url: z.string().url() })).min(1)
});
export type DigestRequest = z.infer<typeof DigestRequest>;

export function renderDigest(input: DigestRequest): string {
  return `<h1>${input.title}</h1><ul>${input.entries.map((entry) => `<li><a href="${entry.url}">${entry.title}</a></li>`).join("")}</ul>`;
}

export async function scheduleDigest(taskUrl: string): Promise<string> {
  const result = await infrai.cron.create({ cron_expr: "0 9 * * 1", task: taskUrl });
  return result.job_id;
}

export async function publishDigest(input: DigestRequest): Promise<void> {
  await infrai.queue.publish(input);
}

export async function processOneDigest(): Promise<string | undefined> {
  const result = await infrai.queue.consume(1, 60);
  const message = result.messages[0];
  if (!message) return undefined;
  const input = DigestRequest.parse(message.payload);
  for (const to of input.subscribers) await infrai.email.send({ to, subject: input.title, html: renderDigest(input) });
  await infrai.queue.ack(message.message_id);
  return message.message_id;
}

if (process.argv[1]?.endsWith("digest_service.ts")) {
  const request = DigestRequest.parse(JSON.parse(process.env.DIGEST_JSON ?? "{}"));
  await publishDigest(request);
  console.log(await processOneDigest());
}
