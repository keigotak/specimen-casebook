import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Specimen Casebook product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Specimen Casebook/i);
  assert.match(html, /Herbarium specimen/i);
  assert.match(html, /One bad date stopped/i);
  assert.match(html, /Darwin Core/i);
  assert.match(html, /Collection date/i);
  assert.match(html, /Upload evidence\. Keep every disagreement/i);
  assert.match(html, /Run Claude reconciliation/i);
  assert.doesNotMatch(html, /Your site is taking shape|preview placeholder/i);
});
