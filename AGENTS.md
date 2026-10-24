# Customer Data Cleaner — Agent Guidance

## Project status
This repository currently contains the draft BRD at `input/customer_data_cleaner_BRD.md`. The implementation guide was not present when this scaffold was created. Treat this as a planning scaffold, not a runnable application.

## Product contract
- Build a CSV onboarding flow that profiles, maps, normalizes, validates, routes exceptions, and imports only eligible records.
- Never silently discard invalid rows or let AI suggestions bypass deterministic validation.
- Preserve source values and record transformations, rule/schema versions, run identifiers, and outcomes.
- Require human confirmation for ambiguous mappings and before import.
- Duplicate customer IDs in one batch flag every conflicting row by default.
- Invalid or review-required records must not be imported. Reprocessing must validate corrected values again.
- Keep customer data out of AI prompts unless strictly needed; do not invent corrections.

## Workflow scaffold
The seven phases and contracts live under `workflow/phases/`; orchestration lives in `workflow/orchestrator.yaml`. Runtime instructions for the five BRD agents are in `agents/`. Reusable phase capabilities are in `skills/`.

## Before implementation
Resolve the open decisions listed in `workflow/REQUIREMENTS.md` and confirm the implementation guide. Do not treat proposed metrics as measured outcomes. Use deterministic code for file parsing, normalization, rules, routing, and import gates; use AI for interpretation and recommendations with explainable outputs.

## Change discipline
Keep phase inputs, gates, and output contracts explicit. Update the relevant phase docs and agent contracts when schemas or rules change. This scaffold does not prescribe a production stack or claim security/compliance controls are implemented.
