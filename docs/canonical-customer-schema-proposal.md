# Canonical Customer Schema Proposal

**Status:** Proposal for business approval; not an implementation specification.  
**Source:** Customer Data Cleaner BRD v1.0 (draft, October 2026) and approved `docs/brd-analysis.md`.

This document proposes a schema direction for review. It does not create production validation rules, import behavior, or agent implementation. Decisions described as proposed defaults require approval before they become requirements.

## 1. Evidence labels

- **BRD-supported** — stated directly or necessarily required by the BRD.
- **Proposed default — approval needed** — a practical candidate for the canonical contract, not a requirement in the BRD.
- **Unresolved** — the available documents do not provide enough information to choose.

## 2. Proposed canonical customer record

Use a versioned record with a stable customer identifier and optional customer attributes. Do not require every source file to contain every optional attribute. Schema-level optionality and dataset-specific requiredness should be separate: a steward may configure a field as required for a specific destination or use case, subject to approval and a schema/rule version.

| Canonical field | Business definition | Proposed type | Requiredness | Evidence / notes |
|---|---|---|---|---|
| `customer_id` | Stable identifier for the customer in the destination/customer domain. | String | **Required** | **BRD-supported:** BR-01 says Customer ID is mandatory; BR-02 requires within-batch uniqueness. Treat as a string to preserve leading zeros and nonnumeric IDs (**proposed default; approve**). |
| `first_name` | Customer's given name, when collected. | String | Optional | **Proposed default.** BRD asks to consider name but does not define name fields, requiredness, or format. |
| `last_name` | Customer's family name, when collected. | String | Optional | **Proposed default.** Whether to split names or use one `full_name` field is unresolved. |
| `email` | Email address associated with the customer. | String | Optional | **BRD-supported as a validated attribute:** email format must be checked; invalid values are flagged, not invented. BRD does not say email is mandatory. |
| `phone` | Contact telephone number, if supplied. | String | Optional | **Proposed default.** Preserve as text; no country or numbering policy is specified. |
| `address` | Customer postal address, if supplied. | Object of optional strings | Optional | **Proposed default.** Candidate subfields: `line1`, `line2`, `locality`, `region`, `postal_code`, `country_code`. BRD gives no address requirements or accepted formats. |
| `date_of_birth` | Customer birth date, only where the business is authorized to collect and use it. | Date (`YYYY-MM-DD` canonical representation proposed) | Optional | **Proposed default, approval required.** BRD discusses dates generally but does not name DOB or establish a purpose, lawful basis, retention, or handling policy for it. Do not include by default until approved. |
| `source_system_id` | Identifies the originating system for lineage and source-context. | String | Optional in customer record; expected in run/source metadata where available | **Proposed default.** BRD calls for source traceability, but does not require this as a customer-domain field. |
| `source_record_id` | Stable identifier of this source row/record within its source system. | String | Optional in customer record; require a stable row identifier in processing/exception metadata | **BRD-supported concept:** source row number or stable record identifier is required for exceptions. A durable source-system record ID is not specified. |

### Schema envelope and run metadata (not customer attributes)

Keep workflow/audit data separate from customer attributes. Proposed envelope:

| Metadata | Purpose | Status |
|---|---|---|
| `schema_version` | Identifies the canonical field/type/requiredness contract used. | **BRD-supported:** schema versions and configuration versions must be traceable. Version format unresolved. |
| `run_id` | Links this record's processing and outcomes to a run. | **BRD-supported:** processing runs must be traceable. |
| `source_file_id` | Links back to the preserved input file. | **Proposed default** supporting source preservation and audit. |
| `source_row_number` | Original data row position for locating the record. | **BRD-supported** as an acceptable exception row identifier. Clarify header counting convention. |
| `source_system_id`, `source_record_id` | Source context and stable record reference where supplied. | **Proposed default**; exact source identity contract unresolved. |
| `rule_version`, `normalization_version` | Identifies the applied rules and transformation configuration. | **BRD-supported in principle:** persist rule versions and transformation history; version scheme unresolved. |
| `created_at`, `updated_at` | Customer business timestamps, if part of destination schema. | **Unresolved.** Do not add without domain need. These are distinct from processing timestamps. |

