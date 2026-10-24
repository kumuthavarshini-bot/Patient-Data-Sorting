# Error diagnosis: homepage navigation and local server

**Updated:** 2026-10-24  
**Project:** Customer Data Cleaner — AI Orchestrator

## Root cause

The intended homepage is `/index.html` (the six-section AI Orchestration presentation), and the functional demo is `/demo.html`. The static build copies both files to `dist/`, with `dist/index.html` at the build root. The deployment test verifies that output.

The homepage's AI Orchestration wordmark/current-page link and the demo's home/back links previously used `href="./"`. That path resolves to the current directory when opened from a `file://` URL. In Chrome, following it can display the directory instead of the presentation. This is the concrete navigation defect consistent with the reported `Index of .../Customer Data app/` symptom. The directory listing is not caused by a missing homepage in the current source or build output: `index.html` and `dist/index.html` both exist.

The exact way the reported page was opened (direct folder, `file://` document, or HTTP server rooted at the project folder) cannot be observed from this environment. Thus the observed Chrome session itself was not reproduced. Links now target `index.html` explicitly, so they resolve to the presentation for both HTTP hosting and file-based page navigation, without using a machine-specific absolute path.

## Local server finding

`package.json` had build and test scripts but no local server command. The previous instructions required manually running Python from the project root with a relative `dist` directory. Added `npm run dev`, which builds first and invokes Python's static server with `dist` as its document root. The intended local URLs are `http://127.0.0.1:8000/` and `http://127.0.0.1:8000/demo.html`.

The command successfully ran the build, but this execution environment denied socket binding with `PermissionError: [Errno 1] Operation not permitted`. Therefore HTTP responses and browser behavior are not verified here. Do not treat the failed server startup as a product-code failure or claim that live local/production navigation was tested.

## Deployment output

The project is plain multi-page static HTML/CSS/JavaScript. `vercel.json` is absent; no SPA rewrite is needed. `scripts/build-static.js` emits `index.html`, `demo.html`, all demo scripts/styles, legacy redirect aliases, and the eligible-only chatbot JSON. The deployment instructions specify repository root, Framework Preset **Other**, Build Command `npm run build`, and Output Directory `dist`. No production URL was provided, so deployment remains unverified.

## Fixes and verification

- Updated homepage and demo navigation to use explicit relative HTML filenames.
- Changed old outcomes/dashboard redirects to target `index.html` explicitly.
- Added `npm run dev` and documented its build/serve behavior and URLs.
- Added deployment regression assertions for explicit presentation/demo links, static build files, and the development command.
- Build output still contains the six-section presentation and demo assets; Q&A generation still includes eligible entries only.

Current verification: the full suite passes 43 tests after one stale test assertion was updated to expect the explicit redirect target. `npm run build`, JavaScript syntax checks, and static output checks pass. The actual local HTTP server and browser tests are blocked as described above. See `docs/LOCAL_DEVELOPMENT.md` for the exact manual verification steps.

## Data-cleaning workflow audit — 2026-10-24

Before the functional workflow changes, inspection found these source-level causes/gaps:

1. `demo-core.js` normalized whitespace and hyphens in headers but not underscores or camelCase. Thus `customer_id` and `customerId` did not normalize to `customer id`; `Customer Number` was not in the Customer ID aliases. The generic `id` alias could suggest a semantically unrelated column.
2. `demo.js` treated a unique header suggestion as an already-selected Customer ID mapping, then enabled **Clean and Validate** from a truthy mapping alone. The label asked the user to confirm, but no actual confirmation gate existed. Duplicate mappings and nonexistent columns were not validated.
3. `processRows()` applied selected mappings and retained source arrays, but only emitted blocking missing-ID and duplicate-ID errors. The interface had no record filtering, needs-review disposition, exception CSV, filtered dataset export, or processing summary JSON.
4. Existing downloads comprised only the eligible demo CSV and a basic full validation CSV. There was no report of applied filters/mappings or reconciled counts.

The parser and processing are browser-local and deterministic; the issue is not a failure to read uploaded values. Existing tests cover quoted CSV parsing and core transformations, but before the new coverage they did not assert mapping suggestion/gate behavior, filter composition, review/exception summaries, or generated report contents.

The BRD requires Customer ID presence/uniqueness, confirmed ambiguous mappings, preservation of source values, and traceable validation failures. The canonical schema proposal leaves optional-field requiredness, null-token handling, date formats, and the blocking severity of optional-field format failures unresolved. The implementation therefore must not silently promote these unresolved items into production rules. Any demo-only format screening is labeled and treated as review-only; no import is implemented.

### Implemented functional workflow update — 2026-10-24

The demo now normalizes headers across spaces, punctuation, underscores, and camelCase. It suggests Customer ID from a narrow set of names, including `Customer Number`, and does not treat a suggestion as approval. Processing stays disabled until the user explicitly maps Customer ID; invalid or reused mappings are rejected.

After mapping, the interface offers exact-value filters over uploaded source columns and quality-status filters. Multiple values on one column are alternatives; filters on different columns and the quality status combine. Processing preserves source cells and source row numbers, records transformations and validation findings, marks malformed optional email/date values for review, and flags every duplicate Customer ID row. Filtering is applied to computed results; it does not alter the original result population.

The results provide valid-only, current-filter, full/current-filter validation, exception, and run-summary downloads. Exception output preserves source values. Summary counts and filter exclusions are calculated from the current run. No import, automatic correction, fuzzy matching, or unapproved field policy was added. The CSV-only behavior and review-only optional checks are disclosed in the UI.

Synthetic core and UI integration tests cover these paths. `npm test` passes 56 tests; `npm run build` succeeds and includes four eligible Q&A entries in the static output. JavaScript syntax checks pass. Actual browser/server verification remains blocked by the previously observed environment socket restriction; the local HTTP server was not retried.
