# Customer Data Cleaner — AI Orchestrator

Static browser app served by a small local Node.js backend, plus a deterministic Node.js orchestration demonstration. The browser demo parses files on the device. The optional Ask DataCare AI integration only classifies an unmatched chat question against eligible approved FAQ questions; the server returns the exact local approved answer for a selected FAQ. Uploaded files and conversation history are not sent to the model. The CLI demonstrates five runtime data-processing code procedures, structured handoffs, explicit mapping approval, validation reconciliation, and local evidence artifacts. It does not import records to a destination.

## Local setup

Requirements: Node.js 18 or newer (uses built-in `fetch`, HTTP server, and test runner); no package install or runtime dependency is required.

```sh
npm test
npm run dev
```

The server builds the static files and serves both the app and same-origin `/api/match` endpoint on loopback. Open `http://127.0.0.1:8000/` for the six-section AI Orchestration presentation and `http://127.0.0.1:8000/demo.html` for the browser-local cleaner. Previous dashboard and outcomes URLs redirect to the presentation.

For a new checkout, copy `.env.example` to `.env` and set `OPENAI_API_KEY` to a valid API key. Set `OPENAI_MODEL` to an API model ID available to that project and `ENABLE_AI_MATCHING=true` to enable question matching. The server reads these values locally; `.env` is ignored by Git and is never copied into `dist/`. Keep the key out of browser code, logs, and support messages. The UI sends only an unmatched chat question to the local backend; the backend sends that question and eligible FAQ question metadata to OpenAI for classification, never uploaded file data or FAQ answers. The model cannot write the response: the backend returns an answer only by looking up the selected ID in approved local FAQ content.

## Run the synthetic orchestrator

```sh
npm run demo:orchestration
```

The command processes `tests/fixtures/synthetic-customers.csv` and writes a unique `runs/<run-id>/` evidence directory. To process another local CSV, first review the mapping, then run:

```sh
node orchestration/orchestrator.js ./path/to/file.csv --customer-id-column 'Customer ID' --approve-mappings
```

The approval flag records the operator's mapping approval. The output may contain source values; protect and delete run folders under your organization’s retention policy. Do not use sensitive records until privacy and retention controls are approved.

## Project references

- Requirements and open decisions: `input/customer_data_cleaner_BRD.md`, `workflow/REQUIREMENTS.md`
- Agent/skill/artifact map and UX workflow: `docs/AGENT_SKILL_ARTIFACT_TRACEABILITY.md`, `docs/UX_ORCHESTRATION.md`
- Deployment and limitations: `docs/DEPLOYMENT.md`, `docs/KNOWN_LIMITATIONS.md`
- UX project artifacts remain in the repository under `artifacts/`; they are not additional website pages.

The 7 product-planning phases, 7 CSV-processing phases, 5 data-processing agents, and 10 UX evidence stages are separate workflows.
