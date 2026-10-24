# Deterministic Validation Skill

Version: 1.0.0
Purpose: Enforce deterministic BRD-supported required-ID and duplicate-ID rules.
When to run: After normalization output is generated.
Required inputs: Normalized working records, original values, rules/schema versions.

Evaluate required fields, target types/formats, and configured uniqueness/business rules using deterministic checks. Report every applicable error with stable code, rule ID, row identifier, field, observed value reference, and explanation. Flag every row in a duplicate conflict. Reconcile counts and mark only passed records eligible.

## Execution and output
Reuses validation results in `demo-core.processRows`. Emits `validation/validation-report.json` and `artifacts/validated-records.csv` with eligible rows only; invalid rows remain available to the exception stage.

## Validation, errors, example, and tests
Gate: eligible + invalid must equal source count. BR-01 marks blank Customer IDs invalid; BR-02 marks every same-batch duplicate ID invalid. Example: two `C-1` rows are both invalid. Tests: `tests/data-processor.test.js`, `tests/orchestrator.test.js`. Limitation: email/date/type and configurable business validations are not enabled because full rules/schema are unapproved.
