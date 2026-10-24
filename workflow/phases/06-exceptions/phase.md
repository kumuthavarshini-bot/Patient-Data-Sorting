# Phase — Resolve exceptions

## Purpose
Create actionable exception artifacts for invalid/review records and support correction/reprocessing.

## Responsible capability
`exception-management` skill; see `skills/exception-management.md`. Specialist agent, when applicable, is referenced in `workflow/orchestrator.yaml`.

## Sequence
1. Verify input contract and run/version identifiers.
2. Perform only this phase’s responsibility.
3. Emit structured artifacts and audit metadata.
4. Stop or route to human review when a blocking decision is unresolved.

## Outputs
Exception CSV specification/artifact, error summary, correction status, reprocess reference.

## Safety
Never discard source values or bypass a downstream gate. Treat customer data as sensitive; expose only what the task requires.
