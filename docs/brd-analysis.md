# Customer Data Cleaner — BRD Analysis

## 1. Business problem

Organizations receive customer CSV files from multiple sources. Column names, formats, identifiers, and data quality vary, leading to manual preparation, delayed onboarding, duplicate or incomplete records, import failures, and unclear rejection reasons.

The proposed product provides a repeatable, auditable process to profile, map, normalize, validate, and import customer data. It routes invalid records to actionable exceptions and gives operations users control over uncertain decisions.

The BRD also identifies the application as a portfolio case study for AI orchestration, enterprise workflows, validation, exception handling, and human review.

## 2. Target users and stakeholders

| User or stakeholder | Need described in the BRD |
|---|---|
| Customer Data Operations Analyst — primary persona | Upload files, review mappings, resolve errors, reprocess corrected data, and import accurate records without extensive manual spreadsheet work. |
| Data steward | Define the canonical schema and data-quality rules. |
| System administrator | Configure access, schemas, and import settings. |
| Business owner | Define onboarding goals and success metrics. |
| Engineering team | Build orchestration, processing, and integrations. |
| Security and compliance | Review access controls, retention, and auditability. |

The BRD does not define role permissions or authentication behavior.

## 3. Scope

**MVP scope:** CSV upload and structure inspection; profiling; source-to-canonical field mapping; supported normalization; required-field, format, type, and uniqueness validation; valid/invalid record separation; downloadable exception files; import preview and confirmation; status/count summaries; and processing audit history.

**Out of scope for the initial release:** broad real-time CRM/ERP synchronization, autonomous ambiguous identity correction, cross-system record merging, complex master data management/entity resolution, unreviewed AI changes, and predictive analytics.

## 4. Expected outcomes

The BRD proposes these pilot targets. They are goals, not measured results:

| Objective | Proposed target |
|---|---:|
| Reduce time spent preparing files | 40% |
| Records passing validation after correction | At least 95% |
| Mapping automatic or accepted with minimal edits | At least 80% |
| Detected duplicates blocked under configured rules | 100% |
| Invalid records with actionable error reasons | 100% |
| Eligible records processed successfully | At least 99% |
| Processing runs with auditable outcomes | 100% |

Baselines and targets require stakeholder agreement and pilot measurement. The separate performance goal is 10,000 rows within 60 seconds under agreed conditions, excluding human review and external import latency; it is not a guaranteed SLA.

## 5. Functional requirements

| ID | Priority | Requirement |
|---|---|---|
| FR-01 | P0 | Upload a supported CSV and display filename, size, and row count. |
| FR-02 | P0 | Detect delimiters, headers, column types, blank values, and malformed rows. |
| FR-03 | P0 | Profile the dataset and summarize potential quality issues. |
| FR-04 | P0 | Suggest mappings from source fields to the canonical customer schema. |
| FR-05 | P0 | Let users edit, confirm, and save mappings. |
| FR-06 | P0 | Flag ambiguous or low-confidence mappings for human review. |
| FR-07 | P0 | Normalize supported dates, email casing, whitespace, and configured formats. |
| FR-08 | P0 | Preserve source values and record transformation history. |
| FR-09 | P0 | Validate required fields, data types, formats, and duplicate IDs. |
| FR-10 | P0 | Show validation errors at dataset and record level. |
| FR-11 | P0 | Separate valid and invalid records before import. |
| FR-12 | P0 | Generate exception CSVs with original values, row identifiers, and error codes. |
| FR-13 | P0 | Preview eligible records and require confirmation before import. |
| FR-14 | P0 | Display import results, failure counts, and downloadable outputs. |
| FR-15 | P1 | Allow users to correct exceptions and reprocess them. |
| FR-16 | P1 | Save reusable mapping templates for recurring source files. |
| FR-17 | P1 | Support configurable schema versions and validation rules. |
| FR-18 | P0 | Provide processing history and audit logs. |
| FR-19 | P1 | Support larger files with asynchronous processing and status updates. |
| FR-20 | P0 | Provide role-based access and configurable retention policies. |

## 6. Non-functional requirements

| Category | BRD requirement |
|---|---|
| Security | Encrypt data in transit and at rest; restrict access by role. |
| Privacy | Avoid sending unnecessary customer information to AI models. |
| Reliability | Recover from transient failures without corrupting processing state. |
| Performance | Target 10,000 rows within 60 seconds under agreed test conditions, excluding human review and external import latency. |
| Scalability | Support asynchronous jobs and configurable file-size limits. |
| Explainability | Give reasons for mappings, transformations, and validation failures. |
| Auditability | Maintain traceable processing history and configuration versions. |
| Accessibility | Target WCAG 2.2 AA. |
| Data integrity | Preserve source data and prevent invalid records from bypassing required validation. |
| Usability | Display progress, actionable errors, counts, and next steps. |

