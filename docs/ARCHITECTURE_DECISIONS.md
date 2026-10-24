# Architecture Decisions

## ADR-001: Keep the existing static stack

**Decision:** Use Node.js built-ins for a reproducible local CLI runner and preserve the current static HTML/CSS/JS experience. **Reason:** The repository has no framework or dependencies, and `demo-core.js` already supplies the production-tested CSV parser and deterministic transforms. **Trade-off:** CLI orchestration does not provide a durable server or browser-run history.

## ADR-002: Reuse processing logic

The orchestrator requires the same `demo-core.js` functions used by the Live Demo. CSV is parsed once per run; original cells are retained in derived local outputs; exports use the existing formula-safe CSV escaping.

## ADR-003: Explicit mapping gate and provisional schema

Only `customer_id` is a required canonical target for the current run path, consistent with BR-01. A detected header is only a proposal; CLI execution requires `--approve-mappings`. A missing or ambiguous mapping produces `NEEDS_REVIEW` and does not run dependent agents. Optional canonical fields and extra validators are omitted until approved.

## ADR-004: Import is disabled

No import endpoint, authentication, idempotency contract, or receipt schema exists. The import phase is therefore recorded as `BLOCKED`; the final run status is `READY_FOR_REVIEW`, never `COMPLETED`.

## ADR-005: Local evidence and privacy

Run directories contain output CSVs that retain source values, so they are excluded from Git. Event logs and manifests contain a SHA-256 input fingerprint and counts, not cell data. Uploaded data remains in browser processing and is never sent to an external model. Only an unmatched chatbot question and eligible FAQ matching metadata may be sent to OpenAI when optional AI matching is enabled. Local data retention/deletion controls are not implemented.

## ADR-006: UX artifacts are evidence-labeled

The 10 UX workflow stages are distinct from the dashboard's existing seven product-planning phases and from seven CSV-processing phases. BRD-derived statements are identified as source evidence; research claims, interviews, usability findings, and performance results are not fabricated. The UX library is a plan and artifact set, not proof that unrun stages executed.

## ADR-007: Keep optional FAQ matching in a same-origin Node backend

**Decision:** Use Node built-in HTTP/fetch modules for the local application backend. Keep API credentials in the ignored project-root `.env`; deterministic matching runs first, while the backend can only select an eligible FAQ ID and return that record's exact local approved answer. **Reason:** The current UI is static and had no existing backend or environment loader; a small same-origin service avoids exposing credentials in the browser. **Trade-off:** The existing static Vercel deployment does not include this API endpoint; production AI matching needs a compatible server deployment before it can be enabled there.
