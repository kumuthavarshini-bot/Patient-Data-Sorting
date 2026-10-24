# Test execution report

**Executed:** 2026-10-24  
**Environment:** macOS, Node.js v24.7.0, npm 11.5.1  
**Repository revision:** unavailable; this folder has no `.git` metadata.  
**Scope:** rerun tests and workflows after the homepage/navigation/local-server changes. No reproducible application test failure was found in this run, so no application or test code was changed.

## Results

| Check | Status | Result |
|---|---|---|
| Complete suite (`npm test`) | **PASS** | 43 tests passed; 0 failed, cancelled, skipped, or todo. |
| Chat core tests | **PASS** | 11/11. |
| Data processor tests | **PASS** | 13/13. |
| Demo chatbot tests | **PASS** | 7/7. |
| Deployment tests | **PASS** | 6/6. |
| Orchestrator tests | **PASS** | 5/5. |
| UX workflow tests | **PASS** | 1/1. |
| Deterministic stress harness | **PASS** | Row ladder 100 through 100,000 passed correctness checks; ST-04, ST-05, ST-07, ST-08, ST-10, and ST-13 supplemental checks passed. This is a Node/core benchmark, not browser stress testing. |
| Build (`npm run build`) | **PASS** | `dist/` generated with 9 root page/asset files and the Q&A JSON. |
| JavaScript syntax | **PASS** | `node --check` passed for script, test, orchestration, and browser JS files. |
| Synthetic orchestration workflow | **PASS** | `READY_FOR_REVIEW`, run `20261024151442_7ef19518`; uses the repository's synthetic CSV fixture. |
| UX audit workflow | **PASS** | 10 documentation evidence stages checked; it reported no research or usability sessions conducted. |
| Development HTTP server | **BLOCKED** | In the preceding navigation-fix attempt, `npm run dev` completed its build, then Python failed to bind with `PermissionError: [Errno 1] Operation not permitted`. This environment restriction prevented HTTP/browser verification. The same blocked socket operation was not retried. |
| Browser and production behavior | **NOT RUN / BLOCKED** | No browser automation package is configured and no production URL was provided. DevTools, real refresh/navigation, responsive/keyboard behavior, and production routes are unverified. |
| Git status/diff | **BLOCKED** | `git status --short` and diffs fail because the supplied directory is not a Git repository. No revision or full diff is available. |

## Exact commands executed

```sh
npm test
node --test tests/deployment.test.js
for f in tests/*.test.js; do printf '\n=== %s ===\n' "$f"; node --test "$f" || exit $?; done
node tests/stress-benchmark.js
npm run build
for f in scripts/*.js tests/*.js orchestration/*.js demo.js demo-core.js demo-chat.js chat-core.js; do node --check "$f" || exit $?; done
npm run demo:orchestration
npm run ux:audit
git status --short
git diff --stat
git diff
```

`npm run dev` was attempted during the immediately preceding navigation-fix run; it built successfully, then exited 1 when the environment denied binding port 8000. The same blocked socket operation was not retried.

All six `*.test.js` files were run individually in addition to the complete suite and direct deployment test. The stress harness recorded synthetic input sizes from 7,430 bytes at 100 rows to 7,976,766 bytes at 100,000 rows. The 100,000-row median measurements were 81.13 ms parse, 33.93 ms processing, and 101.55 ms export serialization across three in-process trials; expected city counts and record reconciliation matched. These are Node.js harness measurements and do not establish browser performance or a user-approved performance limit.

The complete suite includes checks for presentation section/content order, explicit homepage/demo links, demo back navigation, source asset existence, published build contents, eligible-only Q&A output, parser/cleaner behavior, chatbot answers/fallbacks/error handling, orchestration gates, and UX evidence reporting.

## Reproduced failures and diagnosis

- The requested Git inspection cannot run: `git status --short` reports `fatal: not a git repository`; Git diff commands report `Not a git repository`. This is an inspection limitation, not an application failure.
- The HTTP server failure was observed in the prior fix attempt: build succeeds, then binding to port 8000 fails with the permission error above. It is environment-blocked, not evidence of a route/build failure.
- No project test failure reproduced in this rerun. A prior navigation-fix run caught a stale assertion expecting a `./` redirect; that assertion was updated to expect `index.html` and its focused test then passed. The current full suite remains green.

## Build and deployment

The generated output contains `dist/index.html`, `dist/demo.html`, demo CSS/JavaScript, redirect aliases, and `dist/input/customer_data_cleaner_chatbot_approved_qa.json` with eligible entries only. The source Q&A is left unchanged. There is no `vercel.json`; the project is a multi-page static site, so no SPA rewrite is indicated. `docs/DEPLOYMENT.md` specifies Root Directory at the project root, Framework Preset **Other**, Build Command `npm run build`, and Output Directory `dist`.

Build output was checked locally, but the live HTTP root, demo refresh, chatbot network request, and production URL were not tested. Do not treat deployment as verified.

