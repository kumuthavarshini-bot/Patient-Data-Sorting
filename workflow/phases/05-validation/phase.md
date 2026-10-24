# Phase — Validate records

## Purpose
Enforce target schema, required fields, formats, duplicate policy, and business rules deterministically.

## Responsible capability
`deterministic-validation` skill; see `skills/deterministic-validation.md`. Specialist agent, when applicable, is referenced in `workflow/orchestrator.yaml`.

## Sequence
1. Verify input contract and run/version identifiers.
2. Perform only this phase’s responsibility.
3. Emit structured artifacts and audit metadata.
4. Stop or route to human review when a blocking decision is unresolved.

## Outputs
Record-level pass/fail/review outcomes, error codes, field references, summary counts.

## Safety
Never discard source values or bypass a downstream gate. Treat customer data as sensitive; expose only what the task requires.
