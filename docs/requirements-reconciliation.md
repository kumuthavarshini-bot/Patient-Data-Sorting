# Customer Data Cleaner — Requirements Reconciliation

**Status:** Review draft  
**Primary product authority:** `input/customer_data_cleaner_BRD.md` (draft v1.0, October 2026)  
**Compared documents:** `docs/brd-analysis.md`, `input/customer_data_cleaner_chatbot_approved_qa.json`, and the current workflow, phase, agent, skill, and schema-planning documents.

This report does not change or supersede the BRD, approved Q&A, or planning scaffold. Where the Q&A or scaffold adds product claims not present in the BRD, this report labels them as unsupported or requiring approval rather than treating them as requirements.

## 1. Executive summary

The BRD defines a **Customer Data Cleaner** for customer CSV onboarding: upload and inspect files, profile data, map columns to a canonical customer schema, normalize approved values, validate records, route invalid records to exceptions, and import eligible records after preview and confirmation. It names five agents: Profile, Mapping, Normalization, Validation, and Exception.

The approved Q&A mostly describes these agent concepts, but has conflicting or unsupported product language:

- It introduces “patient records,” “patient information,” “patient identifiers,” and “PHI,” although the BRD scope is customer data and does not define a healthcare/clinical use case.
- Its answer to “What are the seven workflow phases?” names a **product-planning lifecycle**. The BRD and current scaffold also define seven **data-processing phases**. They are different workflows and must be labeled distinctly.
- It suggests behaviors not established by the BRD, including permitted category-value normalization, fuzzy/uncertain identity matches, merging review, authorized validation exceptions, file templates, reversible normalization, final handover reporting, chatbot action initiation, and PHI/provider-agreement controls.

The current scaffold generally reflects the BRD, but its orchestrator serializes `exceptions` before `import`, even though the BRD branches valid records to import and invalid records to exceptions after validation. Some phase gates also make stronger assumptions than the BRD, particularly requiring all required target fields to map before normalization and requiring stable idempotency controls without the BRD’s “where supported” qualification.

## 2. Authority and workflow distinction

### BRD product scope is authoritative

Use the BRD to determine Customer Data Cleaner features, business rules, statuses, gates, and claims about application capability. The approved Q&A may supply approved wording only where it does not conflict with the BRD. The analysis and scaffold are planning artifacts; they do not create new business requirements by themselves.

### Two different seven-phase workflows

| Product-planning lifecycle from Q&A | Customer data-processing lifecycle from BRD/scaffold |
|---|---|
| 1. Problem & Product Definition | 1. Upload CSV |
| 2. Roadmap to Get Started | 2. Profile data |
| 3. Research | 3. Map fields |
| 4. Analyze | 4. Normalize data |
| 5. Design | 5. Validate records |
| 6. Validation | 6. Route invalid records to exceptions; correct/reprocess as applicable |
| 7. Handover | 7. Preview and import eligible records |

These lists are **not interchangeable**. The product-planning lifecycle is not the operational workflow for processing a CSV. In the processing workflow, exceptions and import are outcome branches after validation; a corrected exception must be normalized/validated again. The BRD’s numbered workflow combines routing and reprocessing in its steps 6–7, while the scaffold splits these into seven folders. Keep both conceptual models distinct and label them clearly wherever both are discussed.

## 3. Conflicting or unsupported Q&A statements

Status meanings: **Conflict** = contradicts or misstates BRD scope; **Unsupported** = not established by BRD; **Aligned** = consistent with the BRD; **Reword** = concept may be useful but must be made customer-focused or explicitly conditional.

