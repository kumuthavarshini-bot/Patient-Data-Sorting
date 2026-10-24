# Phase — Normalize values

## Purpose
Apply only approved deterministic transformations and preserve the source values and transformation log.

## Responsible capability
`data-normalization` skill; see `skills/data-normalization.md`. Specialist agent, when applicable, is referenced in `workflow/orchestrator.yaml`.

## Sequence
1. Verify input contract and run/version identifiers.
2. Perform only this phase’s responsibility.
3. Emit structured artifacts and audit metadata.
4. Stop or route to human review when a blocking decision is unresolved.

## Outputs
Normalized working records, unchanged source reference, and per-field transformation history.

## Safety
Never discard source values or bypass a downstream gate. Treat customer data as sensitive; expose only what the task requires.
