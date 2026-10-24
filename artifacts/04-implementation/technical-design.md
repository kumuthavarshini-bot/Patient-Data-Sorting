# Technical design

The new Node CLI (`orchestration/orchestrator.js`) reads a local UTF-8 CSV and calls `demo-core.js` for parsing, safe normalization, deterministic ID checks, and CSV escaping. `workflow.config.json` declares phases, versions, agent instruction and skill references, and safety controls. Agent envelopes are JSON; output artifacts are persisted under an ignored `runs/<run-id>/` directory. No server or external API is used. Mapping approval is required. The pipeline blocks at import because no destination exists.
