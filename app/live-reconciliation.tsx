"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type EvidenceStatus = "CONFIRMED" | "CONFLICTING" | "INFERRED" | "MISSING";

type ReconciliationResult = {
  recordTitle: string;
  summary: string;
  publicationDecision: "REVIEW_REQUIRED" | "READY_FOR_REVIEW";
  generatedAt: string;
  claude: {
    model: string;
    requestId: string | null;
    usage: { input_tokens?: number; output_tokens?: number } | null;
  };
  sources: Array<{ id: string; name: string; mediaType: string; kind: string; bytes: number }>;
  fields: Array<{
    field: string;
    label: string;
    status: EvidenceStatus;
    modelStatus: string;
    provisionalValue: string | null;
    recommendedAction: string | null;
    candidates: Array<{
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
    }>;
  }>;
  audit: {
    proposedQuotes: number;
    groundedQuotes: number;
    droppedQuotes: number;
    visualAttributions: number;
    textualFaithfulnessRate: number | null;
    conflictingFieldCount: number;
    unsupportedResolutionCount: number;
    unsupportedResolutionRate: number;
    policy: string;
  };
};

const DEMO_FILES = [
  {
    name: "label_transcription.txt",
    type: "text/plain",
    text: `Rhododendron indica L.
Mt. Takao, Musashi Prov.
June 17, 1907
T. Nakai
Repository mark: Tokyo Natural Science Museum`,
  },
  {
    name: "field_ledger.csv",
    type: "text/csv",
    text: `record_number,scientific_name,collector,collection_date,verbatim_locality,accession_date
2147,Rhododendron indica L.,T. Nakai,1907-06-19,"Mt. Takau, Musashi Province",1907-07-02`,
  },
  {
    name: "legacy_record.json",
    type: "application/json",
    text: JSON.stringify({
      id: "TNS-0072147",
      scientificName: "Rhododendron indicum (L.) Sweet",
      originalName: "Rhododendron indica L.",
      recordedBy: "T. Nakai",
      eventDate: "1909-06-17",
      verbatimLocality: "Mt. Takao, Musashi Province",
      country: "Japan",
      basisOfRecord: "PreservedSpecimen",
    }, null, 2),
  },
  {
    name: "collector_notebook.txt",
    type: "text/plain",
    text: `17 June 1907 — Mt. Takao, Musashi Province.
Collected flowering Rhododendron at the forest edge, approximately 500 m.
Collector: T. Nakai.`,
  },
  {
    name: "taxonomy_history.csv",
    type: "text/csv",
    text: `effective_date,name,status
1907-06-17,Rhododendron indica L.,original_label_name
2025-05-20,Rhododendron indicum (L.) Sweet,accepted_name`,
  },
];