## Files changed for this audit

- `docs/ERROR_DIAGNOSIS.md` — documents the navigation symptom mechanism and local server limitation.
- `docs/TEST_EXECUTION_REPORT.md` — this updated execution record.

No application code, tests, approved Q&A JSON, or held entries were changed during this rerun. Build regenerated ignored `dist/`; the CLI workflow created ignored run output under `runs/20261024151442_7ef19518/` and `runs/ux-20261024151442-6c2317/`.

## Manual verification

In a local terminal, from the project folder:

```sh
npm run dev
```

Open `http://127.0.0.1:8000/` and verify the six-section presentation appears instead of a directory listing. Click **Live Demo**, verify `/demo.html` loads, click **← Back to AI Orchestration**, and refresh both routes. In DevTools Network, confirm local CSS/scripts and `/input/customer_data_cleaner_chatbot_approved_qa.json` load successfully; in Console, confirm there are no errors. Use synthetic CSV only to check upload, preview, profile, mappings, results, exports, chatbot open/close, recommendations, and fallback. Repeat against the production URL after deployment; that URL was not supplied or tested here.

## Functional data-cleaning workflow update — 2026-10-24

This section records the later implementation work for CSV mapping, filtering, validation, and report downloads. Synthetic data only.

| Check | Status | Result |
|---|---|---|
| Complete suite (`npm test`) | **PASS** | 56 passed; 0 failed, skipped, or cancelled. Includes the two new UI workflow tests. |
| UI workflow integration (`node --test tests/demo-app.test.js`) | **PASS** | 2 passed; exercises upload, explicit ID approval, real-value filtering, processing, report contents, mapping reuse rejection, and filter reset. |
| Build (`npm run build`) | **PASS** | Static build generated 9 page/asset files and four eligible Q&A entries. |
| Browser JavaScript syntax | **PASS** | `demo-core.js`, `demo.js`, and `demo-chat.js` passed `node --check`. |
| Synthetic CLI orchestration (`npm run demo:orchestration`) | **PASS** | `READY_FOR_REVIEW`, run `20261024153423_6766c0d5`; used the repository synthetic CSV fixture. |
| UX documentation audit (`npm run ux:audit`) | **PASS** | Checked 10 evidence stages; reports no research or usability sessions conducted. |
| Deterministic stress benchmark (`node tests/stress-benchmark.js`) | **PASS** | Correctness/reconciliation passed at 100, 1,000, 5,000, 10,000, 25,000, 50,000, and 100,000 rows; supplemental ST-04/05/07/08/10/13 passed. At 100,000 rows: 7,976,766 input bytes, 17,153,501 serialized export bytes, medians 75.26 ms parse, 59.88 ms process, 103.01 ms export serialization; 239,135,216 bytes Node heap after GC. Node benchmark only, not browser capacity evidence. |
| Git diff/status | **BLOCKED** | The workspace has no `.git` metadata, so Git cannot show a changed-file list or diff. |
| Live HTTP/browser verification | **NOT RUN** | A previous attempt to start the local server failed because this environment denied socket binding. The blocked operation was not repeated. |

### Exact commands executed for this update

```sh
node --test tests/demo-app.test.js
npm test
npm run build
node --check demo-core.js && node --check demo.js && node --check demo-chat.js
npm run demo:orchestration
npm run ux:audit
node tests/stress-benchmark.js
git status --short && git diff --stat && git diff --check
```

The last command returned `fatal: not a git repository`. It does not indicate an application failure. Read-only inspection of `package.json`, the prior diagnosis, the prior report, and the project directory was used to identify relevant files; no credentials were inspected.

### Files changed for the functional workflow update

- `demo-core.js` — robust header matching, mapping validation/readiness, deterministic processing and source-preserving records, exact filters, validation/exception/summary report generation.
- `demo.js` — explicit mapping approval gate, dynamic source and quality filters, current-result filtering, status/report rendering and downloads.
- `demo.html` — filter controls, result summaries and report-download controls, plus scope disclosures.
- `demo.css` — responsive styling for the new filter controls and result views.
- `tests/data-processor.test.js` — deterministic core tests for mapping, processing, filters, review findings, and reports.
- `tests/demo-app.test.js` — synthetic DOM integration tests of upload-to-filter-to-download behavior.
- `docs/ERROR_DIAGNOSIS.md` — original root-cause findings and implementation summary.
- `docs/TEST_EXECUTION_REPORT.md` — this update's test evidence and limitations.

Desktop/mobile layout, real file-picker interaction, browser-generated download behavior, and DevTools network/console inspection remain unverified. On a Mac, run `npm run dev` from the project folder and open `http://127.0.0.1:8000/demo.html`. Upload synthetic UTF-8 CSV with `Customer Number,City,Email` headers; confirm Customer ID explicitly; filter City to `newark`; run processing; inspect the filtered/exception tabs and download all reports. Use `npm test` for repeatable automated checks. Excel is not supported, and no import occurs.