## 7. Planned seven-phase workflow

The phase split below follows the existing scaffold and BRD workflow. The BRD’s import and exception routes are branches after validation, with corrected exceptions looping back through processing.

| Phase | Inputs | Planned outputs | Gate / approval |
|---|---|---|---|
| 1. Upload | User-selected CSV and upload action | Source file reference, filename, size, row count, intake findings | Supported CSV and safe structure under configured policies; malformed or unsafe input blocks processing with actionable feedback. |
| 2. Profile | Uploaded file and parsing metadata | Column profile, inferred types, missing values, anomalies, potential duplicates | Findings refer to rows/columns; malformed content that prevents safe interpretation blocks progression. Profiling observes but does not modify source. |
| 3. Mapping | Profile, source headers/evidence, versioned canonical schema | Suggested and confirmed mappings, rationale/confidence, unresolved fields | User can edit/confirm mappings; ambiguous or low-confidence mapping requires review before normalization. |
| 4. Normalization | Source rows, confirmed mappings, approved transformation rules | Working normalized values and transformation history; original values retained | Only approved, traceable transformations; ambiguous dates or unsupported guesses are flagged rather than silently changed. |
| 5. Validation | Normalized records, schema and rule versions, batch identity | Record-level outcomes, errors/codes, summary counts, eligible set | Deterministic rules complete; every duplicate conflict row is marked; counts reconcile; no unvalidated record is eligible. |
| 6. Exceptions | Source rows, validation outcomes, error catalog, run ID | Exception CSV, error summary, correction/reprocessing references | Preserve original values and all errors; corrected records must be revalidated before eligibility. |
| 7. Import | Validated eligible rows, summary, destination contract, user confirmation | Import receipt, accepted/rejected/not-processed counts, outputs, final status | Preview and explicit confirmation required; only eligible records imported; failures and partial outcomes reported and auditable. |

The BRD defines statuses `Uploaded`, `Profiled`, `Mapping Review`, `Normalized`, `Validated`, `Import Ready`, and `Completed`, plus `Needs Review`, `Failed`, `Cancelled`, and `Partially Imported`. It requires transient retries to avoid duplicate side effects and says unresolved decisions or failed upstream phases block downstream work.

## 8. Five agents

| Agent | Input | Output | Control boundary |
|---|---|---|---|
| Profile | Uploaded CSV | Schema profile and quality findings | Report observations without changing source data. |
| Mapping | Source profile and target schema | Mappings and confidence indicators | Require human approval for unresolved ambiguity. |
| Normalization | Confirmed mappings and rules | Standardized records and transformation log | Do not silently guess ambiguous values; preserve originals. |
| Validation | Normalized records and rules | Pass/fail outcomes and error codes | Enforce rules deterministically. |
| Exception | Validation results and source rows | Exception CSV and error summary | Preserve originals and identify every failure. |

Upload and controlled import are workflow capabilities, not additional agents in the BRD’s five-agent list.

## 9. Business rules and approval gates

| Rule | Required behavior |
|---|---|
| BR-01 — Customer ID mandatory | Reject missing or blank IDs. |
| BR-02 — Batch ID uniqueness | Flag every row involved in a duplicate conflict. The stated default is to flag all conflicts, not choose a winner. |
| BR-03 — Required fields | Route records missing mandatory target values to exceptions. |
| BR-04 — Email format | Flag invalid email; do not invent replacements. |
| BR-05 — Dates | Normalize only with explicit or confirmed format; flag ambiguous or invalid dates. |
| BR-06 — Ambiguous mapping | Block progression until required mapping decision is confirmed. |
| BR-07 — Approved normalization | Use approved rules and preserve originals for audit. |
| BR-08 — Import eligibility | Only records that pass required validation may be imported. |
| BR-09 — Safe reprocessing | Use stable identifiers and idempotent import controls where supported. |
| BR-10 — Traceable failure | Every failed validation has record ID, rule ID, and human-readable reason. |

Other explicit approval points: user confirmation of mappings when needed, and user confirmation after import preview. Corrected exceptions must pass validation again.

## 10. Dependencies and failure scenarios

**BRD dependencies:** canonical customer schema and mandatory-field definitions; CSV parser/processing service; normalization and validation rules; an import destination or mock service; secure storage for source/intermediate/exception files; and orchestration for agents and job status.

