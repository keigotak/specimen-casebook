# Claude integration and grounding guarantees

Specimen Casebook now includes a real, server-side Claude reconciliation path:

```text
uploaded evidence
  -> POST /api/reconcile
  -> Claude structured extraction
  -> server-side quote grounding
  -> deterministic conflict policy
  -> human review
  -> Darwin Core CSV + provenance JSON
```

## API surface

### `GET /api/health`

Returns whether `ANTHROPIC_API_KEY` is configured and which model the server will use. It never returns the key.

### `POST /api/reconcile`

Accepts multipart form data:

- `caseTitle`: optional case label
- `files`: 1–8 evidence files

Supported evidence:

- Text, CSV and JSON
- JPEG, PNG, GIF and WebP images
- PDF documents

Limits:

- 5 MB per file
- 18 MB combined
- 8 files per request

The API key stays server-side. Browser code never receives or stores it.

## Model contract

The Messages API is called with a strict JSON Schema. Claude must return:

- one entry per biodiversity field;
- every materially different candidate value;
- source identifiers;
- verbatim evidence quotes;
- an explicit inference flag;
- a provisional evidence status.

`ANTHROPIC_MODEL` defaults to `claude-opus-4-8` and can be changed without editing source code.

## Guardrail 1: textual faithfulness

For text, CSV and JSON inputs, every quote proposed by Claude is checked against the original source with an exact substring match. An altered or invented quote is dropped.

The API reports:

- proposed quotes;
- grounded verbatim quotes;
- dropped quotes;
- textual faithfulness rate.

This follows the same pattern used by the companion `biomedical-evidence-agent`: model judgment is useful, but citation faithfulness is re-checked outside the model.

## Guardrail 2: deterministic conflict preservation

Claude does not control the publishable value. After extraction, a deterministic policy layer groups candidate values by normalized equality:

- zero grounded candidates -> `MISSING`;
- one explicit candidate -> `CONFIRMED`;
- one inferred candidate -> `INFERRED`;
- two or more distinct candidates -> `CONFLICTING`.

For a conflicting field, the server always sets `provisionalValue` to `null`, regardless of the status suggested by Claude. The UI and export both preserve all candidates and route the field to human review.

This makes unsupported conflict resolution structurally impossible in the application path rather than merely discouraged in the prompt.

## Guardrail 3: export carries unresolved uncertainty

The browser exports:

1. a Darwin Core-compatible CSV containing only provisional, non-conflicting values; and
2. a provenance JSON file containing every candidate, source quote, model request metadata and audit metric.

Any unresolved conflict is also summarized in the CSV `informationWithheld` field.

## Important limitation

Textual quotes can be verified byte-for-byte. Evidence transcribed from an image or scanned PDF cannot be independently verified by the server without a separate OCR representation, so those attributions are marked `visual` rather than `verbatim`. They remain reviewable and are never used to silently resolve a disagreement.

## Configuration

Local development:

```bash
cp .env.example .env
# Set ANTHROPIC_API_KEY in .env
npm run dev
```

Hosted deployments must store `ANTHROPIC_API_KEY` as a secret environment variable. Never commit an API key.
