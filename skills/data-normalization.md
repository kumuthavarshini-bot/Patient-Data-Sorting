# Data Normalization Skill

Version: 1.0.0
Purpose: Apply the existing deterministic, traceable transformations.
When to run: Only after a valid, explicitly approved mapping.
Required inputs: Original records, approved mapping, rule version, run ID.

Apply an allowlisted, versioned transformation to working values only. Preserve originals and log row, field, before/after reference, rule ID, and outcome. Standardize supported dates only when interpretation is unambiguous; trim whitespace and normalize email casing only under approved policy. Never fabricate missing values or silently guess.

## Execution and output
Reuses `demo-core.processRows`; it trims mapped values and lowercases mapped email values according to current illustrative demo behavior. Original row arrays are retained; changes are written in `artifacts/normalized-records.csv` and `agent-results/normalization-report.json`.

## Validation, errors, example, and tests
Gate: output row count equals input; every change includes before/after and rule label. Missing approved Customer ID mapping throws and blocks the stage. Example: `" C-1 "` becomes `"C-1"` while original source column stays `" C-1 "`. Tests: `tests/data-processor.test.js`. Limitation: date normalization is not implemented; the precise trimming policy is provisional and requires confirmation.
