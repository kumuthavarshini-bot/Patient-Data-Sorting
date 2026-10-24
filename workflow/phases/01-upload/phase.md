# Phase — Upload CSV

## Purpose
Accept one CSV, identify it, and report safe file-level parsing readiness.

## Responsible capability
`csv-intake` skill; see `skills/csv-intake.md`. Specialist agent, when applicable, is referenced in `workflow/orchestrator.yaml`.

## Sequence
1. Verify input contract and run/version identifiers.
2. Perform only this phase’s responsibility.
3. Emit structured artifacts and audit metadata.
4. Stop or route to human review when a blocking decision is unresolved.

## Outputs
An immutable source file reference, file metadata, run ID, and intake findings.

## Safety
Never discard source values or bypass a downstream gate. Treat customer data as sensitive; expose only what the task requires.
