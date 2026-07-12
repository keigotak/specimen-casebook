# Submission summary

*Built with Claude: Life Sciences — Builder track. ~184 words.*

Specimen Casebook is auditable data reconciliation for biodiversity collections. Herbarium and museum data managers digitize specimens whose sources disagree — a label, a field ledger, and a legacy database may record three different collection dates. Conventional pipelines flatten these into a single value and discard the reasoning, silently turning uncertainty into fact.

Specimen Casebook uses Claude's structured extraction to read every source field by field, returning a verbatim supporting quote and a source id for each claim. A deterministic policy layer re-checks each quote as an exact substring, drops any that were altered or invented, and refuses to auto-resolve a field when two grounded values disagree — marking it CONFLICTING and routing it to human review. The output is a Darwin Core CSV that carries unresolved disagreements in `informationWithheld` instead of hiding them, plus a full provenance JSON that lets a reviewer reconstruct every decision.

Claude proposes; the policy layer decides what can ship. The primary metric — unsupported resolution rate — holds at 0% across adversarial tests and live runs against claude-opus-4-8. Built for a named herbarium collections data manager, it is working software, not a demo.
