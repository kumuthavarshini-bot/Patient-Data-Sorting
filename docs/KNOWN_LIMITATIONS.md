# Known limitations and decisions

- Canonical schema proposal is not business-approved; runtime currently enforces only BRD-supported required Customer ID and same-batch duplicate ID rules.
- No import destination, authentication, idempotency, receipt, or partial-failure contract exists; import always blocks.
- CLI mapping gate records explicit approval but has no identity/signature service.
- Runtime is sequential and local; retry, resume, cancellation, persistent job service, UI monitoring, and concurrent-run control are not implemented.
- Run directories contain derived CSVs with original values and may be sensitive; role controls, encryption, retention, and deletion automation are not implemented.
- Optional AI-assisted FAQ matching is available only through the local Node server when enabled with valid server-side credentials/model access. It classifies unmatched questions against eligible approved FAQ entries; it cannot author answers. The current static production deployment does not include the API backend.
- No interviews, external competitor research, observed usability test, performance SLA, or production test is claimed.
- UX artifacts are BRD-derived plans/templates and traceability documentation; they are not evidence that all design stages were executed by agents.
- The dashboard's seven product-planning phase statuses are a local prototype checklist and are not runtime pipeline statuses.
- Browser mobile/accessibility verification and production deployment verification remain to be performed.
