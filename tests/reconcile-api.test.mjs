import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("health reports whether Claude is configured", async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const response = await worker.fetch(new Request("http://localhost/api/health"), env, ctx);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "ok");
    assert.equal(body.claudeConfigured, false);
  } finally {
    if (previous) process.env.ANTHROPIC_API_KEY = previous;
  }
});

test("reconciliation fails cleanly without an API key", async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const form = new FormData();
    form.append("files", new File(["June 17, 1907"], "label.txt", { type: "text/plain" }));
    const response = await worker.fetch(
      new Request("http://localhost/api/reconcile", { method: "POST", body: form }),
      env,
      ctx,
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "ANTHROPIC_NOT_CONFIGURED");
  } finally {
    if (previous) process.env.ANTHROPIC_API_KEY = previous;
  }
});

test("the policy layer preserves conflicts and drops invented quotes", async () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://api.anthropic.com/v1/messages");
    return new Response(
      JSON.stringify({
        id: "msg_test_001",
        model: "claude-opus-4-8",
        usage: { input_tokens: 800, output_tokens: 260 },
        content: [
          {
            type: "text",
            text: JSON.stringify({
              recordTitle: "Herbarium specimen — Tokyo, 1907",
              summary: "Three sources disagree on collection date.",
              fields: [
                {
                  field: "collectionDate",
                  label: "Collection date",
                  modelStatus: "CONFIRMED",
                  candidates: [
                    {
                      value: "1907-06-17",
                      inference: false,
                      rationale: "label value",
                      evidence: [
                        { sourceId: "SRC-001", quote: "June 17, 1907" },
                        { sourceId: "SRC-001", quote: "invented label quote" },
                      ],
                    },
                    {
                      value: "1907-06-19",
                      inference: false,
                      rationale: "ledger value",
                      evidence: [{ sourceId: "SRC-002", quote: "1907-06-19" }],
                    },
                    {
                      value: "1909-06-17",
                      inference: false,
                      rationale: "legacy value",
                      evidence: [{ sourceId: "SRC-003", quote: '"eventDate": "1909-06-17"' }],
                    },
                  ],
                },
              ],
            }),
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const form = new FormData();
    form.set("caseTitle", "Synthetic herbarium case");
    form.append("files", new File(["June 17, 1907"], "label.txt", { type: "text/plain" }));
    form.append(
      "files",
      new File(["record_number,collection_date\n2147,1907-06-19"], "ledger.csv", { type: "text/csv" }),
    );
    form.append(
      "files",
      new File(['{"eventDate": "1909-06-17"}'], "legacy.json", { type: "application/json" }),
    );

    const response = await worker.fetch(
      new Request("http://localhost/api/reconcile", { method: "POST", body: form }),
      env,
      ctx,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    const date = body.fields.find((field) => field.field === "collectionDate");
    assert.equal(date.status, "CONFLICTING");
    assert.equal(date.provisionalValue, null);
    assert.equal(date.candidates.length, 3);
    assert.equal(body.audit.droppedQuotes, 1);
    assert.equal(body.audit.unsupportedResolutionCount, 0);
    assert.equal(body.publicationDecision, "REVIEW_REQUIRED");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey) process.env.ANTHROPIC_API_KEY = previousKey;
    else delete process.env.ANTHROPIC_API_KEY;
  }
});
