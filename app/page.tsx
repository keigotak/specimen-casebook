"use client";

import { useMemo, useState } from "react";
import { LiveReconciliation } from "./live-reconciliation";

type FieldStatus = "Confirmed" | "Conflicting" | "Inferred" | "Missing";

type EvidenceField = {
  name: string;
  status: FieldStatus;
  value: string;
  sourceCount: number;
  strength: number;
};

const evidenceFields: EvidenceField[] = [
  { name: "Scientific name (current)", status: "Confirmed", value: "Rhododendron indicum (L.) Sweet", sourceCount: 2, strength: 4 },
  { name: "Scientific name (original)", status: "Confirmed", value: "Rhododendron indica L.", sourceCount: 1, strength: 4 },
  { name: "Collector", status: "Confirmed", value: "T. Nakai", sourceCount: 2, strength: 4 },
  { name: "Collection date", status: "Conflicting", value: "1907-06-17  vs  1907-06-19  vs  1909-06-17", sourceCount: 3, strength: 2 },
  { name: "Collection locality", status: "Conflicting", value: "Mt. Takao  vs  Mt. Takau", sourceCount: 2, strength: 3 },
  { name: "Elevation", status: "Inferred", value: "~500 m", sourceCount: 1, strength: 2 },
  { name: "Specimen ID (institution)", status: "Missing", value: "—", sourceCount: 0, strength: 0 },
  { name: "Habitat", status: "Inferred", value: "Forest edge", sourceCount: 1, strength: 2 },
];

const sources = [
  { id: "01", type: "LABEL PHOTO", title: "Specimen label", file: "label_photo.jpg", tone: "amber" },
  { id: "02", type: "FIELD LEDGER", title: "Collector ledger", file: "ledger_1907.pdf", tone: "blue" },
  { id: "03", type: "DATABASE", title: "Legacy record", file: "database_record.json", tone: "green" },
  { id: "04", type: "NOTEBOOK", title: "Field notebook", file: "field_notes.jpg", tone: "sand" },
  { id: "05", type: "TAXONOMY", title: "Name history", file: "taxonomy_history.csv", tone: "violet" },
];

const statusClass = (status: FieldStatus) => status.toLowerCase();

function StatusPill({ status }: { status: FieldStatus }) {
  return <span className={`status-pill ${statusClass(status)}`}><span className="status-dot" />{status}</span>;
}

