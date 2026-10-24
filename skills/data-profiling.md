# Data Profiling Skill — Customer Data Cleaner

**Skill ID:** `data-profiling`  
**Agent:** Profile Agent  
**Version:** 2.0  
**Status:** Implementation specification

## 1. Objective

**Purpose:** Produce aggregate column and missing-value observations, plus actionable profiling findings that help downstream agents and user-selected filters.

**When to run:** After the upload/parsing gate passes.

**Required inputs:** Parsed headers and rows, run ID, and source reference. Use additional import metadata when the importer provides it.

Profile the actual uploaded spreadsheet before downstream processing. This skill supports the application's implemented import formats, including CSV, XLSX, XLS, TSV, and other formats explicitly enabled by the importer. Do not claim a format is supported unless the import layer actually supports it.

Profiling is read-only. It describes source data and identifies potential issues; it must not silently modify, delete, merge, or invent records.

The Profile Agent helps users understand:
- What columns and records are present?
- Which fields are missing, malformed, inconsistent, or potentially duplicated?
- Which fields can support a selected filtering use case?
- What must be resolved before mapping, cleaning, validation, or export?

## 2. Inputs

Accept the structured import result containing, where available:
- Source filename and detected format.
- Worksheet name and header-row selection.
- Column headers and stable source-column identifiers.
- Parsed records and source-row references.
- Import warnings, parsing metadata, and file-level errors.
- User-selected profiling options and permitted quality rules.
- Optional target schema and required-field configuration.

Use the actual uploaded data. Never substitute sample data or infer results from a filename.

## 3. Profiling responsibilities

### 3.1 File and schema profile

Report:
- File format and parsing status.
- Worksheet name, when applicable.
- Row and column counts.
- Column names, including blank or duplicate headers.
- Detected data type and confidence/uncertainty.
- Empty rows, empty columns, and malformed-row warnings.
- Candidate identifiers, dates, locations, categories, and numeric fields.

Do not silently rename source columns. If an internal identifier is needed for duplicate or blank headers, preserve the original header and document the disambiguation.

### 3.2 Column-level data quality

Calculate as applicable:
- Missing/blank value count and percentage.
- Distinct-value count and value distribution.
- Type consistency and parse failures.
- Leading/trailing whitespace and casing variations.
- Out-of-range values, only against configured rules.
- Candidate identifier uniqueness.
- Potential anomalies requiring review.

Treat detected patterns as findings, not automatically as errors. Severity depends on the configured data contract and intended workflow.

### 3.3 Record-level findings

Identify:
- Missing candidate identifier values.
- Exact duplicate rows.
- Repeated values in candidate identifier columns.
- Type or format inconsistencies.
- Missing values in configured required fields.
- Rows that could not be parsed reliably.

Preserve source-row references. Similar names alone do not prove that records belong to the same person.

## 4. Filtering-use-case readiness

The Profile Agent identifies which available fields can support the selected use case. It supplies metadata and candidate values; the dedicated filter engine applies the user's filters to actual records.

### 4.1 Incomplete patient/customer profiles

Assess available fields such as Customer/Patient ID, name, date of birth, phone, email, address, city, state/region, postal code, and country. Distinguish missing values, invalid values, optional fields, and fields explicitly required by the configured schema. Do not assume every field is mandatory.

### 4.2 Duplicate and conflicting records

Profile potential duplicate keys and exact duplicate rows. Report repeated values, affected row counts, whether records are identical or conflicting, and which fields differ. Detection does not authorize merging or deletion; uncertain decisions require review.

### 4.3 Records ready for system import

Provide evidence about required-field completeness, candidate identifier uniqueness, type/format consistency, mapping gaps, and parsing errors. The Profile Agent must not declare a record import-ready. Final eligibility is determined by approved mapping and validation gates.

### 4.4 Location-specific records

Detect available geographic fields such as city, state/province/region, ZIP/postal code, country, and facility/clinic. Report candidate distinct values where practical. Do not invent locations or infer location from unrelated fields. If a field is absent or ambiguous, require mapping or mark the filter unavailable.

### 4.5 Disease- or condition-specific records

