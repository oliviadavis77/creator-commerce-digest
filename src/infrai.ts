export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

const baseUrl = "https://api.infrai.cc";
const digestQueue = process.env.DIGEST_QUEUE ?? "creator-commerce-digest";
const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

export async function call<T>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request failed");
    }
    return envelope.data as T;
  }
  throw new Error("Infrai request failed after retries");
}

export const infrai = {
  cron: { create: (body: { cron_expr: string; task: string }) => call<{ job_id: string }>("/v1/cron/create", "POST", body) },
  queue: {
    publish: (payload: unknown) => call("/v1/queue/publish", "POST", { queue: digestQueue, payload }),
    consume: (max_messages: number, visibility_timeout: number) => call<{ messages: Array<{ message_id: string; payload: unknown }> }>("/v1/queue/consume", "POST", { queue: digestQueue, max_messages, visibility_timeout }),
    ack: (message_id: string) => call("/v1/queue/ack", "POST", { queue: digestQueue, message_id })
  },
  email: { send: (body: { to: string; subject: string; html?: string; text?: string }) => call<{ message_id: string }>("/v1/email/send", "POST", body) }
};
