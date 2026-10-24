# Customer Data Cleaner — Test Plan

**Purpose:** Repeatable functional, regression, integration, and browser testing.

**Status:** Initial plan. Record real results after each run; never mark unrun tests as passed.

## 1. Objectives

Verify:
- App startup, navigation, and responsive UI.
- The Profile, Mapping, Normalization, Validation, and Exception agents.
- CSV upload, profiling, cleaning, validation, exception handling, and export.
- Chatbot approved Q&A loading, recommendations, fallback behavior, and errors.
- Any location counts are computed from the active uploaded file, not hardcoded.
- No unexpected data loss, silent merging, or external transmission of uploaded data.

## 2. Test rules

1. Use synthetic data only; never use real customer or patient data.
2. Treat approved Q&A JSON and approved wording as read-only. Held entries must remain excluded from matching and suggestions.
3. Do not change business rules just to make tests pass. Flag ambiguous requirements for owner review.
4. Use statuses: `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, or `NOT IMPLEMENTED`.
5. Do not claim browser tests passed unless a browser was actually used.
6. Do not deploy, push, or commit during testing unless explicitly authorized.
7. Keep the floating chatbot on the Live Demo page only. Do not add an Export JSON button to the homepage banner.
8. Do not send uploaded data to external APIs during local tests.

## 3. Inspect the repository first

Before running commands, inspect the actual project structure:
- Identify the homepage, Live Demo page, JS/CSS files, approved Q&A JSON, existing tests, and `package.json` if present.
- Follow the existing project's setup instructions.
- Verify which file types are actually supported. Do not claim XLS/XLSX support unless implemented and tested.
- Identify the approved BRD and flag unclear rules rather than guessing.
- Review `git diff` before and after edits.

## 4. Synthetic fixtures

Create test fixtures in the existing test/fixtures location if appropriate.

### Fixture A — valid customer records

```csv
Customer ID,First Name,Last Name,City,Email,Phone
C001,Asha,Rao,Newark,asha@example.test,555-0101
C002,Dev,Shah,Newark,dev@example.test,555-0102
C003,Mina,Lee,Secaucus,mina@example.test,555-0103
C004,Noah,Patel,New York,noah@example.test,555-0104
C005,Ira,Das,newark,ira@example.test,555-0105
```

Expected counts for this fixture, if location-count functionality is implemented:
- Newark: 3 (case-insensitive exact match).
- Secaucus: 1.
- New York: 1.
- Edison: 0.

These are expected test results for Fixture A only. Never hardcode them in app logic.

### Fixture B — quality issues

```csv
Customer ID,First Name,Last Name,City,Email,Phone
C101, Riya ,Menon, Newark ,riya@example.test,555-0201
C102,Sam,Kim,Secaucus,,555-0202
C103,Lee,Park,Newark,not-an-email,555-0203
C104,Uma,Shah,,uma@example.test,555-0204
C105,Tom,Ray,New York,tom@example.test,555-0205
C105,Tom,Ray,New York,tom@example.test,555-0205
```

Expected behavior:
- Whitespace is detected and normalized only if an explicit rule enables it.
- Missing and invalid email values are flagged according to configured rules.
- Missing City is flagged if City is required.
- Duplicate IDs are flagged for review; ambiguous records are not silently merged or deleted.
- Transformations and reasons are traceable where supported.

### Fixture C — missing identifier

```csv
First Name,Last Name,City,Email
Asha,Rao,Newark,asha@example.test
Dev,Shah,Secaucus,dev@example.test
```

Expected: a clear missing-identifier/schema message; no crash and no invented IDs.

### Fixture D — edge cases

Prepare separate test files for:
- Empty file and header-only CSV.
- Missing headers and duplicate column names.
- Quoted values containing commas.
- Non-ASCII characters.
- Malformed CSV quoting.
- Unsupported file type such as `.txt`.
- A reasonably large synthetic CSV for basic responsiveness.

Do not assume renaming a text file to `.csv` makes it valid CSV.

## 5. Functional test cases

| ID | Area | Test | Expected result |
|---|---|---|---|
| SET-01 | Startup | Open app using intended local server | Correct page loads; no blank screen |
| SET-02 | Navigation | Click navigation and Explore Live Demo | Correct pages open; no broken links |
| UI-01 | UI | Check desktop and narrow viewport | Important controls remain usable and visible |
| UI-02 | Chatbot | Check homepage and Live Demo | Floating chatbot appears only on Live Demo |
| UP-01 | Upload | Upload Fixture A | File is accepted; preview or clear next step appears |
| UP-02 | Upload | Upload unsupported type | Helpful error; no crash |
| UP-03 | Upload | Upload empty/malformed CSV | Helpful error; no misleading success |
| UP-04 | Upload | Upload Fixture C | Missing identifier is clearly reported |
| PROF-01 | Profile | Profile Fixture A | Row/column counts and types match input |
| PROF-02 | Profile | Profile Fixture B | Missing values, whitespace, and potential duplicates are surfaced accurately |
| MAP-01 | Mapping | Use recognizable source headers | Mapping suggestions are reviewable and relevant |
| MAP-02 | Mapping | Use ambiguous/missing headers | Ask for clarification; do not invent a confident mapping |
| NORM-01 | Normalization | Apply explicit whitespace rule | Output follows rule; transformations are traceable where supported |
| NORM-02 | Normalization | Supply ambiguous names/addresses | No speculative transformation |
| VAL-01 | Validation | Validate Fixture B | Records are classified using documented rules and reasons |
| VAL-02 | Validation | Validate clean Fixture A | No false errors beyond configured rules |
| EXC-01 | Exception | Review flagged records | Each has an understandable reason and supported next step |
| EXC-02 | Exception | Resolve/reprocess, if supported | Status/results update consistently |
| CHAT-01 | Chatbot | Ask approved matching question | Correct approved response appears |
| CHAT-02 | Chatbot | Ask unmatched question | Safe fallback; no fabricated answer |
| CHAT-03 | Recommendations | Open recommendations | Only eligible, approved suggestions appear |
| CHAT-04 | Q&A safety | Check held entries | Held entries remain excluded; original approved JSON unchanged |
| CHAT-05 | Q&A errors | Test missing/malformed JSON in test environment | Clear error/fallback; no uncaught failure |
| CHAT-06 | Location counts | With Fixture A ask “How many customers are from Newark?” | If implemented, result is calculated from active file; expected 3 |
| CHAT-07 | Location counts | Ask for Secaucus, New York, and Edison with Fixture A | If implemented, results are 1, 1, and 0 |
| CHAT-08 | Location counts | Replace Fixture A with another file and repeat | Count reflects new file; no stale result |
| CHAT-09 | Location counts | Ask without uploading a file | Prompt to upload; no invented number |
| CHAT-10 | Location counts | Use a file without an unambiguous location column | Ask user to choose a column or explain limitation |
| EXP-01 | Export | Export cleaned data, if supported | Export matches processed records and columns |
| EXP-02 | Export | Export validation report, if supported | Report matches actual validation outcomes |
| EXP-03 | Export | Inspect exported output | No unexplained record loss, invented values, or silent merges |
| SEC-01 | Privacy | Inspect browser Network during upload/chat | No uploaded data sent to unapproved external service |
| REG-01 | Regression | Repeat core workflow after changes | Previously working functionality still works |

Tests marked “if implemented” are not claims that the feature exists. If absent, record `NOT IMPLEMENTED` or `FAIL`, then plan the work separately.

## 6. End-to-end agent workflow

Run with Fixture A, then Fixture B:

1. **Profile Agent:** verify schema, row count, field types, missing values, and potential quality issues.
2. **Mapping Agent:** review source-to-target mapping; uncertain mappings require human review.
3. **Normalization Agent:** apply only explicitly configured rules and compare input/output.
4. **Validation Agent:** classify records using documented rules and capture reasons.
5. **Exception Agent:** verify review/rejected records remain accessible and actionable according to supported behavior.
6. **Reconcile records:** compare input row count to output categories; explain all exclusions. Unexplained loss is a failure.
7. **Export:** compare downloaded outputs to on-screen results.

Do not assume status names or business rules unless specified in the BRD/configuration.

## 7. Browser test procedure

Run locally on the developer's Mac:

1. Start the app using the project's documented local backend command from the project root:

   ```bash
   npm run dev
   ```

2. Open the actual homepage URL and `http://127.0.0.1:8000/demo.html` if that is the real Live Demo path.
3. Open Chrome DevTools → Console and Network.
4. Reload with Network recording enabled. Check for failed HTML, JS, CSS, asset, or JSON requests.
5. Test navigation, upload, processing, chatbot open/close, suggestions, matching questions, and unmatched questions.
6. Upload synthetic fixtures and compare counts with the expected results.
7. Test keyboard navigation using Tab, Enter, and Space; verify visible focus.
8. Test desktop and narrow viewport layouts.
9. Save console errors, failed requests, screenshots, and reproduction steps.

