# Phase — Profile dataset

## Purpose
Inspect headers, rows, types, blank values, anomalies, and potential duplicates without changing source data.

## Responsible capability
`data-profiling` skill; see `skills/data-profiling.md`. Specialist agent, when applicable, is referenced in `workflow/orchestrator.yaml`.

## Sequence
1. Verify input contract and run/version identifiers.
2. Perform only this phase’s responsibility.
3. Emit structured artifacts and audit metadata.
4. Stop or route to human review when a blocking decision is unresolved.

## Outputs
Column profile, quality findings, sample values handled with privacy minimization, and row identifiers.

## Safety
Never discard source values or bypass a downstream gate. Treat customer data as sensitive; expose only what the task requires.