| Q&A entry | Finding | Reconciliation recommendation |
|---|---|---|
| Metadata: `DataCare AI Assistant Knowledge Base` | “DataCare” is not named in the BRD; product/assistant branding is not established. | Confirm whether this is an approved chatbot name. Otherwise use “Customer Data Cleaner assistant” as a working label. |
| FAQ 001: “customer and patient records” | **Conflict.** The BRD describes customer records; patient records imply a distinct health-data use case. | Say “customer CSV files” or “customer records.” Avoid “patient” unless the product scope is formally changed. |
| FAQ 001: “Actual processing depends on the connected data sources and implemented integrations.” | **Unsupported / potentially misleading.** The BRD assumes a single destination or simulated import for the first version; broad integrations are out of scope. | Say the product is intended to prepare customer CSV data and that import capability depends on the implementation. Do not imply integrations exist. |
| FAQ 002: “Start with Problem & Product Definition…” | **Different workflow.** This is a product-planning lifecycle, not the BRD’s CSV-processing sequence. | Retain only if the assistant is also meant to explain a separate product/project-planning process. Label it “product-planning phases.” Otherwise replace with the BRD data-processing steps. |
| FAQ 003: “The seven phases are Problem & Product Definition … Handover.” | **Conflict by ambiguity, not necessarily by content.** The BRD/scaffold use seven operational phases for a different workflow. | Do not call these simply “the seven workflow phases.” State which workflow is meant. If the FAQ asks about processing customer data, answer with upload, profile, mapping, normalization, validation, exceptions/reprocessing, and import. |
| FAQ 004: Profile Agent examines structure, field types, missing values, duplicate candidates, format patterns, anomalies. | **Aligned in substance.** Profiling and quality findings are in the BRD. | Keep, with wording that these are findings from the uploaded file and not proof of validation or identity. |
| FAQ 005: Mapping Agent proposes source-to-target mappings and flags ambiguity. | **Aligned.** BRD FR-04–06 and BR-06 support suggestions, confidence, human review, and confirmation. | Keep. Avoid promising a numerical confidence threshold until defined. |
| FAQ 006: Normalization includes dates, whitespace, capitalization. | **Partially aligned.** BRD names supported dates, email casing, whitespace, and configured formats. “Capitalization” broadly may imply other fields; “permitted category values” is not in the BRD. | Limit examples to approved date formats, email casing, whitespace, and explicitly configured formats. Do not claim category-value normalization until approved. |
| FAQ 007: Validation checks allowed values and reports pass/fail/review-required. | **Partially supported.** BRD requires types, formats, required fields, uniqueness, configured business rules, and understandable errors; it does not enumerate allowed-value rules or specify these exact outcome labels for records. | Use BRD terms. Say configured rules determine eligibility; distinguish dataset/run statuses from record outcomes unless an outcome taxonomy is approved. |
| FAQ 008: Exception Agent routes unresolved records for review and must not invent missing “patient” information. | “Patient” is a **scope conflict**. Review/routing and no fabricated corrections are **aligned in principle**, though the BRD defines exception files and correction/reprocessing more specifically. | Replace with “customer information.” Describe records that fail validation or need review; preserve originals, give error reasons, and revalidate corrections. |
| FAQ 009: Duplicates use approved matching rules; similar names alone may not prove identity; uncertain matches reviewed before merging. | **Partially supported / partly out of scope.** BRD requires same-batch customer-ID uniqueness and flags all conflicting rows by default. It does not define fuzzy matching; cross-system merging/entity resolution is out of scope. | State the BRD default: duplicate customer IDs in the batch flag every conflicting row. Do not imply fuzzy identity matching or merging is implemented. Treat any uncertain-match review behavior as a future/approval decision. |
| FAQ 010: Missing values follow field rules; do not fabricate “patient details”; defaults/derivations may be configured. | **Partly conflicting and unsupported.** “Patient” is wrong for scope. BRD prohibits inventing email corrections and unsupported normalization but does not approve defaults/derivations. | Use “customer values.” Say missing required fields are exceptions and the system does not invent values. Do not mention defaults/derivations as available unless specifically approved. |
| FAQ 011: For unmapped fields, user selects an approved destination “or exclusion.” | Human review for ambiguous mapping is **aligned**. A user-approved destination is sensible, but an “exclusion” path is **not specified**; silently excluding fields/records could conflict with no silent discard. | Say unresolved mappings pause for review. Do not promise source-field exclusion behavior until rules define it and preserve traceability. |
| FAQ 012: Values can be audited or reversed where supported. | Preserving originals and transformation history is **aligned**. The ability to reverse/undo is **unsupported** by the BRD. | Keep the caveat that reversal must be implemented and tested before promised; better say originals and transformation history are retained, not that reversal is available. |
| FAQ 013: Gate handles failed records, unresolved mappings, outstanding approvals according to configured acceptance criteria. | **Aligned in principle.** BRD requires gates and pauses for missing decisions. Exact criteria are not all defined. | Keep as a generic explanation and avoid implying all record exceptions stop the whole run; valid/invalid outcomes branch after validation. |
| FAQ 014: Invalid records blocked or quarantined until corrected or “explicitly resolved through an authorized exception process.” | Blocking invalid records is **BRD-supported**. “Quarantined” and a path to import via an authorized exception/waiver are **unsupported and potentially conflicting** with BR-08, which permits only records passing required validation. | State that invalid records are excluded from import, placed in an exception file, corrected, and revalidated. Do not imply an override can import a record that still fails required validation. |
| FAQ 015: Reports include profiling, mapping, normalization, validation, exceptions, and final handover report. | Most processing artifacts are **aligned/planned**. “Final handover report” is **unsupported** as a Customer Data Cleaner output; it appears to derive from the planning lifecycle. | Retain only BRD/planned run outputs: profile, mapping decisions, transformations, validation summary, exception file, import receipt/status. Clearly label as planned until implemented. |
| FAQ 016: Approvals cover mappings, uncertain duplicate matches, exceptions, and release readiness. | Mapping approval and import confirmation are **supported**. Approval for uncertain duplicate matching, exception override, and release readiness are **not defined** by the BRD. | Keep mapping review and import confirmation. State exception corrections require revalidation. Avoid promising duplicate adjudication/override or a release-readiness approval feature. |
| FAQ 017: Chatbot may “help initiate supported actions” if implemented. | **Unsupported capability.** The BRD does not define chatbot actions or a chatbot/backend interface. The caveat is responsible but still introduces an unapproved product capability. | For an informational chatbot milestone, say it explains the product and cannot upload, clean, validate, or import data. Change only if action initiation is later specified and implemented. |
| FAQ 018: CSV or Excel upload; template recommendation. | CSV is **supported**. Excel support conflicts with the BRD’s CSV-only MVP. Approved templates are not established; FR-16 concerns reusable mapping templates, not necessarily upload templates. “Patient data” warning is wrong for scope. | Say “CSV” only for initial scope; do not promise Excel/template uploads. Use a general approved-data warning if approved. |
| FAQ 019: “patient data,” patient identifiers, PHI, protected health information, healthcare authorization, and provider agreements. | **Conflict/out of scope.** BRD concerns customer data and specifies general security, privacy, role access, retention, and minimizing data sent to AI. It does not define PHI, HIPAA, provider agreements, or a healthcare environment. | Replace with a general customer-data statement: use only data the user is authorized to process and only approved environments; do not paste customer identifiers/file contents into the chatbot unless that environment is approved for the data. Exact approved wording and controls need security/privacy review. |
| FAQ 020: Fallback says it will not invent policy or claim success. | **Good safety principle**, but chatbot fallback behavior is not specified in the BRD. Referring users to a data owner/administrator is compatible with stakeholder roles but not a defined product feature. | Keep as a proposed chatbot behavior, clearly label intended behavior until implemented and approved. |