**Failure and edge scenarios called out:**

- Invalid encoding, missing headers, malformed rows: actionable file errors and unsafe processing blocked.
- Ambiguous field mapping: request human confirmation.
- Invalid or ambiguous dates: flag without unsupported correction.
- Duplicate IDs: flag all conflicting rows and exclude them from import.
- Missing required values or invalid email: exclude from import and give actionable exceptions.
- Import service outage: accurately report failure/partial status and resume safely without unintended duplicates.
- Mid-process failures: persist job state and retry safely.
- Large files: configurable limits, asynchronous processing, and progress.
- Schema changes: version schema and revalidate mappings.
- Multiple errors on one record: capture all applicable errors without duplicate exception rows.
- Malicious spreadsheet content: validate structure, restrict formats, and sanitize exports against formula injection.
- Sensitive exception output: access controls, secure downloads, and retention policies.

## 11. Traceability: BRD requirements to planned features and acceptance criteria

The criteria below refer to BRD acceptance scenarios AC-01 through AC-09. Where the BRD has no direct acceptance scenario, the criterion is derived from the requirement text and should be confirmed during detailed requirements work.

| Requirement | Planned feature | Acceptance evidence |
|---|---|---|
| FR-01 | CSV intake and file summary | AC-09 for malformed input; verify supported upload displays filename, size, and row count. |
| FR-02 | CSV structural inspection | AC-09; report encoding/header/row failures and block unsafe processing. |
| FR-03 | Profile summary | Profile output provides quality findings, missingness, types, and anomalies without modifying data. |
| FR-04 | AI-assisted mapping suggestions | AC-05; suggestions include confidence/rationale against canonical schema. |
| FR-05 | Editable, confirmable, reusable mapping record | User edits/confirms and mapping is saved; no direct AC, derived from FR. |
| FR-06 | Ambiguity review gate | AC-05; workflow pauses for confirmation rather than silently mapping. |
| FR-07 | Allowlisted normalization | AC-04 and AC-06; supported values normalize; ambiguous/invalid dates are flagged. |
| FR-08 | Original-value retention and transformation log | AC-04; verify source remains preserved and transformations traceable. |
| FR-09 | Deterministic schema/rule validation | AC-02, AC-03, AC-06; duplicates, missing fields, and invalid dates handled. |
| FR-10 | Dataset summary and record-level errors | AC-02/03 and UX requirements; user can inspect errors behind counts. |
| FR-11 | Valid/invalid routing | AC-02/03; invalid rows excluded from import eligibility. |
| FR-12 | Downloadable exception CSV | AC-03; include original values, row identity, error code and actionable reason per BRD. |
| FR-13 | Eligible-row preview and confirmation | AC-01; confirm import only after preview. |
| FR-14 | Import receipt and downloadable results | AC-01 and AC-08; counts/status reflect success, failure, or partial outcomes. |
| FR-15 | Correction and reprocessing | AC-07; correction is revalidated and eligible only if it passes. |
| FR-16 | Reusable mapping templates | No direct AC; verify template can be saved/reused, subject to template behavior decision. |
| FR-17 | Versioned schema and rules | AC-05 plus schema-change risk; record versions and revalidate mappings. |
| FR-18 | Run history and audit logs | Definition of Done requires traceable agent outputs; verify run/version/timestamp outcomes. |
| FR-19 | Async processing and status updates | No direct AC; verify large-file jobs report progress/status once limits are defined. |
| FR-20 | Role-based access and retention | No direct AC; security/compliance review and access/retention criteria needed. |

## 12. Repository inventory: preserve or reuse

| Existing path | Contents/status | Recommendation |
|---|---|---|
| `input/customer_data_cleaner_BRD.md` | Primary BRD, draft v1.0 | Preserve as source of truth until stakeholders replace or approve a newer version. |
| `AGENTS.md` | Project guidance created for the scaffold | Reuse as planning constraints; revisit against approved implementation guide. |
| `workflow/orchestrator.yaml` | Seven-phase sequence, states, references | Reuse as a draft; revise routing so exception handling and eligible import are parallel branches and reprocessing loops back. |
| `workflow/phases/*/` | Phase inputs, purpose, gates, output README files | Reuse as phase-contract drafts; clarify exact artifacts after schema and import contract are defined. |
| `agents/*.md` | Five runtime instruction drafts matching the BRD agents | Reuse as planning artifacts; not executable agents. |
| `skills/*.md` | Seven capability/skill drafts | Reuse as planning guidance; distinguish source BRD requirements from implementation proposals. |
| `workflow/REQUIREMENTS.md` | Open-decision inventory | Reconcile with the questions below and keep unresolved requirements visible. |
| `Presentation/` | Empty directory | No dashboard/design artifact found to reuse. |
| `output/` | Only `.DS_Store` | No dashboard or generated deliverable found. |
| `tests/` | Only `.DS_Store` | No fixtures or acceptance tests found. |
| Application code | None found in the inspected file inventory | No existing application implementation to preserve. |