## 3. Accepted formats and normalization candidates

The BRD requires normalization only for supported formats and says approved transformations must preserve meaning and original values. The concrete formats below are **proposals requiring approval**, except where explicitly called out.

| Field | Candidate accepted input | Candidate canonical form | Normalization / validation proposal | Status |
|---|---|---|---|---|
| `customer_id` | Text value; preserve leading zeros and punctuation unless an approved policy says otherwise. | Trimmed string, if trimming is approved. | Blank after approved whitespace handling is missing. Do not change case or remove punctuation by default because identifiers may be case-sensitive. Uniqueness comparison semantics need approval. | Requiredness and uniqueness are BRD-supported; representation/comparison details proposed. |
| `first_name`, `last_name` | CSV text. | Unicode text. | Remove surrounding whitespace only if approved; preserve internal punctuation, capitalization, diacritics, and original value. No title-casing or inferred split/merge. | Proposed. |
| `email` | CSV text containing one address, subject to configured email-format rule. | Trimmed address; lowercase casing proposed. | BRD explicitly lists email casing as a supported normalization and requires configured format validation. Do not repair invalid syntax or infer an address. Whether the whole address or only its domain is lowercased needs decision. | Format check and email-casing normalization supported; exact grammar/casing behavior unresolved. |
| `phone` | Text in source-specific format. | Text; E.164 candidate only if country context is known and policy approved. | Do not parse, prepend country codes, or discard punctuation without a confirmed rule. A value that cannot be safely interpreted should remain unchanged and may be flagged. | Proposed; accepted country and format rules unresolved. |
| `address.*` | Source text and/or mapped address columns. | Structured optional strings; country code representation unresolved. | Trim surrounding whitespace only if approved; do not geocode, infer, or rewrite address components. | Proposed; formats and normalization unresolved. |
| `date_of_birth` / other dates | Explicitly configured source date format, or format confirmed by user. | ISO date `YYYY-MM-DD` candidate. | Parse only when unambiguous; flag invalid/ambiguous values. Do not infer date order or timezone. DOB inclusion/processing requires separate decision. | Date ambiguity rule supported; canonical representation proposed. |

## 4. Null, blank, and invalid-value handling

### BRD-supported behavior

- Missing mandatory Customer ID is rejected (BR-01).
- Missing mandatory target-schema values route to exceptions (BR-03).
- Invalid email is flagged; the system must not invent a replacement (BR-04).
- Unparseable or ambiguous dates are flagged; unsupported corrections are prohibited (BR-05, AC-06).
- Invalid records cannot be imported, and failed validations need record ID, rule ID, and readable reason (BR-08, BR-10).
- Invalid records must not be silently discarded.

### Proposed handling defaults for approval

| Input condition | Proposed interpretation | Proposed outcome |
|---|---|---|
| Missing source column | No source mapping exists for the canonical field. | If the field is required for this schema/run, block mapping or make affected rows invalid; if optional, leave canonical value absent. |
| Empty CSV cell | No value provided. | Represent as null/absent in the working record while preserving the exact source cell. Requiredness determines whether it is blocking. |
| Whitespace-only cell | Treat as blank after an approved trim check. | Never silently overwrite source. Record any trim transformation; if the canonical value is required, raise a blocking error. |
| Literal strings such as `N/A`, `NULL`, `unknown`, `-` | Do not automatically treat as null. | Require a per-source or global approved null-token list; otherwise preserve as text and let field validation decide. |
| Invalid nonblank value | A value is present but fails a configured type/format/business rule. | Preserve original, emit a field-level error, and route the record to exceptions if blocking. Do not coerce or replace. |
| Optional field invalid | Invalidity does not necessarily invalidate the whole customer record. | Proposed default: classify as blocking for that record only if field is required by active schema/rule set or the configured rule marks it blocking; otherwise review/warning. Requires steward approval. |

Exact null tokens, trimming semantics, optional-field failure policy, and serialization of absent vs explicit null are **unresolved**.

## 5. Duplicate detection policy

### BRD-supported

- Customer IDs must be unique within the import batch.
- Every record participating in a same-batch duplicate conflict is flagged; do not select a winner by default.
- Conflicting rows are excluded from import under the configured policy.
- Stable identifiers and idempotent controls should prevent unintended duplicates on reprocessing/import.

