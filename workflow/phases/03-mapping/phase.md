# Phase — Map source fields

## Purpose
Recommend mappings to canonical customer schema, explain confidence, and collect analyst decisions.

## Responsible capability
`field-mapping` skill; see `skills/field-mapping.md`. Specialist agent, when applicable, is referenced in `workflow/orchestrator.yaml`.

## Sequence
1. Verify input contract and run/version identifiers.
2. Perform only this phase’s responsibility.
3. Emit structured artifacts and audit metadata.
4. Stop or route to human review when a blocking decision is unresolved.

## Outputs
Confirmed source-to-target mapping and unresolved items (if any).

## Safety
Never discard source values or bypass a downstream gate. Treat customer data as sensitive; expose only what the task requires.