## 13. Missing information, assumptions, contradictions, and decisions

### Missing from the BRD / unresolved

- Full canonical schema, field definitions, required fields beyond Customer ID, and accepted formats.
- Exact date formats/timezone policy and the complete set of supported transformations.
- File limits, accepted encodings, delimiter/quoting policy, malformed-row handling, and browser/platform support.
- Import destination or mock service interface, identity/authentication, idempotency mechanism, and receipt contract.
- Mapping confidence thresholds and exact rule for which mappings require approval.
- Role definitions, access-control behavior, retention periods, and audit-log retention.
- Cross-batch/existing-destination duplicate-check behavior; the BRD says check existing records “where supported” but does not define destination behavior.
- Cancellation, retry, resume, and job-state transition semantics.
- UX design system, dashboard files, and implementation stack. No implementation guide was found.

### Assumptions explicitly stated by the BRD

- Initial release accepts CSV only.
- A predefined target customer schema exists.
- Users have permission to process uploaded data.
- AI suggestions cannot override deterministic validation.
- First release has one destination or a simulated import.
- Stakeholders will define exact uniqueness, mandatory-field, and accepted-format rules before launch.

### Contradictions or design tensions to resolve

- **Workflow routing:** BRD section 6 sends valid records to preview/import and invalid records to exceptions. The current scaffold’s `orchestrator.yaml` lists exceptions then import as one linear sequence. It should represent these as branches after validation, with corrected exceptions looping back through normalization/validation.
- **Required fields:** BR-01 makes Customer ID mandatory, while BR-03 refers to additional required fields defined by target schema. The full list is not supplied.
- **Duplicate scope:** BR-02 defines uniqueness within a batch. Edge-case mitigation also suggests checking existing destination records where supported. These are distinct checks and destination support is unspecified.
- **Reprocessing path:** BRD describes both re-upload and reprocessing corrected exceptions, but does not define whether corrections happen inside the app or in a downloaded CSV.
- **“Five agents” vs seven phases:** Five named agents are clear; upload and import are workflow responsibilities but have no agent assignment in the BRD.
- **Import success criterion:** Proposed metric says at least 99% of eligible records processed successfully, while AC-01 expects all eligible records imported in the successful-import scenario. These can coexist as target vs ideal scenario, but measurement definitions should be explicit.

### Questions requiring the product owner’s decision

1. What is the canonical customer schema and which fields are mandatory?
2. Should the first prototype simulate import locally, and what should its single destination represent?
3. Where should users correct exceptions: in-app editing, downloaded/re-uploaded CSV, or both?
4. Which date formats/timezone rules and transformations are approved?
5. What file-size/row limits and malformed-row policy should govern the MVP?
6. What mapping confidence level or conditions trigger mandatory human review?
7. Should duplicate detection include existing destination records in the first release, or only rows in the current batch?
8. What user roles and retention/audit periods must the design represent?
9. What implementation guide, UX references, or dashboard design should be treated as authoritative if stored elsewhere?

## 14. Recommended implementation sequence

This is a planning sequence, not authorization to implement now:

1. Resolve canonical schema, required fields, formats, and duplicate scope.
2. Approve import/reprocessing behavior and define the simulated or real destination contract.
3. Confirm UX flow, user roles, file policies, and audit/retention expectations.
4. Define structured input/output contracts and correct orchestrator routing for branches, retries, and status transitions.
5. Create representative CSV fixtures and acceptance examples covering the BRD scenarios.
6. Build the upload/profile/mapping foundation.
7. Add normalization and deterministic validation.
8. Add exception generation, correction/reprocessing, and audit history.
9. Add controlled import preview, confirmation, idempotency, and result reporting.
10. Evaluate accessibility, performance target, security/privacy, and pilot outcomes.

## 15. Single recommended next milestone

**Approve the canonical customer schema and its mandatory fields, accepted formats, and duplicate policy.** The BRD identifies these as foundational decisions, and the mapping, normalization, validation, exception, and import contracts depend on them.
