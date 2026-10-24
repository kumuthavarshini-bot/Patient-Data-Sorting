# Exception Management Skill

Version: 1.0.0
Purpose: Preserve every validation exception with actionable codes.
When to run: After validation completes and counts reconcile.
Required inputs: Original rows, validation outcomes, run ID and rule version.

Produce exception rows from validation findings while preserving original values and stable row identity. Include all errors, codes, corrective guidance only when safe, and run ID. Never auto-correct ambiguous values. A corrected row must be reprocessed through normalization/validation and pass before eligibility.

## Execution and output
The exception writer in `orchestration/orchestrator.js` emits JSON register, CSV with original columns, and Markdown summary. It records recommendations only as code-provided reasons and does not rewrite values.

## Validation, errors, example, and tests
Gate: each invalid record and all its error codes appear in the exception artifacts; unresolved records remain ineligible. Example: blank ID produces BR-01 in report and CSV. Tests: `tests/orchestrator.test.js`. Limitation: review, approve/reject, and correction UI are not implemented.
