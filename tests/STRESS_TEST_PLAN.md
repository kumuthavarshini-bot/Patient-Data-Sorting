# Customer Data Cleaner — Stress Test Plan

**Purpose:** Evaluate performance, stability, memory use, recovery, and data correctness under increasing workload for the Customer Data Cleaner and AI Orchestrator.

**Important:** This plan is for a local development/test environment with synthetic data. It is not permission to load-test production, third-party services, or systems without authorization.

## 1. Scope and safety

- Use synthetic records only. Do not use real customer, patient, or production data.
- Run tests locally or in an explicitly authorized test environment.
- Do not target public websites, production APIs, or external services with load.
- Keep uploaded data in the browser unless the approved design explicitly requires otherwise.
- Do not change approved Q&A JSON or expose held Q&A entries.
- Do not deploy, push, or commit as part of a stress-test run.
- Do not assume XLS/XLSX support; confirm formats from the actual implementation.
- Start small and increase load gradually. Stop if the browser becomes unresponsive, the machine is under heavy memory pressure, or data correctness fails.
- Do not run concurrent tests until a single run is stable.

## 2. Goals

Measure:
1. Maximum practical CSV size and row count before failure or unacceptable slowdown.
2. Time to parse, profile, map, normalize, validate, and prepare exports.
3. Browser responsiveness while processing.
4. Memory growth and cleanup after replacing files or restarting workflows.
5. Correctness of row counts, classifications, and exports at each scale.
6. Behavior under repeated uploads, repeated processing, malformed input, and rapid UI actions.
7. Chatbot response stability and location-count correctness under repeated requests, if those features exist.
8. Recovery after errors and whether a fresh valid upload can be processed afterward.

## 3. Discover project capabilities first

Before testing:
- Inspect the repository, `package.json`, test scripts, parser implementation, and current architecture.
- Identify the actual upload limits, supported file types, expected columns, and configured validation rules.
- Determine whether processing runs on the main thread, in a worker, or on a server.
- Determine whether location counts and export formats are implemented.
- Identify any existing performance tests and establish a baseline.
- Do not invent performance requirements. If none exist, record measured baseline values and propose targets for owner approval.

## 4. Synthetic dataset generator

Generate deterministic synthetic CSV files locally. Use a fixed seed where possible so runs are repeatable. Do not put generated data in the production dataset or approved Q&A JSON.

Suggested scale ladder:

| Level | Approximate rows | Purpose |
|---|---:|---|
| S0 | 100 | Sanity baseline |
| S1 | 1,000 | Small workload |
| S2 | 5,000 | Moderate workload |
| S3 | 10,000 | Larger workload |
| S4 | 25,000 | Heavy workload |
| S5 | 50,000 | Stress workload |
| S6 | 100,000 | Optional upper-bound experiment, only if prior levels remain stable |

Use a synthetic schema compatible with the app's actual requirements, for example:

```csv
Customer ID,First Name,Last Name,City,Email,Phone
C000001,TestFirst1,TestLast1,Newark,user000001@example.test,555-0101
C000002,TestFirst2,TestLast2,Secaucus,user000002@example.test,555-0102
C000003,TestFirst3,TestLast3,New York,user000003@example.test,555-0103
```

The rows above are examples. Generate unique IDs and emails for the dataset, and vary locations deterministically. Include separate variants with:
- 0%, 1%, and 10% invalid or missing values.
- 0%, 1%, and 5% duplicate IDs.
- Long text fields.
- Unicode values.
- A small percentage of quoted commas and escaped quotes.
- A known distribution of cities for validating location counts.

For each generated file, record row count, byte size, generation parameters, and a checksum if practical. Do not create a single huge file before testing smaller sizes.

## 5. Test types

### ST-01 — Baseline
Run the smallest dataset and record startup time, upload/parse time, processing time per agent, export time, memory observations, and any console errors.

**Pass criteria:** Correct output and no uncaught errors. Timing is a baseline, not a pass threshold unless a target has been approved.

### ST-02 — Step-load test
Run S0 through S5 in order. Advance only if the prior level finishes correctly and the browser remains responsive.

Record:
- File size and row count.
- Upload/parse time.
- Profiling time.
- Mapping/normalization/validation/exception time, if separately measurable.
- Total time to results.
- Export time.
- Peak or observed browser memory, if available.
- Console errors and UI responsiveness.
- Input and output record counts.

