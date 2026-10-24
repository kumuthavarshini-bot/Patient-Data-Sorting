# Requirements to Resolve Before Building

The BRD is the only requirements document found in the project. No implementation guide was present. These items are not silently assumed by this scaffold.

## Missing implementation guidance
- Technology stack, deployment target, browser support, and whether the HTML prototype must run without a server.
- Expected application architecture, coding conventions, package manager, and test strategy.
- Any UX artifacts or design system (the `Presentation/` directory is empty).

## Product decisions required
- Canonical customer schema: field names, types, required fields, formats, and schema versioning. The BRD names customer ID and email but does not provide the full schema.
- Import destination or mock service contract, authentication, response format, retries, and idempotency key.
- File size/row limits, supported encodings, delimiter behavior, malformed-row policy, retention/deletion, and safe download model.
- Date formats/timezone policy and supported normalization rules beyond whitespace, email casing, and dates.
- Duplicate scope across destination and batches; BRD default is to flag all same-batch conflicts.
- Definition of confidence thresholds and which mappings require human review.
- Required roles, identity/access model, audit retention, and security/privacy review criteria.
- Exact job status transition semantics and cancellation/resume behavior.

## Prototype choices to validate
- Whether import should be simulated locally or connected to a real service.
- Sample CSV fixtures and expected outcomes for success, malformed input, duplicates, missing IDs, invalid/ambiguous dates, and mapping review.
- Accessibility target: BRD specifies WCAG 2.2 AA.
- Proposed performance goal: 10,000 rows within 60 seconds under agreed conditions; this is not a verified SLA.

## BRD constraints carried into the scaffold
- CSV-only MVP; source data retained; transformations traceable.
- AI recommends; deterministic rules enforce validation and import eligibility.
- Ambiguous mappings pause for human confirmation.
- Invalid records get actionable, traceable exceptions, preserving original values.
- Every eligible import requires preview and user confirmation.
- Proposed success metrics are targets pending baseline and pilot validation.
