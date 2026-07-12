# Security and data handling

## API keys

- `ANTHROPIC_API_KEY` is read only on the server.
- The browser never receives, stores or logs the key.
- Keys belong in `.env` for local development or in the hosting provider's secret store.
- `.env` files are ignored by Git; `.env.example` contains names only.

## Uploaded evidence

- The application accepts at most 8 files, 5 MB per file and 18 MB total.
- Allowed formats are TXT, CSV, JSON, PDF, JPEG, PNG, GIF and WebP.
- The application does not persist uploaded evidence to a database or object store.
- Evidence is sent to the configured Anthropic API account for reconciliation. Operators remain responsible for their provider settings, data-processing terms and collection policies.

Do not upload confidential, personal, regulated or institution-restricted collection data without authorization.

## Untrusted document content

Uploaded documents are treated as evidence, not instructions. The model receives a fixed system contract and a strict output schema. A deterministic policy layer then checks textual quotes and prevents conflicts from becoming provisional values.

These controls reduce the impact of prompt injection but do not prove that every extracted candidate is scientifically correct. Human review remains mandatory for conflicting and visual evidence.

## Known boundary

TXT, CSV and JSON quotes are checked byte-for-byte. Text transcribed from an image or scanned PDF is labeled `visual`; the server cannot independently verify it without a separate OCR representation.

## Reporting a vulnerability

Please avoid posting secrets, API keys or sensitive evidence in a public issue. Open a minimal issue describing the affected component and request a private follow-up channel when sensitive details are required.