**Pass criteria:** Correct counts and classifications; no unexplained record loss; no crash; no unhandled error. Compare performance against approved targets if they exist.

### ST-03 — Upper-bound test
Attempt 100,000 rows only after smaller levels are stable and the device has sufficient resources.

**Pass criteria:** Either completes correctly within approved limits, or fails gracefully with a clear size/resource message. A browser freeze, silent truncation, or misleading success is a failure.

### ST-04 — Sustained workload
Process the same moderate dataset 10 times, one run at a time.

**Pass criteria:** No progressive slowdown that exceeds approved tolerance, no stale results, no growing duplicate output, and no obvious unreleased resources. If memory measurement is unavailable, record that limitation.

### ST-05 — Repeated file replacement
Upload and process datasets of different sizes in sequence, for example 1,000 → 10,000 → 100 → 5,000 rows.

**Pass criteria:** Each result reflects only the current file. No old rows, counts, errors, or chatbot answers leak into the next run.

### ST-06 — Burst UI actions
In the local browser, rapidly select a new file, cancel selection, start processing, and navigate between supported views. Do not automate unsupported actions by bypassing UI safeguards.

**Pass criteria:** Controls remain usable; only valid operations run; no race condition causes results to be associated with the wrong file.

### ST-07 — Error recovery
Attempt to process an empty, malformed, or unsupported file, then immediately upload a valid dataset.

**Pass criteria:** The failure is clearly reported and does not poison app state. The subsequent valid file processes correctly.

### ST-08 — High-invalid-rate workload
Run datasets with 1% and 10% invalid/missing values and known duplicate rates.

**Pass criteria:** Validation and exception totals match the fixture's expected counts under configured rules. Processing does not become unstable as exception volume rises.

### ST-09 — Export stress
Export large valid, review-required, and invalid datasets, where the application supports those exports.

**Pass criteria:** Export completes or fails gracefully; output opens; headers, row counts, encoding, and classification are correct. No unexplained record loss.

### ST-10 — Chatbot request repetition
If the chatbot is implemented, submit 50 varied synthetic questions sequentially, then 10 repeated questions.

**Pass criteria:** No crash, UI lock, stale response, or cross-contamination between questions. Record latency distribution. Do not send requests to an external model or API for this local test unless explicitly approved.

### ST-11 — Location-count scale test
If data-dependent location counting exists, upload a generated file with a known city distribution and test each city plus a zero-match city.

**Pass criteria:** Counts equal the generated distribution at each dataset size and update after replacing the file. If the feature is absent, record `NOT IMPLEMENTED`; do not invent counts.

### ST-12 — Long-session memory and cleanup
Open the app, process a moderate dataset, replace it, export, and repeat the workflow for 30 minutes if practical.

**Pass criteria:** App remains responsive, current-file state stays correct, and memory does not grow continuously without explanation. Record device/browser constraints.

### ST-13 — Large-column test
Use a synthetic dataset with the usual row count but many extra columns, such as 50 and 200 columns, only if the parser/UI can reasonably accept it.

**Pass criteria:** Schema handling remains correct, unsupported complexity fails gracefully, and preview tables do not make the browser unusable.

### ST-14 — Concurrency and overlapping actions
Only if the app supports asynchronous processing or workers: start one operation and trigger another supported operation before the first finishes.

**Pass criteria:** The app prevents unsafe overlap or manages it deterministically. Results are not attached to the wrong upload. Do not introduce concurrency if the product is designed for one operation at a time.

## 6. Data correctness checks at every scale

For each run, verify:
- Input data row count equals the expected fixture count.
- Output row count reconciles with valid + review-required + invalid + documented exclusions.
- No unexplained rows disappear or duplicate.
- IDs retain leading zeros where required.
- Location distribution and location counts match the generated fixture.
- Validation/exception counts match known injected defect rates and configured rules.
- Exported records match the intended processed output.
- Replacing the input file clears or updates all file-derived state.
- No held Q&A entry becomes available due to load or error conditions.

Do not assume every record must be valid. The expected classification depends on the BRD and configured rules.

## 7. Measurement protocol

