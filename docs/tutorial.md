# Tutorial: using Specimen Casebook

This is a hands-on walkthrough of the reconciliation workspace — what each button does, how to read the results, and how to run it on your own evidence. For the verification-focused tour, see the [five-minute judge's guide](judges-guide.md); for the API contract and guarantees, see [Claude integration](claude-integration.md).

## What the tool does

You give it several documents about the *same* specimen — a label, a field ledger, a legacy database row, a collector notebook, a taxonomy history. They often disagree. Specimen Casebook asks Claude to extract each biodiversity field with a supporting quote, then a deterministic policy layer compares the claims and **refuses to silently pick a winner** when sources conflict. The output is a reviewable record plus a Darwin Core export that carries the unresolved disagreements instead of hiding them.

## The three steps (mirrors the in-app guide)

1. **Load evidence.** Click **Load synthetic case** to populate the workspace with a ready-made example, or **＋ Add files** to upload your own. Supported: TXT, CSV, JSON, PDF, and images (JPEG/PNG/GIF/WebP). Limits: 5 MB per file, 8 files per case.
2. **Run reconciliation.** Click **Run Claude reconciliation →**. Claude reads every source, returns one entry per field with a verbatim quote and a source id, then the server re-checks each textual quote and applies the conflict policy. (The button is disabled until the API key is configured — see [Run locally](../README.md#run-locally).)
3. **Review & export.** Confirmed values are ready to publish; conflicts stay open with every candidate and its source. Click **↓ Export Darwin Core + provenance** to download the CSV plus a full provenance JSON.

## How to read a result

Each field carries one of four statuses:

| Status | Meaning |
| --- | --- |
| **CONFIRMED** | One grounded value. Safe to publish after review. |
| **CONFLICTING** | Two or more distinct grounded values. The provisional value is left empty (`null`) and the field is routed to human review — the model's own suggestion cannot override this. |
| **INFERRED** | A single value that is implied rather than stated word-for-word in its source. |
| **MISSING** | No evidence found in any source. |

Expand a field to see each **candidate value**, the **quote** that supports it, and a citation showing the source id, filename, and whether the quote was verified `verbatim` (exact substring of a text source) or transcribed `visual` (from an image/PDF, which the server cannot byte-check).

The **audit strip** under the fields reports the numbers that back the safety claim: grounded vs. proposed quotes, dropped (unfaithful) quotes, and the count of unsupported resolutions — which is always **0** by construction.

## Two synthetic cases to try

Both packs live under [`demo/mock/`](../demo/mock/) and are clearly marked synthetic — they are demonstration data, not real museum records.

**1. Herbarium specimen, Tokyo 1907** — [`case-scb-2025-0007/`](../demo/mock/case-scb-2025-0007/) (this is what **Load synthetic case** loads). The headline conflict is the **collection date**: the label says June 17 1907, the ledger says June 19 1907, and the legacy database says June 17 **1909**. The locality also disagrees (Takao vs. Takau). Expected: both fields land `CONFLICTING`, and 1909 never ships as fact.

**2. Ground-beetle specimen, Nikko 1934** — [`case-scb-2025-0012-nikko-beetle/`](../demo/mock/case-scb-2025-0012-nikko-beetle/). Upload these five files via **＋ Add files** to see a *different* kind of disagreement: a **collector-identity conflict**. Four sources say the collector was *K. Yamada*; the museum ledger records *K. Yamamoto* (and a different day). Running it live against `claude-opus-4-8` produces:

- `Recorded By` → **CONFLICTING** — `K. Yamada` (label, diary, accession card) vs. `K. Yamamoto` (ledger), provisional value left empty.
- `Collection Date` → **CONFLICTING** — `1934-08-05` vs. `1934-08-15`.
- `Catalog Number` → **CONFLICTING** — the model also surfaces `5581` vs. `TNS-I-0055581`.
- `Scientific Name` → **CONFIRMED** as the revised `Carabus (Ohomopterus) insulicola`, with the original name kept under `Original Name`.
- `Locality`, `Country`, `Habitat`, `Repository`, `Basis of Record` → **CONFIRMED**; `Family` → **MISSING**.

All 27 proposed quotes verified verbatim (0 dropped), `unsupportedResolutionRate` = 0, decision `REVIEW_REQUIRED`. This shows the invariant holding on a specimen and conflict type the app was not tuned around.

## Bringing your own evidence

- Give the tool the **same** specimen described by **different** sources; the value comes from comparison.
- Text, CSV, and JSON quotes are re-checked as exact substrings, so plain-text sources give the strongest, byte-verifiable provenance. Image/PDF transcriptions are marked `visual` and are never used to silently resolve a conflict.
- Keep each source small and focused (one specimen). The reconciled fields are the standard Darwin Core set: scientific name, original name, family, recordedBy, collection date, locality, country, elevation, habitat, catalog number, repository, basis of record.

## What the export contains

- **`specimen-casebook-darwin-core.csv`** — only provisional, non-conflicting values, mapped to Darwin Core terms. Any unresolved conflict is summarized in the `informationWithheld` column rather than dropped.
- **`specimen-casebook-provenance.json`** — every candidate, every source quote, the model request metadata, and the audit metrics, so a reviewer can reconstruct exactly how the record was assembled.

## The one rule

Two distinct grounded values always become `CONFLICTING`, and a conflicting field never receives a provisional value — regardless of what the model suggests. Claude proposes; the policy layer decides what can ship.
