# Contributing

Specimen Casebook is a hackathon prototype focused on auditable biodiversity-record reconciliation.

## Before opening a pull request

```bash
npm ci
npm run lint
npm test
```

Please keep these invariants intact:

- conflicting grounded candidates must never receive a provisional winner;
- text-source quotations must be exact source substrings;
- uploaded evidence and API keys must not be logged or committed;
- Darwin Core exports must disclose unresolved fields;
- visual evidence must remain distinguishable from server-verified verbatim evidence.

New reconciliation behavior should include a focused API-level test.