For each run:
1. Use the same browser, device, and power conditions where possible.
2. Close unrelated heavy applications and note the browser version.
3. Start with a fresh page load for baseline measurements.
4. Use browser DevTools Console and Network to capture errors and failed requests.
5. Record the time from file selection to preview, from processing start to results, and from export click to completed download.
6. Repeat each stable level at least three times if practical; report median and range rather than only the fastest run.
7. Record whether the measurement was manual or automated.
8. Never fabricate peak memory or timing values.

## 8. Stop conditions

Stop increasing load immediately if any of these occur:
- Browser tab becomes unresponsive or crashes.
- OS reports serious memory pressure.
- The page becomes unusable for more than the team-approved timeout.
- Records are silently truncated, duplicated, or lost.
- Counts or exports become incorrect.
- The app sends data to an unexpected external service.
- A test starts affecting anything outside the authorized local environment.

Record the last stable size and the first failing size. Do not repeatedly rerun a failing upper-bound test without changing the hypothesis or conditions.

## 9. Commands and automation

Inspect the repository before selecting commands. Use existing scripts first.

For JavaScript syntax checks, run only for files that exist:

```bash
node --check demo.js
node --check demo-chat.js
node --check chat-core.js
node --check demo-core.js
```

Run the configured test suite and record exact commands and exit codes. If no performance harness exists, add a small local synthetic-data generator and benchmark harness only after inspecting the current architecture. Avoid adding heavy dependencies without justification.

A benchmark should:
- Generate synthetic files at the scale ladder.
- Use a deterministic seed.
- Record file size, rows, runtime, and result counts.
- Fail if observed counts differ from known fixture expectations.
- Keep raw customer-like data synthetic.
- Avoid benchmarking production or external endpoints.

## 10. Results template

Record one row per test and dataset size.

| Test ID | Rows | File size | Status | Parse time | Processing time | Export time | Correctness | Console/UI observations |
|---|---:|---:|---|---:|---:|---:|---|---|
| ST-01 | 100 | | NOT RUN | | | | | |
| ST-02 | 1,000 | | NOT RUN | | | | | |
| ST-02 | 5,000 | | NOT RUN | | | | | |
| ST-02 | 10,000 | | NOT RUN | | | | | |
| ST-02 | 25,000 | | NOT RUN | | | | | |
| ST-02 | 50,000 | | NOT RUN | | | | | |
| ST-03 | 100,000 | | NOT RUN | | | | | |
| ST-04 | 10 repeats | | NOT RUN | | | | | |
| ST-05 | mixed sizes | | NOT RUN | | | | | |
| ST-07 | recovery | | NOT RUN | | | | | |
| ST-09 | large export | | NOT RUN | | | | | |
| ST-10 | 50 questions | | NOT RUN | | | | | |
| ST-11 | city counts | | NOT RUN | | | | | |
| ST-12 | 30 minutes | | NOT RUN | | | | | |

Allowed statuses: `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, `NOT IMPLEMENTED`.

## 11. Definition of done

- The step-load ladder has been completed to the last stable level or stopped safely.
- Each run includes observed timing and correctness evidence.
- Input/output row counts reconcile with documented categories.
- No stale state appears after replacing files.
- Error recovery and exports have been tested at representative sizes.
- Any chatbot/location tests are marked `NOT IMPLEMENTED` if the capability is absent.
- Browser tests are reported separately from automated/static tests.
- Limits and recommendations are based on observed measurements, not guesses.
- No production data, unapproved external services, or deployments were involved.

## 12. Codex prompt

> Read `STRESS_TEST_PLAN.md` and inspect the actual repository and architecture before changing anything. Identify existing test commands, file size limits, supported formats, and which agent/chatbot features are implemented. Build or use a deterministic synthetic-data generator and execute the stress-test levels that are safe in this environment. Start small and stop if correctness or stability degrades. Do not use real customer/patient data, call external APIs, modify approved Q&A JSON, expose held entries, deploy, push, or commit. Do not invent timings, memory values, or test results. Record exact commands, dataset sizes, file sizes, observed timings, row-count reconciliation, failures, and unrun browser checks. Fix only reproducible in-scope defects, rerun relevant tests, and distinguish measured results from manual tests still required. If a feature is absent, mark it `NOT IMPLEMENTED` rather than implying it passed.