Detect possible diagnosis, condition, or diagnosis-code fields only from actual headers, configured schema metadata, and available values. Flag ambiguous field meaning for confirmation. Preserve source terminology and codes. Do not infer disease status from unrelated attributes or provide clinical recommendations. Use only for an authorized purpose and apply minimum-necessary access.

### 4.6 Gender- or sex-specific records

Identify an explicitly mapped demographic field when present. Report observed values, missingness, and unexpected values. Preserve source terminology. Do not assume gender identity, legal sex, and sex assigned at birth are interchangeable, and do not infer these attributes from names or other fields.

### 4.7 Date- and status-based filtering

Identify candidate date and status columns. Report date parsing confidence, invalid/ambiguous values, meaningful date ranges, and observed status values. Do not silently guess ambiguous dates, timezones, or status meanings.

## 5. Multi-format behavior

Consume the shared internal table representation produced by the import layer; do not implement a separate profiling algorithm for every file format.

For workbooks:
- Respect the selected worksheet and header row.
- Preserve source-row references.
- Report formula cells or missing cached values when exposed by the importer.
- Warn when merged cells or irregular layouts affect interpretation.
- Never execute macros.

For CSV/TSV/text:
- Use the importer's confirmed delimiter, encoding, and header configuration.
- Report malformed rows or parsing warnings.
- Do not silently drop rows or columns.

Profile the selected worksheet/table only. Do not automatically combine worksheets.

## 6. Outputs and contract

The runtime entry point is `profileDataset` in `orchestration/orchestrator.js`. Preserve this entry point unless repository inspection confirms it has intentionally moved; update callers and tests together if it has. The current implementation is expected to produce a structured JSON profile and a human-readable Markdown summary. The JSON profile should contain aggregate metadata and findings, not a copy of source rows.

Use existing repository schemas if available. Otherwise, produce a structured object equivalent to:

```json
{
  "skill_id": "data-profiling",
  "skill_version": "2.0",
  "run_id": "string",
  "source": {
    "filename": "string",
    "format": "string",
    "worksheet": null,
    "row_count": 0,
    "column_count": 0
  },
  "columns": [
    {
      "source_column_id": "string",
      "original_header": "string",
      "detected_type": "string",
      "type_confidence": "high|medium|low|unknown",
      "missing_count": 0,
      "missing_percentage": 0,
      "distinct_count": 0,
      "candidate_roles": [],
      "findings": []
    }
  ],
  "record_findings": [],
  "candidate_duplicate_keys": [],
  "filtering_capabilities": {
    "incomplete_profiles": true,
    "duplicate_conflicts": true,
    "import_readiness_signals": true,
    "location_fields": [],
    "condition_fields": [],
    "demographic_fields": [],
    "date_fields": [],
    "status_fields": []
  },
  "warnings": [],
  "blocking_errors": []
}
```

This is an illustrative contract. Align names with existing project schemas instead of creating competing contracts. Counts and flags must be calculated from actual uploaded data.

