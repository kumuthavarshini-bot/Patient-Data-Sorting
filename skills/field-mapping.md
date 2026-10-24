# Field Mapping Skill

Version: 1.0.0
Purpose: Propose only supported source-to-canonical mappings.
When to run: After profile output is valid.
Required inputs: Source headers, profile, configured schema version, mapping approval.

Compare source headers and limited sample evidence with the versioned canonical customer schema. Return proposed mappings, rationale, confidence, unmapped fields, and ambiguity. Do not invent target fields. Require human approval for ambiguous/low-confidence mappings and required-field coverage before normalization.

## Execution and output
The runtime function is `proposeMappings` in `orchestration/orchestrator.js`. It recognizes only configured aliases for BRD-required `customer_id` and writes `agent-results/mapping-proposal.json`. No extra canonical target is assumed.

## Validation, errors, example, and tests
Gate: target mapping must reference an existing source header, and explicit approval must be supplied before normalization. Missing or multiple candidate headers return `NEEDS_REVIEW`. Example: `Customer ID` is a unique high-confidence proposal, but still requires approval. Tests: `tests/orchestrator.test.js`. Limitation: mapping rationale/threshold and full target schema await business approval.