### Proposed defaults requiring approval

1. Compare `customer_id` using exact canonical string equality after only approved normalization. Do not case-fold or strip punctuation unless identifier ownership confirms it is safe.
2. Emit one duplicate-conflict finding per affected record with references to all conflicting row IDs; keep original rows intact.
3. Treat uncertain similarity between names, emails, phones, or addresses as **possible match / needs review**, not as a confirmed duplicate and never auto-merge. This is a conservative workflow proposal, not a BRD identity-resolution requirement.
4. Do not block solely on a fuzzy/uncertain match unless a steward-approved rule promotes it to a blocking condition. Since entity resolution is out of scope, no probabilistic identity matching should be part of the initial schema contract.
5. Cross-batch or destination-existing duplicate checks remain disabled/undefined until an import destination and uniqueness scope are approved. The BRD says to check existing records “where supported” but does not define behavior.

## 6. Source-to-canonical mapping requirements

### BRD-supported

- Suggest mappings from source fields to a predefined canonical schema.
- Allow users to edit, confirm, and save mappings.
- Show confidence/rationale and flag ambiguous or low-confidence mappings.
- Pause processing when a required decision is missing.
- Do not silently choose among ambiguous mappings.

### Proposed mapping record (planning contract)

Each mapping decision should be reviewable and versioned with:

- source file/run reference and source column name/position;
- canonical field name and schema version;
- suggested mapping, rationale, and confidence (threshold is unresolved);
- final status: suggested, approved, rejected, unmapped, or needs review;
- decision maker and decision timestamp for human decisions;
- any source-specific mapping template/version reference.

Do not assume every source column maps to a canonical field or every optional canonical field exists in each file. How to handle multiple source columns mapping to one canonical field, one source column mapping to multiple targets, extra columns, and saved template precedence is unresolved. Required fields must be accounted for before normalization, but the exact failure behavior should be approved with the schema.

## 7. Validation rules and severity proposal

The BRD requires deterministic validation against target schema and configured business rules. It asks the UI to distinguish warnings from blocking errors but does not define a severity taxonomy. The following taxonomy is a proposal for approval, not a production ruleset.

| Proposed severity | Meaning | Candidate disposition |
|---|---|---|
| **Blocking** | Required rule failed; integrity or required user decision prevents safe progression. | Record is ineligible for import; emit exception. A mapping-level block can pause the whole workflow. |
| **Needs review** | Ambiguous mapping/value or uncertain possible duplicate requiring a person to decide. | Hold affected record/phase from progression until review; do not silently resolve. Whether the whole run pauses or only affected rows are held is unresolved. |
| **Warning** | Nonblocking quality issue under approved policy. | May remain eligible only if the active schema/rules explicitly allow it; display clearly. |
| **Informational** | Observation/profile finding, not a failed validation. | Display in profile or audit output; does not change eligibility. |

### Candidate rule inventory

| Rule candidate | Basis | Candidate severity |
|---|---|---|
| Customer ID present and nonblank | BR-01 | Blocking |
| Customer ID unique within batch; mark all conflicting rows | BR-02 | Blocking |
| Other schema-required fields present and conforming | BR-03 | Blocking when configured required |
| Email meets configured format | BR-04 | Blocking or review/warning depending on approved field policy; BRD says flag but does not explicitly define eligibility severity for invalid optional email. |
| Date is parseable with explicit/confirmed format | BR-05 | Blocking or review depending on requiredness and ambiguity; exact record/run behavior unresolved. |
| Ambiguous source-to-target mapping confirmed | BR-06 | Workflow blocking / needs review |
| Transformation is on approved rule list and original is preserved | BR-07 | Blocking if not satisfied; do not use an unapproved transformed value. |
| Only validated records are eligible for import | BR-08 | Blocking eligibility gate |
| Retry/reprocess does not cause unintended duplicate import | BR-09 | Import/run control; exact enforcement depends on destination contract. |
| Failed checks have row/record ID, rule ID, readable reason | BR-10 | Required traceability; processing cannot claim complete success without evidence. |

