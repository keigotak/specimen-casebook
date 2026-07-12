# Judge's guide: verify the project in five minutes

This guide points to the shortest path for verifying that Specimen Casebook is more than a UI mock.

## 1. Understand the user and failure mode — 45 seconds

The named user is a **herbarium collections data manager**. Their sources disagree:

- specimen label: `June 17, 1907`;
- field ledger: `1907-06-19`;
- legacy database: `1909-06-17`.

The product must not silently select one date and publish it as fact.

Open the [synthetic evidence pack](../demo/mock/README.md) to inspect every input and the expected reconciliation.

## 2. Inspect the real Claude call — 60 seconds

Open [`app/api/reconcile/route.ts`](../app/api/reconcile/route.ts).

The endpoint:

1. accepts multipart TXT, CSV, JSON, image and PDF uploads;
2. sends them to the Anthropic Messages API;
3. requires a strict JSON Schema response;
4. keeps the API key server-side;
5. returns model and token-usage metadata with the audited result.

Set `ANTHROPIC_API_KEY` locally to exercise the live model path. The interface still loads without a key and clearly reports that live reconciliation is not configured.

## 3. Inspect the safety boundary — 90 seconds

Search the same route for `enforcePolicy`.

Two independent checks run after Claude responds:

- **Citation faithfulness:** a quote attributed to TXT, CSV or JSON evidence is kept only when it is an exact substring of that source.
- **Conflict preservation:** two distinct grounded candidates always produce `CONFLICTING`; the server sets `provisionalValue` to `null` even when the model proposes `CONFIRMED`.

This is an application invariant, not a prompt-only instruction.

The full rationale and limitations are documented in [Claude integration and grounding guarantees](claude-integration.md).

## 4. Run the adversarial test — 60 seconds

```bash
npm ci
npm test
```

[`tests/reconcile-api.test.mjs`](../tests/reconcile-api.test.mjs) deliberately mocks Claude returning:

- `modelStatus: CONFIRMED` for three incompatible dates; and
- one invented source quote.

The expected result is still:

- `status: CONFLICTING`;
- `provisionalValue: null`;
- invented quote dropped;
- `unsupportedResolutionCount: 0`.

## 5. Review the output — 45 seconds

The browser downloads two artifacts:

- a Darwin Core-compatible CSV containing only non-conflicting provisional values; and
- a provenance JSON file containing every candidate, source quote, model request identifier, token usage and audit metric.

Unresolved fields are also disclosed through the CSV `informationWithheld` field.

## What is synthetic?

The herbarium case and historical documents are synthetic demonstration evidence. The upload path, Claude request, response schema, grounding checks, conflict policy, review UI, tests and export logic are working product code.