function Strength({ value }: { value: number }) {
  return (
    <span className="strength" aria-label={`${value} of 5 evidence strength`}>
      {[1, 2, 3, 4, 5].map((dot) => <i key={dot} className={dot <= value ? "filled" : ""} />)}
    </span>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("Case overview");
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [showAllFields, setShowAllFields] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState("01");

  const visibleFields = useMemo(
    () => showAllFields
      ? [...evidenceFields, { name: "Country", status: "Confirmed" as FieldStatus, value: "Japan", sourceCount: 3, strength: 5 }, { name: "Province", status: "Inferred" as FieldStatus, value: "Musashi", sourceCount: 1, strength: 2 }]
      : evidenceFields,
    [showAllFields],
  );

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  }

  function toggleReview(field: string) {
    setReviewed((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);
  }

  return (
    <main className="app-shell">
      {notice && <div className="toast" role="status">{notice}</div>}

      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <div className="brand-name">Specimen Casebook</div>
            <div className="brand-sub">Auditable biodiversity records</div>
          </div>
        </div>

        <button className="new-case" onClick={() => flash("New case workspace ready")}>＋&nbsp; New case</button>

        <div className="case-label">ACTIVE CASE · SCB-2025-0007</div>
        <h1>Herbarium specimen<br /><em>Tokyo, 1907</em></h1>
        <div className="case-meta"><span>In review</span><time>Updated 2 min ago</time></div>

        <div className="side-divider" />
        <div className="side-heading">Evidence sources <b>5</b></div>
        <div className="source-list">
          {sources.map((source) => (
            <button key={source.id} className={`source-row ${activeSource === source.id ? "active" : ""}`} onClick={() => setActiveSource(source.id)}>
              <span className={`file-icon ${source.tone}`}>{source.id}</span>
              <span className="source-copy"><b>{source.title}</b><small>{source.file}</small></span>
              <span className="check">✓</span>
            </button>
          ))}
        </div>

        <button className="upload-zone" onClick={() => flash("Upload accepts JPG, PNG, PDF, CSV and JSON")}>
          <span className="upload-icon">↑</span>
          <b>Add evidence</b>
          <small>JPG, PNG, PDF, CSV, JSON</small>
        </button>

        <div className="sidebar-foot"><span>SC</span> Specimen Casebook v0.1</div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <nav aria-label="Case sections">
            {["Case overview", "Evidence", "Conflicts", "Timeline", "Notes"].map((tab) => (
              <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => { setActiveTab(tab); if (tab !== "Case overview") flash(`${tab} view selected`); }}>{tab}</button>
            ))}
          </nav>
          <div className="top-actions">
            <button className="share-button" onClick={() => flash("Secure review link copied")}>⌁&nbsp; Share case</button>
            <button className="export-button" onClick={() => flash("Darwin Core review package prepared")}>↓&nbsp; Export report</button>
            <button className="icon-button" aria-label="Settings">···</button>
          </div>
        </header>

        <LiveReconciliation />

        <div className="content-grid">
          <div className="primary-column">
            <section className="case-card specimen-card">
              <div className="section-heading-row">
                <div><span className="eyebrow">SPECIMEN OVERVIEW</span><h2>A record assembled from five imperfect sources</h2></div>
                <span className="confidence-label"><i /> Overall confidence&nbsp; <b>76%</b></span>
              </div>
              <div className="overview-grid">
                <div className="label-photo" role="img" aria-label="Historical herbarium specimen label from Mount Takao, 1907">
                  <div className="paper-no">No. 2147</div>
                  <div className="paper-name">Rhododendron indica L.</div>
                  <div className="paper-kanji">背高躑躅 標本葉</div>
                  <div className="paper-place">Mt. Takao, Musashi Prov.<br />June 17, 1907<br />T. Nakai</div>
                  <div className="paper-seal">東京<br />植物</div>
                  <div className="zoom-control"><span>−</span><b>100%</b><span>＋</span></div>
                </div>
                <div className="specimen-details">
                  <dl>
                    <div><dt>Local specimen ID</dt><dd>TNS-0072147</dd></div>
                    <div><dt>Accepted name</dt><dd>Rhododendron indicum <small>(L.) Sweet</small></dd></div>
                    <div><dt>Family</dt><dd>Ericaceae</dd></div>
                    <div><dt>Basis of record</dt><dd>Preserved specimen</dd></div>
                    <div><dt>Repository</dt><dd>Tokyo Natural Science Museum</dd></div>
                  </dl>
                  <div className="darwin-row"><span>DwC</span><p><small>Standards target</small><b>Darwin Core Archive</b></p></div>
                </div>
              </div>
            </section>

            <section className="case-card evidence-card">
              <div className="table-title"><div><span className="eyebrow">FIELD-BY-FIELD RECONCILIATION</span><h2>Evidence summary</h2></div><button onClick={() => flash("Review queue filtered to unresolved fields")}>2 need review →</button></div>
              <div className="evidence-table" role="table" aria-label="Evidence summary by field">
                <div className="table-row table-head" role="row"><span>Field</span><span>Status</span><span>Best value · provisional</span><span>Evidence</span><span>Sources</span></div>
                {visibleFields.map((field) => (
                  <div className={`table-row ${field.status === "Conflicting" ? "attention" : ""}`} role="row" key={field.name}>
                    <span className="field-name">{field.name}</span>
                    <span><StatusPill status={field.status} /></span>
                    <span className="field-value">{field.value}</span>
                    <span><Strength value={field.strength} /></span>
                    <span className="source-number">{field.sourceCount}</span>
                  </div>
                ))}
              </div>
              <button className="view-fields" onClick={() => setShowAllFields((value) => !value)}>{showAllFields ? "Show fewer fields" : "View all 24 fields"} <span>{showAllFields ? "↑" : "↓"}</span></button>
            </section>

            <section className="case-card source-strip-card">
              <div className="section-heading-row compact"><div><span className="eyebrow">SOURCE EVIDENCE</span><h2>Every claim stays linked to its origin</h2></div><span className="source-count">5 sources</span></div>
              <div className="source-strip">
                {sources.map((source) => (
                  <button key={source.id} className={`source-tile ${source.id === activeSource ? "active" : ""}`} onClick={() => setActiveSource(source.id)}>
                    <span className={`tile-preview ${source.tone}`}><i>{source.type}</i><b>{source.id}</b></span>
                    <strong>{source.title}</strong><small>{source.file}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="insight-column">
            <section className="case-card impact-card">
              <span className="eyebrow">PUBLISHING SAFEGUARD</span>
              <div className="shield-mark">!</div>
              <h2>One bad date stopped<br />before publication</h2>
              <p>The legacy database says <b>1909</b>. The original label and field ledger both point to <b>1907</b>.</p>
              <div className="impact-stat"><strong>1909</strong><span>not silently<br />published as fact</span></div>
            </section>

            <section className="case-card findings-card">
              <div className="section-heading-row compact"><div><span className="eyebrow">KEY FINDINGS</span><h2>Record health</h2></div><span className="health-score">7/10</span></div>
              <div className="finding-bars">
                <div><StatusPill status="Confirmed" /><span className="bar"><i style={{ width: "70%" }} /></span><b>7</b></div>
                <div><StatusPill status="Conflicting" /><span className="bar amber"><i style={{ width: "20%" }} /></span><b>2</b></div>
                <div><StatusPill status="Inferred" /><span className="bar blue"><i style={{ width: "20%" }} /></span><b>2</b></div>
                <div><StatusPill status="Missing" /><span className="bar gray"><i style={{ width: "10%" }} /></span><b>1</b></div>
              </div>
            </section>

            <section className="case-card conflicts-card">
              <div className="section-heading-row compact"><div><span className="eyebrow">CONFLICT QUEUE</span><h2>Review before export</h2></div><span className="count-badge">2</span></div>
              <div className="conflict-item">
                <div className="conflict-top"><span className="orange-dot" /><b>Collection date</b><button className={reviewed.includes("date") ? "resolved" : ""} onClick={() => toggleReview("date")}>{reviewed.includes("date") ? "Reviewed ✓" : "Review"}</button></div>
                <div className="date-compare">
                  <div><small>LABEL</small><b>Jun 17, 1907</b></div><span>≠</span><div><small>LEDGER</small><b>Jun 19, 1907</b></div><span>≠</span><div className="bad"><small>LEGACY DB</small><b>Jun 17, 1909</b></div>
                </div>
                <p><span>Recommended:</span> Do not publish without human review.</p>
              </div>
              <div className="conflict-item minor">
                <div className="conflict-top"><span className="orange-dot" /><b>Locality spelling</b><button className={reviewed.includes("locality") ? "resolved" : ""} onClick={() => toggleReview("locality")}>{reviewed.includes("locality") ? "Reviewed ✓" : "Review"}</button></div>
                <div className="inline-compare"><span>“Takao” <small>label</small></span><i>vs</i><span>“Takau” <small>ledger</small></span></div>
              </div>
            </section>

            <section className="case-card timeline-card">
              <div className="section-heading-row compact"><div><span className="eyebrow">PROVISIONAL TIMELINE</span><h2>Chain of custody</h2></div></div>
              <ol className="timeline">
                <li><time>17 JUN 1907</time><div><b>Specimen collected</b><small>Label · Field notebook</small></div></li>
                <li><time>19 JUN 1907</time><div><b>Entered in ledger</b><small>Collector ledger</small></div></li>
                <li><time>02 JUL 1907</time><div><b>Registered as no. 2147</b><small>Museum accession</small></div></li>
                <li><time>20 MAY 2025</time><div><b>Digitized and reconciled</b><small>Specimen Casebook</small></div></li>
              </ol>
            </section>

            <section className="case-card export-card">
              <div><span className="eyebrow">READY WHEN REVIEWED</span><h2>Publish trustworthy data</h2><p>Export includes field-level provenance and unresolved conflicts.</p></div>
              <button onClick={() => flash("Export blocked: 2 conflicts still require review")}>↓&nbsp; Export Darwin Core</button>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
