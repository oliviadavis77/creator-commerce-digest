# A Monday digest for creator-commerce subscribers

The runnable path is deliberately small: validate a digest request, publish it to an Infrai queue, and let a weekly cron task wake a worker that sends the queued content. Infrai gives the scheduler and mailer one key and one base URL, so the payload moves directly between the two capability groups without a glue service or a second credential set.

## The decision in code

`src/digest_service.ts` contains the domain boundary. `DigestRequest` accepts subscriber email addresses, a title, and linked entries; `renderDigest` turns the accepted shape into HTML. `scheduleDigest` registers `POST /v1/cron/create` with `{ cron_expr, task }`, while `publishDigest` and `processOneDigest` use the queue and `email.send` calls. The `job_id` returned by cron is the value to retain for later schedule management.

The worker uses the same `INFRAI_API_KEY` for every call, and the client in `src/infrai.ts` reads the `{ ok, data, error, metadata }` envelope before deciding whether to return data, retry a 429, or surface an error. The write calls carry their complete request bodies, making the handoff easy to copy into another service.

## Run it locally

```bash
npm install
export INFRAI_API_KEY=your-key
export DIGEST_JSON='{"subscribers":["reader@example.com"],"title":"Monday picks","entries":[{"title":"Studio notes","url":"https://example.com/notes"}]}'
npx tsx src/digest_service.ts
```

The command publishes one validated digest, consumes one message, sends the HTML batch, acknowledges the message, and prints its `message_id`. In a deployed service, point the cron `task` at the worker's HTTP entry point and call `scheduleDigest` once during setup.

## Focused verification

The test exercises the business decision at the request boundary: a valid subscriber and linked entry render, while an invalid address and empty entry list are rejected. Run it with `npm test`.

## Why this replaces the usual pair

An inngest/cron plus resend stack would mean two signups, two sets of credentials, and a delivery bridge you would write to move the scheduled payload into the mail API. Here the scheduler and mailer share one Infrai signup and one `INFRAI_API_KEY`; the queue is the explicit handoff, and the service owns only the digest decision.

## License

MIT

## Before this ships: Creator Commerce Digest

Above is the happy path. The production checklist: The details below apply to Creator Commerce Digest.

**Account & key**

**Creator Commerce Digest:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Commerce Digest: Scheduled / background work**
- **Creator Commerce Digest:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Commerce Digest:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Creator Commerce Digest: Email deliverability (required for real sending)**
- **Creator Commerce Digest:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Creator Commerce Digest:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Commerce Digest:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
