import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_FILES = 8;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 18 * 1024 * 1024;
const MAX_TEXT_CHARS = 220_000;
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const FIELD_NAMES = [
  "scientificName",
  "originalName",
  "family",
  "recordedBy",
  "collectionDate",
  "verbatimLocality",
  "country",
  "elevation",
  "habitat",
  "catalogNumber",
  "repository",
  "basisOfRecord",
] as const;

type EvidenceStatus = "CONFIRMED" | "CONFLICTING" | "INFERRED" | "MISSING";

type Source = {
  id: string;
  name: string;
  mediaType: string;
  kind: "text" | "image" | "pdf";
  text: string | null;
  bytes: number;
  base64?: string;
};

type RawEvidence = {
  sourceId?: string;
  quote?: string;
  page?: number;
};

type RawCandidate = {
  value?: string;
  inference?: boolean;
  rationale?: string;
  evidence?: RawEvidence[];
};

type RawField = {
  field?: string;
  label?: string;
  candidates?: RawCandidate[];
  modelStatus?: string;
};

type RawReconciliation = {
  recordTitle?: string;
  fields?: RawField[];
  summary?: string;
};

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    recordTitle: { type: "string" },
    summary: { type: "string" },
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string", enum: [...FIELD_NAMES] },
          label: { type: "string" },
          modelStatus: {
            type: "string",
            enum: ["CONFIRMED", "CONFLICTING", "INFERRED", "MISSING"],
          },
          candidates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                value: { type: "string" },
                inference: { type: "boolean" },
                rationale: { type: "string" },
                evidence: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sourceId: { type: "string" },
                      quote: { type: "string" },
                      page: { type: "integer" },
                    },
                    required: ["sourceId", "quote"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["value", "inference", "rationale", "evidence"],
              additionalProperties: false,
            },
          },
        },
        required: ["field", "label", "modelStatus", "candidates"],
        additionalProperties: false,
      },
    },
  },
  required: ["recordTitle", "summary", "fields"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are an evidence reconciliation engine for natural-history collections.

Your task is extraction and comparison, not silent resolution.

Rules:
1. Work field by field. Return every materially different candidate value.
2. Attach each candidate to the exact sourceId that supports it.
3. For text, CSV, or JSON sources, evidence.quote MUST be a short verbatim substring of that source. Never paraphrase a quote.
4. For images, transcribe only visible text. For PDFs, include a 1-based page number when possible.
5. Never merge different dates, spellings, identifiers, or names into one value.
6. If sources disagree, modelStatus must be CONFLICTING. Do not recommend one winner.
7. Mark inference=true only when the value is not explicitly stated in its source.
8. Do not invent missing values. Empty evidence means MISSING.
9. Be conservative. A later deterministic policy layer will independently enforce conflicts and verify textual quotes.`;

function extension(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function inferMediaType(file: File) {
  if (file.type) return file.type.toLowerCase();
  const ext = extension(file.name);
  const byExtension: Record<string, string> = {
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return byExtension[ext] || "application/octet-stream";
}

function classify(mediaType: string): Source["kind"] | null {
  if (mediaType === "application/pdf") return "pdf";
  if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
    return "image";
  }
  if (
    mediaType.startsWith("text/") ||
    mediaType === "application/json" ||
    mediaType === "application/csv"
  ) {
    return "text";
  }
  return null;
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

async function readSources(files: File[]): Promise<Source[]> {
  let total = 0;
  const sources: Source[] = [];
  for (const [index, file] of files.entries()) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`${file.name} exceeds the 5 MB per-file limit.`);
    }
    total += file.size;
    if (total > MAX_TOTAL_BYTES) throw new Error("Combined evidence exceeds 18 MB.");

    const mediaType = inferMediaType(file);
    const kind = classify(mediaType);
    if (!kind) throw new Error(`${file.name} has an unsupported file type.`);
    const id = `SRC-${String(index + 1).padStart(3, "0")}`;

    if (kind === "text") {
      const text = (await file.text()).slice(0, MAX_TEXT_CHARS);
      sources.push({ id, name: file.name, mediaType, kind, text, bytes: file.size });
    } else {
      const buffer = await file.arrayBuffer();
      sources.push({
        id,
        name: file.name,
        mediaType,
        kind,
        text: null,
        bytes: file.size,
        base64: bufferToBase64(buffer),
      });
    }
  }
  return sources;
}

function buildContent(sources: Source[], caseTitle: string) {
  const content: Array<Record<string, unknown>> = [];
  for (const source of sources) {
    content.push({
      type: "text",
      text: `SOURCE ${source.id}\nFilename: ${source.name}\nMedia type: ${source.mediaType}`,
    });
    if (source.kind === "text") {
      content.push({
        type: "text",
        text: `BEGIN ${source.id}\n${source.text}\nEND ${source.id}`,
      });
    } else if (source.kind === "image") {
      content.push({
        type: "image",
        source: { type: "base64", media_type: source.mediaType, data: source.base64 },
      });
    } else {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: source.base64,
        },
        title: source.name,
        context: `Evidence source ${source.id} for ${caseTitle}`,
      });
    }
  }
  content.push({
    type: "text",
    text: `Reconcile the supplied evidence for case: ${caseTitle}. Return all supported fields using the required schema.`,
  });
  return content;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function enforcePolicy(raw: RawReconciliation, sources: Source[]) {
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  let proposedQuotes = 0;
  let groundedQuotes = 0;
  let droppedQuotes = 0;
  let visualAttributions = 0;

  const fields = FIELD_NAMES.map((fieldName) => {
    const rawField = (raw.fields || []).find((field) => field.field === fieldName);
    const merged = new Map<
      string,
      {
        value: string;
        inference: boolean;
        rationale: string;
        evidence: Array<{
          sourceId: string;
          sourceName: string;
          quote: string;
          page: number | null;
          grounding: "verbatim" | "visual";
        }>;
      }
    >();

    for (const rawCandidate of rawField?.candidates || []) {
      const value = String(rawCandidate.value || "").trim();
      if (!value) continue;
      const evidence = [];
      for (const rawEvidence of rawCandidate.evidence || []) {
        proposedQuotes += 1;
        const source = sourceMap.get(String(rawEvidence.sourceId || ""));
        const quote = String(rawEvidence.quote || "").trim();
        if (!source || !quote) {
          droppedQuotes += 1;
          continue;
        }
        if (source.kind === "text") {
          if (!source.text?.includes(quote)) {
            droppedQuotes += 1;
            continue;
          }
          groundedQuotes += 1;
          evidence.push({
            sourceId: source.id,
            sourceName: source.name,
            quote,
            page: null,
            grounding: "verbatim" as const,
          });
        } else {
          visualAttributions += 1;
          evidence.push({
            sourceId: source.id,
            sourceName: source.name,
            quote,
            page: Number.isInteger(rawEvidence.page) ? Number(rawEvidence.page) : null,
            grounding: "visual" as const,
          });
        }
      }
      if (!evidence.length) continue;

      const key = normalize(value);
      const existing = merged.get(key);
      if (existing) {
        existing.evidence.push(...evidence);
        existing.inference = existing.inference && Boolean(rawCandidate.inference);
      } else {
        merged.set(key, {
          value,
          inference: Boolean(rawCandidate.inference),
          rationale: String(rawCandidate.rationale || ""),
          evidence,
        });
      }
    }

    const candidates = [...merged.values()].map((candidate) => ({
      ...candidate,
      evidence: candidate.evidence.filter(
        (item, index, all) =>
          all.findIndex(
            (other) =>
              other.sourceId === item.sourceId &&
              other.quote === item.quote &&
              other.page === item.page,
          ) === index,
      ),
    }));

    let status: EvidenceStatus;
    if (!candidates.length) status = "MISSING";
    else if (candidates.length > 1) status = "CONFLICTING";
    else if (candidates[0].inference) status = "INFERRED";
    else status = "CONFIRMED";

    return {
      field: fieldName,
      label: rawField?.label || fieldName.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      status,
      modelStatus: rawField?.modelStatus || "MISSING",
      provisionalValue:
        status === "CONFIRMED" || status === "INFERRED" ? candidates[0].value : null,
      candidates,
      recommendedAction:
        status === "CONFLICTING"
          ? "Do not publish without human review"
          : status === "MISSING"
            ? "No evidence found"
            : null,
    };
  });

  const conflictingFields = fields.filter((field) => field.status === "CONFLICTING");
  return {
    recordTitle: raw.recordTitle || "Reconciled specimen record",
    summary: raw.summary || "Evidence reconciled field by field.",
    publicationDecision: conflictingFields.length ? "REVIEW_REQUIRED" : "READY_FOR_REVIEW",
    fields,
    audit: {
      proposedQuotes,
      groundedQuotes,
      droppedQuotes,
      visualAttributions,
      textualFaithfulnessRate:
        proposedQuotes - visualAttributions > 0
          ? groundedQuotes / (proposedQuotes - visualAttributions)
          : null,
      conflictingFieldCount: conflictingFields.length,
      unsupportedResolutionCount: 0,
      unsupportedResolutionRate: 0,
      policy: "Conflicting candidates are never collapsed into a provisional value.",
    },
  };
}

async function callClaude(sources: Source[], caseTitle: string, apiKey: string) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 10_000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: buildContent(sources, caseTitle) }],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = (await response.json()) as {
    id?: string;
    model?: string;
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || `Claude API returned ${response.status}.`);
  }
  const text = payload.content?.find((block) => block.type === "text")?.text || "";
  if (!text) throw new Error("Claude returned no structured reconciliation.");
  return {
    raw: JSON.parse(text) as RawReconciliation,
    meta: {
      requestId: payload.id || null,
      model: payload.model || MODEL,
      usage: payload.usage || null,
    },
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Claude API is not configured for this deployment.",
        code: "ANTHROPIC_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "Upload at least one evidence file." }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Upload no more than ${MAX_FILES} files.` }, { status: 400 });
    }
    const caseTitle = String(form.get("caseTitle") || "Untitled specimen case").slice(0, 160);
    const sources = await readSources(files);
    const { raw, meta } = await callClaude(sources, caseTitle, apiKey);
    const result = enforcePolicy(raw, sources);
    return NextResponse.json({
      ...result,
      sources: sources.map(({ id, name, mediaType, kind, bytes }) => ({
        id,
        name,
        mediaType,
        kind,
        bytes,
      })),
      claude: meta,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reconciliation failed.";
    const clientError = /exceeds|unsupported file type/i.test(message);
    return NextResponse.json(
      { error: message, code: clientError ? "INVALID_EVIDENCE" : "CLAUDE_CALL_FAILED" },
      { status: clientError ? 400 : 502 },
    );
  }
}