const DWC_MAP: Record<string, string> = {
  scientificName: "scientificName",
  originalName: "verbatimScientificName",
  family: "family",
  recordedBy: "recordedBy",
  collectionDate: "eventDate",
  verbatimLocality: "verbatimLocality",
  country: "country",
  elevation: "verbatimElevation",
  habitat: "habitat",
  catalogNumber: "catalogNumber",
  repository: "institutionCode",
  basisOfRecord: "basisOfRecord",
};

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function humanBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function LiveReconciliation() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState("Claude");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        setConfigured(Boolean(data.claudeConfigured));
        setModel(data.model || "Claude");
      })
      .catch(() => active && setConfigured(false));
    return () => { active = false; };
  }, []);

  const conflictCount = useMemo(
    () => result?.fields.filter((field) => field.status === "CONFLICTING").length || 0,
    [result],
  );

  function addFiles(incoming: File[]) {
    const allowed = incoming.filter((file) => file.size <= 5 * 1024 * 1024);
    setFiles((current) => [...current, ...allowed].slice(0, 8));
    setResult(null);
    setError(incoming.length !== allowed.length ? "Files over 5 MB were skipped." : null);
  }

  function loadDemo() {
    setFiles(DEMO_FILES.map((item) => new File([item.text], item.name, { type: item.type })));
    setResult(null);
    setError(null);
  }

  async function reconcile() {
    if (!files.length || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.set("caseTitle", "Herbarium specimen — Tokyo, 1907");
    files.forEach((file) => form.append("files", file));
    try {
      const response = await fetch("/api/reconcile", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Reconciliation failed.");
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reconciliation failed.");
    } finally {
      setRunning(false);
    }
  }

  function exportDarwinCore() {
    if (!result) return;
    const values: Record<string, string> = {};
    for (const field of result.fields) {
      const dwcField = DWC_MAP[field.field];
      if (dwcField && field.provisionalValue) values[dwcField] = field.provisionalValue;
    }
    const unresolved = result.fields
      .filter((field) => field.status === "CONFLICTING")
      .map((field) => `${field.label}: ${field.candidates.map((candidate) => candidate.value).join(" | ")}`);
    if (unresolved.length) values.informationWithheld = `Unresolved conflicts: ${unresolved.join("; ")}`;
    const headers = Object.keys(values);
    const csv = `${headers.map(csvCell).join(",")}\n${headers.map((header) => csvCell(values[header])).join(",")}\n`;
    download("specimen-casebook-darwin-core.csv", csv, "text/csv;charset=utf-8");
    download(
      "specimen-casebook-provenance.json",
      JSON.stringify(result, null, 2),
      "application/json;charset=utf-8",
    );
  }

  return (
    <section className="live-workbench" aria-labelledby="live-reconciliation-title">
      <div className="live-workbench-head">
        <div>
          <span className="eyebrow">LIVE CLAUDE RECONCILIATION</span>
          <h2 id="live-reconciliation-title">Upload evidence. Keep every disagreement.</h2>
          <p>This path sends the supplied sources to Claude, verifies textual quotes, and applies a deterministic no-silent-resolution policy.</p>
        </div>
        <div className={`api-badge ${configured ? "ready" : configured === false ? "missing" : "checking"}`}>
          <span />
          {configured ? `API live · ${model}` : configured === false ? "API key required" : "Checking API"}
        </div>
      </div>

      <ol className="workbench-steps" aria-label="How to use this workspace">
        <li>
          <span className="step-num">1</span>
          <div>
            <b>Load evidence</b>
            <small>Use the synthetic case, or add your own labels, ledgers, PDFs, CSV, JSON or images.</small>
          </div>
        </li>
        <li>
          <span className="step-num">2</span>
          <div>
            <b>Run reconciliation</b>
            <small>Claude extracts each field with a source quote; a policy layer then compares the claims.</small>
          </div>
        </li>
        <li>
          <span className="step-num">3</span>
          <div>
            <b>Review &amp; export</b>
            <small>Confirmed values are ready; conflicts stay open for review, then export Darwin Core + provenance.</small>
          </div>
        </li>
      </ol>

      <div className="live-workbench-body">
        <div className="live-input-panel">
          <div className="live-input-actions">
            <button className="live-demo-button" type="button" onClick={loadDemo}>Load synthetic case</button>
            <button className="live-upload-button" type="button" onClick={() => inputRef.current?.click()}>＋ Add files</button>
            <input
              ref={inputRef}
              hidden
              type="file"
              multiple
              accept=".txt,.csv,.json,.pdf,.jpg,.jpeg,.png,.gif,.webp"
              onChange={(event) => {
                addFiles(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
          </div>
          <div className="live-source-list" aria-live="polite">
            {!files.length && (
              <div className="live-empty">
                <b>Evidence workspace is empty</b>
                <span>Use the synthetic case or add labels, PDFs, CSV, JSON and images.</span>
              </div>
            )}
            {files.map((file, index) => (
              <div className="live-source" key={`${file.name}-${index}`}>
                <span className="live-source-id">SRC-{String(index + 1).padStart(3, "0")}</span>
                <span><b>{file.name}</b><small>{file.type || "inferred type"} · {humanBytes(file.size)}</small></span>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
              </div>
            ))}
          </div>
          <button
            className="run-reconciliation"
            type="button"
            disabled={!files.length || running || configured !== true}
            onClick={reconcile}
          >
            {running ? <><span className="run-spinner" /> Claude is reconciling evidence…</> : "Run Claude reconciliation →"}
          </button>
          {configured === false && <p className="live-setup-note">Set <code>ANTHROPIC_API_KEY</code> on the server to enable the real model call.</p>}
          {error && <p className="live-error" role="alert">{error}</p>}
        </div>

        <div className={`live-result-panel ${result ? "has-result" : ""}`}>
          {!result && !running && (
            <div className="result-placeholder">
              <div className="result-placeholder-mark">≠</div>
              <h3>Results stay source-linked</h3>
              <p>Claude proposes candidates. The policy layer independently preserves conflicts and drops unfaithful textual quotes.</p>
              <div className="policy-invariant"><span>POLICY INVARIANT</span><b>Unsupported resolution rate: 0%</b></div>
              <ul className="status-legend" aria-label="How to read each field's status">
                <li><span className="live-status confirmed">CONFIRMED</span> one grounded value</li>
                <li><span className="live-status conflicting">CONFLICTING</span> sources disagree — nothing auto-picked</li>
                <li><span className="live-status inferred">INFERRED</span> implied, not stated word-for-word</li>
                <li><span className="live-status missing">MISSING</span> no evidence found</li>
              </ul>
            </div>
          )}
          {running && (
            <div className="result-placeholder running">
              <div className="analysis-pulse"><i /><i /><i /></div>
              <h3>Comparing claims field by field</h3>
              <p>Extracting candidate values, checking source attribution, and applying publication safeguards.</p>
            </div>
          )}
          {result && (
            <div className="live-result">
              <div className="result-summary">
                <div>
                  <span className="eyebrow">CLAUDE RESULT · POLICY VERIFIED</span>
                  <h3>{result.recordTitle}</h3>
                  <p>{result.summary}</p>
                </div>
                <span className={`decision-badge ${conflictCount ? "review" : "ready"}`}>
                  {conflictCount ? `${conflictCount} conflict${conflictCount === 1 ? "" : "s"} · review required` : "Ready for review"}
                </span>
              </div>

              <div className="live-field-list">
                {result.fields.filter((field) => field.status !== "MISSING").map((field) => (
                  <details className={`live-field ${field.status.toLowerCase()}`} key={field.field} open={field.status === "CONFLICTING"}>
                    <summary>
                      <span><b>{field.label}</b><small>{field.provisionalValue || field.candidates.map((candidate) => candidate.value).join("  ≠  ")}</small></span>
                      <span className={`live-status ${field.status.toLowerCase()}`}>{field.status}</span>
                    </summary>
                    <div className="candidate-list">
                      {field.candidates.map((candidate, candidateIndex) => (
                        <div className="candidate" key={`${candidate.value}-${candidateIndex}`}>
                          <b>{candidate.value}</b>
                          {candidate.evidence.map((evidence, evidenceIndex) => (
                            <blockquote key={`${evidence.sourceId}-${evidenceIndex}`}>
                              “{evidence.quote}”
                              <cite>{evidence.sourceId} · {evidence.sourceName}{evidence.page ? ` · page ${evidence.page}` : ""} · {evidence.grounding}</cite>
                            </blockquote>
                          ))}
                        </div>
                      ))}
                      {field.recommendedAction && <p className="candidate-action">{field.recommendedAction}</p>}
                    </div>
                  </details>
                ))}
              </div>

              <div className="audit-strip">
                <div><span>Verbatim quotes</span><b>{result.audit.groundedQuotes}/{result.audit.proposedQuotes - result.audit.visualAttributions}</b></div>
                <div><span>Dropped quotes</span><b>{result.audit.droppedQuotes}</b></div>
                <div><span>Unsupported resolutions</span><b>{result.audit.unsupportedResolutionCount}</b></div>
                <div><span>Model</span><b>{result.claude.model}</b></div>
              </div>
              <button className="live-export" type="button" onClick={exportDarwinCore}>↓ Export Darwin Core + provenance</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