## 4. Reconciliation of the analysis and planning scaffold

### Supported by the BRD

- `docs/brd-analysis.md` correctly treats the BRD as the primary requirements source, marks success metrics as proposed targets, lists the five named agents, and calls out the two seven-phase lists as distinct concepts.
- The phase folders cover upload, profile, mapping, normalization, validation, exceptions, and import, consistent with the BRD’s workflow.
- Agent and skill drafts generally preserve source values, require deterministic validation, avoid guesses, and respect human review.
- The canonical schema proposal is explicitly labeled as a proposal; its optional candidate fields (name, phone, address, date of birth, source IDs) must not be presented as approved requirements.

### Scaffold items that exceed or need clarification against the BRD

| Scaffold location | Issue | Reconciliation needed |
|---|---|---|
| `workflow/orchestrator.yaml` `execution_order` and `next` links | Lists `exceptions` then `import` as a single chain. BRD section 6 routes valid records to preview/import and invalid records to exceptions, after validation. | Model separate outcomes/branches after validation and a correction/reprocess loop back through normalization/validation. Do not make unresolved exception processing a prerequisite to importing unrelated eligible records unless approved. |
| `workflow/phases/03-mapping/gate.md` and `skills/field-mapping.md` | “All required target fields mapped” / “required-field coverage before normalization” may force whole-file mapping failure when a target field is absent, while BRD also routes records missing mandatory values to exceptions. | Decide whether missing source mapping blocks the whole run or allows row-level exceptions; preserve BRD’s human review requirement for ambiguity. |
| Mapping gate and mapping skill | “Low-confidence” review is BRD-supported, but confidence threshold is unspecified. | Avoid numerical or deterministic thresholds until approved. |
| `workflow/phases/*/gate.md` common failure behavior | Generic “Do not execute downstream phases” can imply a whole-run stop for exception failures, conflicting with valid/invalid branch handling. | Apply gates to the affected branch/record where possible; define run-vs-record blocking semantics. |
| `workflow/phases/07-import/gate.md`, `skills/import-safety.md`, `agents/*` | Stable idempotency controls are stated categorically, while BR-09 says use them “where supported.” | Keep the BRD qualification and require an approved safe retry strategy when destination idempotency support is absent. |
| `skills/csv-intake.md` and upload gate | Mentions accepted encodings, file limits, and parser policies as configured. The BRD requires configurable limits and malformed-input handling but does not define actual values/policies. | Keep these as unresolved configuration points, not fixed requirements. |
| `skills/data-normalization.md` | Trimming and email-case behavior are tied to approved policy; this matches BRD’s supported examples. | Do not expand to broad capitalization, category values, or field-specific transformations without approval. |
| `workflow/REQUIREMENTS.md` | Correctly lists unresolved schema, destination, file, date, mapping, access, and status decisions. | Preserve as an open-decision register; reconcile against the approvals listed below. |
| `agents/*.md` | These are instruction drafts, not executable agents. | Do not describe them to chatbot users as live capabilities. |

