# Baseline Repository Audit

Audit date: 2026-10-24. Scope: repository files, source inspection, and test/build commands run in this workspace. No production deployment or external service was accessed.

## Stack and entry points

- Plain HTML, inline CSS/JavaScript on `customer_data_cleaner_orchestrator_interactive_patient_hero (1).html`; no frontend framework.
- `index.html` forwards visitors to the existing dashboard; `demo.html` is the CSV-processing interface.
- `demo.css`, `demo.js`, and `demo-core.js` implement the demo. `demo-chat.js` and `chat-core.js` provide deterministic approved-Q&A behavior.
- Static build is implemented by `scripts/build-static.js`; `package.json` uses Node built-ins and has no runtime dependencies.
- No Git metadata was present in the working directory, so no branch or Git checkpoint was available.

## Existing behavior

| Area | Baseline status | Evidence |
|---|---|---|
| Seven product-planning phases | Interactive local prototype; gate checkboxes/statuses are client-side state, not product research execution. | Dashboard inline script |
| Five data-processing agents | Instruction Markdown exists; homepage explicitly called them planned and did not invoke them. | `agents/*.md`, homepage |
| CSV intake | Implemented locally in browser; UTF-8 CSV only; malformed quoting/uneven rows rejected without silently dropping rows. | `demo-core.js`, `demo.js` |
| Profiling | Implemented locally with counts, type heuristics, and duplicate-ID observations. | `demo.js` |
| Mapping | UI proposes aliases and asks user to choose/confirm Customer ID; schema remains provisional. | `demo.js`, schema proposal |
| Normalization and validation | Trimming/email case processing and deterministic required/duplicate ID checks exist; additional schema policy is unresolved. | `demo-core.js` |
| Exceptions/exports | Valid and invalid rows and transformation details can be exported locally. No destination integration exists. | `demo.js` |
| Chatbot | Deterministic approved Q&A; no LLM or server API. Static build contains only eligible entries. | `demo-chat.js`, `chat-core.js`, build script |
| Evidence and history | No prior durable orchestration run manifest or event log. Workflow dashboard state is a prototype. | Source review |
| Pages | Dashboard and Live Demo only. | HTML inventory |

## Tests and baseline commands

Before the implementation additions: `npm test` passed 35 tests; `npm run build` succeeded and emitted eight app files with four eligible Q&A entries; `node --check` passed for `demo.js`, `demo-core.js`, `demo-chat.js`, and `chat-core.js`. These are local checks, not production deployment tests.

## Deployment baseline

The project contains a Vercel-compatible static build script and deployment allowlist. No `vercel.json` or server functions were present. Production configuration and live Vercel behavior were not inspected.

## Privacy and source control

`.env` exists locally and was not read. `.gitignore` excludes it and `dist/`; generated `runs/` data is now excluded. No raw dataset was opened during this audit. Only a synthetic fixture is used for the orchestration demonstration and tests.
