# Phase — Preview and import

## Purpose
Preview eligible rows, require confirmation, execute controlled/idempotent import, and report receipt.

## Responsible capability
`import-safety` skill; see `skills/import-safety.md`. Specialist agent, when applicable, is referenced in `workflow/orchestrator.yaml`.

## Sequence
1. Verify input contract and run/version identifiers.
2. Perform only this phase’s responsibility.
3. Emit structured artifacts and audit metadata.
4. Stop or route to human review when a blocking decision is unresolved.

## Outputs
Import receipt, accepted/rejected/not-processed counts, downloadable outputs, terminal run status.

## Safety
Never discard source values or bypass a downstream gate. Treat customer data as sensitive; expose only what the task requires.
