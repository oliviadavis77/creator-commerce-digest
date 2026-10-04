import assert from "node:assert/strict";
import { DigestRequest, renderDigest } from "../src/digest_service.js";

const input = DigestRequest.parse({ subscribers: ["reader@example.com"], title: "Monday picks", entries: [{ title: "Studio notes", url: "https://example.com/notes" }] });
assert.match(renderDigest(input), /Studio notes/);
assert.throws(() => DigestRequest.parse({ subscribers: ["bad"], title: "x", entries: [] }));
console.log("digest boundary test passed");