## 5. Recommended customer-focused chatbot wording

These are wording proposals, not approved changes to the Q&A JSON.

| Topic | Recommended wording |
|---|---|
| Product overview | “Customer Data Cleaner helps operations teams prepare customer CSV files for import. The planned workflow profiles the file, suggests field mappings, applies approved normalization, validates records, and routes invalid records to an exception file. Available actions depend on the features currently implemented.” |
| Getting started | “For the customer-data workflow, begin by uploading a supported CSV. The application then profiles the file, asks you to review field mappings, normalizes approved values, validates records, and separates exceptions from records eligible for import.” |
| Seven phases | “There are two different seven-phase lists. The product-planning lifecycle is Problem & Product Definition, Roadmap to Get Started, Research, Analyze, Design, Validation, and Handover. The customer data-processing lifecycle is Upload, Profile, Map, Normalize, Validate, route exceptions/reprocess corrections, and Preview/Import eligible records. The latter describes CSV processing; the former describes product planning.” |
| Exceptions | “Records that fail required validation are kept out of import and listed with their source values, row identifiers, error codes, and explanations. Corrected records must be validated again before they become eligible.” |
| Duplicate IDs | “By default, if customer IDs repeat within one import batch, every row in that conflict is flagged and excluded from import. The product does not choose a winner automatically.” |
| Data handling | “Use only customer data you are authorized to process and only an environment approved for that data. Do not paste customer identifiers or file contents into the chatbot unless the environment has been approved for that use.” |
| Chatbot limits | “The assistant can explain the planned workflow. It cannot claim to upload, clean, validate, or import records unless those functions are implemented and the application confirms the result.” |

## 6. Business decisions requiring approval

The BRD leaves these decisions open. The recommendations below should not become rules without your approval.

1. **Canonical schema and required fields:** Approve the customer fields and identify which are globally required versus destination-specific. The BRD explicitly requires Customer ID; other mandatory fields are not enumerated.
2. **Field formats and normalization:** Approve accepted date formats, email syntax/casing policy, whitespace handling, null tokens, and any phone/address formats. The BRD supports approved transformations but does not define full format rules.
3. **Duplicate handling:** Confirm the BRD default that all same-batch duplicate Customer ID rows are flagged. Decide whether cross-batch/destination checks are in the first release. Do not enable fuzzy identity matching or merging without separate scope approval.
4. **Invalid-record policy:** Confirm that required-validation failures remain excluded from import until corrected and revalidated. Decide how invalid optional fields affect the record. The BRD does not define a waiver/override path; do not imply one.
5. **Two seven-phase lists:** Confirm whether the chatbot should explain both the product-planning lifecycle and CSV-processing workflow, or only the latter. If both remain, approve the labels and explicit distinction.
6. **Chatbot scope:** Confirm informational Q&A only for the first chatbot milestone, versus later action initiation. No chatbot actions or APIs are defined by the BRD.
7. **Conversation history:** Decide whether conversations are retained, for how long, who can access them, and whether content may include customer data. The BRD discusses file/data retention and auditability but does not specify chatbot conversation retention.
8. **Data language/security:** Approve customer-focused privacy wording and confirm whether any health/patient use case exists. Do not use PHI/HIPAA/provider-agreement claims unless that scope and compliance posture are explicitly established.
9. **Branding:** Confirm whether “DataCare AI Assistant” is the approved name or whether the chatbot should be called “Customer Data Cleaner assistant.”

## 7. Recommended next implementation milestone

**Milestone: Approve and reconcile the chatbot knowledge base for a customer-focused, informational FAQ experience.** Update the Q&A only after the wording and decisions above are approved; this report itself does not change the approved Q&A.

### Acceptance criteria

- All Q&A answers use customer-data language and contain no unsupported patient/PHI/HIPAA/provider-agreement claims unless a healthcare scope is approved.
- “Product-planning phases” and “customer data-processing phases” are labeled and explained separately; asking about CSV processing returns the BRD workflow.
- Q&A statements distinguish planned from implemented behavior and do not claim upload, cleaning, validation, import, integrations, templates, undo, or override features unless verified in the application.
- Same-batch duplicate Customer ID behavior matches the BRD: flag all conflicting rows by default; no automatic winner or merge.
- Invalid records are described as excluded from import until corrected and revalidated; no unapproved waiver route is promised.
- Conversation retention behavior is disclosed and matches the approved retention decision; if no retention is approved, the FAQ does not promise storage or history.
- Existing BRD and planning files remain unchanged; no API connection or application-code change is part of this milestone.

## 8. Current change boundary

This report is a reconciliation artifact only. It does not edit the BRD, approved Q&A JSON, application code, orchestrator, phase documents, skills, or agent instruction files. It does not connect an API or declare any planned capability implemented.