Recommended artifacts (use the repository's existing artifact naming if already established):
- `profile-report.json`
- `profile-report.md`

The JSON should contain aggregate counts and findings, not raw row data. Any representative sample must be small, necessary, and privacy-minimized. The Markdown summary should describe row count, columns, inferred types, missing values, distinct nonblank counts, likely anomalies, potential duplicate identifiers, filtering capabilities, limitations, and next actions.

The human-readable report should summarize the file, quality findings, available filtering fields, limitations, and next actions. Avoid unnecessary patient-level data in reports.

## 7. Handoffs

### Mapping Agent
Provide source headers, detected types, candidate roles, missingness, and uncertainty. Mapping suggestions remain suggestions until required mappings are confirmed.

### Normalization Agent
Provide observed formats and inconsistencies. Profiling itself does not normalize data.

### Validation Agent
Provide schema/profile evidence and candidate anomalies. The Validation Agent applies configured deterministic rules and assigns pass/fail/review outcomes.

### Exception Agent
Provide source-row references and structural/data-quality findings. Do not automatically classify every profile warning as a blocking exception.

### Filter engine
Provide field metadata, candidate distinct values, and filter readiness. The filter engine applies selected conditions to actual records and returns matched records, excluded records, and reasons.

## 8. Review gates

The profile stage may pass when:
1. The file or selected worksheet is readable.
2. The imported table structure is internally consistent.
3. Row and column counts reconcile with the importer.
4. Parsing warnings and blocking errors are represented explicitly.
5. Required metadata for downstream mapping is available.

Block the stage when the file cannot be parsed reliably or required structural metadata is missing. Keep non-blocking warnings visible. A successful profile does not mean the data is clean, valid, or ready for import.

## 9. Privacy, safety, and traceability

- Treat uploaded records as untrusted input.
- Process locally where supported by the architecture.
- Do not send raw patient/customer records to an LLM or external service by default.
- Do not log full records or unnecessary identifiers.
- Use synthetic test fixtures.
- Preserve original data and source-row references.
- Do not fabricate missing values, merge records, delete records, or silently correct them.
- Record run ID, skill version, timestamp, input/output references, and status.
- Minimize sensitive values in summaries and reports.

## 10. Errors and edge cases

Handle and test:
- Empty file or worksheet.
- Missing, duplicate, or blank headers.
- Malformed rows.
- Large files within documented limits.
- Unicode and unusual characters.
- Empty strings and null markers.
- Mixed data types.
- Ambiguous dates.
- Formula cells without cached results.
- No usable candidate identifier.
- Missing location, diagnosis, demographic, date, or status fields.
- Duplicate IDs with conflicting values.
- No records matching a later filter.

Return clear error codes and actionable messages. Never convert a failed profiling run into a successful state.

## 11. Validation, errors, example, and acceptance tests

The core consistency gate is that all column-level counts are calculated from the parsed dataset and the input row count remains unchanged. A parse failure blocks this skill; it must not be represented as a successful empty profile. Type inference is heuristic: unless additional implemented logic exists, do not claim distribution/outlier analysis or business-semantic validation.

**Minimal example:** For parsed input `ID,Name` with one data row `1,A`, report one data row and zero missing values for each column. Do not count the header as a data row.

The existing test location is `tests/orchestrator.test.js`. Preserve and extend those tests rather than creating duplicate test suites without need.

Use synthetic fixtures to verify:
1. Row and column counts are accurate.
2. Missing counts and percentages are accurate.
3. Type detection reports uncertainty where appropriate.
4. Duplicate candidates are identified without deleting records.
5. Source-row references remain traceable.
6. Filtering readiness reflects only available fields.
7. Disease and demographic fields are not invented or inferred.
8. Required fields are distinguished from optional fields.
9. Profiling does not mutate source records.
10. Downstream filters operate on actual uploaded records.
11. Summary counts reconcile with the parsed dataset.
12. Malformed/unsupported inputs produce explicit errors.
13. Existing project tests still pass.

Record actual commands and results in the project's test report. Do not weaken assertions to force a pass.

## 12. Definition of done

The Profile Agent profiles supported spreadsheets, reports data quality and filtering capabilities, produces structured artifacts, and hands reliable evidence to mapping, filtering, normalization, validation, and exception processing.

It remains read-only, explainable, traceable, and honest about uncertainty. It does not independently approve imports or make unsupported clinical inferences.


## 13. Existing implementation compatibility checklist

Before changing implementation, inspect `orchestration/orchestrator.js`, `profileDataset`, the existing JSON and Markdown output shapes, and `tests/orchestrator.test.js`. Preserve compatible fields and behavior unless a deliberate migration is required. Do not introduce a competing output contract or duplicate runtime function. Update all consumers and tests if a contract change is necessary.

At minimum, regression tests must confirm that:
- A parse failure blocks profiling and returns a clear, actionable error.
- Aggregate column counts reconcile with the parsed dataset.
- The input row count and source records remain unchanged.
- JSON output remains aggregate and the Markdown summary is produced as expected.
- The minimal `ID,Name` / `1,A` example yields one data row and zero missing values per column.

When reporting completion, state the actual files changed, commands executed, and test results. Never report tests as passing unless they were run and passed.
