# Import Safety Skill

Version: 1.0.0
Purpose: Prevent import without a configured destination contract and approval.
When to run: After validation/exception review and an eligible-record preview.
Required inputs: Eligible records, human approval, destination, idempotency contract.

Build preview from validation-passed eligible records only. Require explicit confirmation and record its actor/time. Use the destination’s stable idempotency mechanism. Do not import invalid or unresolved rows. Report accepted, rejected, and not-processed counts, receipt IDs, partial status, and retry-safe next steps.

## Execution and output
The current orchestrator records the import phase as `BLOCKED` because there is no destination, authentication, idempotency, receipt, or partial-failure contract. No import function is called.

## Validation, errors, example, and tests
Gate: destination and explicit confirmation must exist; invalid and unresolved records are excluded. Example: local run ends `READY_FOR_REVIEW` and import `BLOCKED`. Test: `tests/orchestrator.test.js`. Limitation: no import is implemented.
