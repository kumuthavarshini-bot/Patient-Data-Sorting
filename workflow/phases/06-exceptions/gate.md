# Gate — Resolve exceptions

## Pass condition
Every failed record and error is traceable; originals are retained; corrected records are revalidated; no prior failure is assumed resolved.

## On failure
Set the run to `Needs Review` for a missing human decision or `Failed` for an unrecoverable processing error. Include actionable reason, phase, and affected file/row/field where available. Do not execute downstream phases.

## Audit evidence
Record `run_id`, phase status, timestamps, agent/software version where applicable, schema/rule versions, and artifact references.