Do not turn proposed fields (phone, address, DOB, names) into validation requirements until the business approves their inclusion, requiredness, and accepted formats.

## 8. Human approval and exception handling

### BRD-supported gates

- Human review for ambiguous or low-confidence mappings before normalization.
- Explicit confirmation before import after preview.
- Corrected exceptions are reprocessed and validated again before import eligibility.
- Exception outputs preserve source values and include row/stable ID, error code/rule, readable reason, affected field/value where applicable, run ID/status, and safe corrective guidance where available.
- Invalid or unresolved records cannot bypass validation or be silently dropped.

### Proposed handling

- Require a data steward or authorized analyst to approve schema changes and configurable business rules; role/permission details need definition.
- Require field-level or record-level human decisions for uncertain match/mapping cases; record who decided, when, and what they chose.
- Do not ask a human to approve an invalid value as valid unless an explicit, versioned waiver mechanism is designed and approved. No waiver mechanism is specified in the BRD.
- Keep exception status (`Invalid`, `Needs Review`, `Corrected`, `Revalidated`, `Imported`) consistent with the BRD’s recommended states.

## 9. Data lineage and audit requirements

### BRD-supported requirements

- Preserve original source values and record transformation history.
- Keep processing outcomes traceable, including run ID, agent version, schema version, rule version, and timestamps.
- Identify failed record, rule, and human-readable reason.
- Maintain processing history/audit logs and support safe retries.
- Preserve source rows in exception outputs and distinguish imported, rejected, and unprocessed results.

### Proposed lineage fields for each processed record/field

- stable run ID, source file reference, original row number or source record ID;
- original source column name and raw value (protected as sensitive data);
- canonical field name and schema version;
- mapping decision reference/status and approval metadata;
- normalized value reference, transformation/rule ID and version, and outcome;
- validation result, severity, rule ID/version, error code, and field/row reference;
- exception/reprocessing linkage and import receipt/status where applicable.

Exact storage, encryption, retention duration, access controls, and whether raw values are stored inline or via secure references are **unresolved** and must follow security/privacy review. Data minimization applies to AI context and logs; auditability does not imply exposing customer values broadly.

## 10. Decisions needed before schema approval

1. **Identifier:** Is `customer_id` the destination’s customer key? Can it contain letters, leading zeros, or case-sensitive values? What normalization and comparison semantics are safe?
2. **Names:** Should the canonical model use `first_name`/`last_name`, `full_name`, or support both? Are any name fields required for a target use case?
3. **Optional contact fields:** Are email, phone, and address optional globally, or required for particular destinations/use cases?
4. **Email:** What format standard and casing policy should be used? Should invalid optional email block the record or produce a warning/exception while allowing import?
5. **Phone:** Which countries/formats are supported? Is a country code guaranteed or supplied separately?
6. **Address:** Which address components and country representation are needed? Is validation required or only preservation?
7. **Date of birth:** Is DOB in scope, necessary, and approved for collection/processing? What date format and retention/access rules apply?
8. **Dates generally:** Which source formats are accepted, how is locale/order confirmed, and are timezones relevant for any date fields?
9. **Requiredness:** Is Customer ID the only globally required field? Which schema/destination rules may make other fields required?
10. **Nulls/blanks:** Which literal tokens (if any) mean null? Should optional invalid values be warnings or exceptions?
11. **Duplicates:** Is uniqueness case-sensitive after normalization? Are cross-batch/destination checks required in the first release? How should possible matches be presented?
12. **Mapping:** What confidence threshold or evidence requires approval? How should split/combined columns and extra source fields be handled?
13. **Severity:** Approve blocking / needs-review / warning / informational levels and their effect on run versus individual-record progression.
14. **Governance:** Who can approve schema versions and rule changes? What are audit retention and privacy controls?

## 11. Recommended next step

Approve the field set and requiredness first, starting with the meaning and normalization/uniqueness policy for `customer_id`. Then decide whether names are split or represented as a single name, and confirm whether email, phone, address, and DOB belong in the initial canonical schema. After those decisions, approve formats/null semantics and duplicate scope before translating this proposal into versioned schema and acceptance fixtures.

**No production validation rules, import behavior, agents, or application code are defined by this proposal.**