If a framework or dev server is used, follow its project scripts instead. Never report browser verification as passed if the browser was not exercised.

## 8. Automated testing

- Use the test runner already configured in the repository.
- If no runner exists, propose a minimal compatible test setup before adding dependencies.
- Unit-test parsing, normalization, validation, location counting, and Q&A filtering where feasible.
- Cover success and failure paths with synthetic fixtures.
- Do not weaken tests, suppress errors, or mark skipped tests as passed.
- Record exact command and exit code.

Example syntax checks only for files that actually exist:

```bash
node --check demo.js
node --check demo-chat.js
node --check chat-core.js
node --check demo-core.js
```

## 9. Results log

Record one row per test. Use `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, or `NOT IMPLEMENTED`.

| Test ID | Status | Command/steps | Actual result | Evidence / issue |
|---|---|---|---|---|
| SET-01 | NOT RUN | | | |
| UP-01 | NOT RUN | | | |
| PROF-01 | NOT RUN | | | |
| MAP-01 | NOT RUN | | | |
| NORM-01 | NOT RUN | | | |
| VAL-01 | NOT RUN | | | |
| EXC-01 | NOT RUN | | | |
| CHAT-01 | NOT RUN | | | |
| CHAT-06 | NOT RUN | | | |
| EXP-01 | NOT RUN | | | |
| SEC-01 | NOT RUN | | | |
| REG-01 | NOT RUN | | | |

## 10. Definition of done

A test cycle is complete only when:
- All applicable automated tests are run and recorded.
- Critical manual browser tests are run locally.
- Failed tests have reproducible steps and are fixed or tracked as open issues.
- Held Q&A entries remain excluded and approved wording remains unchanged.
- Location counts, if implemented, use the active uploaded file and have automated coverage.
- No critical console errors or unexplained failed network requests remain.
- The report separates verified behavior from assumptions and unrun tests.

## 11. Codex prompt to execute this plan

> Read `TEST_PLAN.md` and inspect the actual repository structure before testing. Execute every applicable automated test and syntax check supported by this project. Use synthetic fixtures only. Do not change approved Q&A JSON or expose held entries. Do not invent test results. Fix only reproducible defects within approved scope, then rerun relevant tests. Do not deploy, push, or commit. Report test IDs, exact commands, PASS/FAIL/BLOCKED/NOT RUN/NOT IMPLEMENTED status, actual evidence, files changed, and manual browser steps still required. If a feature is not implemented, report it as NOT IMPLEMENTED or FAIL rather than implying it passed.
