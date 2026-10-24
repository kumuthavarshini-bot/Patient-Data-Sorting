# Customer Data Cleaner — Edge Case Test Plan

**Purpose:** Stress-test the Customer Data Cleaner, five-agent workflow, file handling, and Live Demo chatbot using synthetic edge-case data.

**Status rule:** Record every test as `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, or `NOT IMPLEMENTED`. Never mark an unrun test as passed.

## 1. Safety and scope

- Use synthetic data only; never use real customer, patient, or other sensitive records.
- Do not send uploaded data to external AI/API services during testing.
- Treat approved Q&A JSON and approved wording as read-only. Held entries must remain excluded from matching and recommendations.
- Do not change product requirements to make tests pass. Flag ambiguous rules for owner review.
- Do not deploy, push to GitHub, or commit during this test run.
- Keep the floating chatbot on the Live Demo page only. Do not add an Export JSON button to the homepage banner.
- Confirm supported file formats from the implementation; do not assume XLS/XLSX is supported just because CSV is supported.

## 2. Preparation

1. Inspect the repository and identify the real entry page, Live Demo page, upload/parser code, five agent implementations, chatbot files, approved Q&A JSON, and test runner.
2. Read the BRD and configured rules. Mark unspecified behaviors as `REQUIREMENT UNCLEAR` rather than inventing expected behavior.
3. Create fixtures in the existing test-fixture directory if available.
4. Run existing tests before changes to establish a baseline.
5. Save baseline output and review `git diff`; do not overwrite approved files.

## 3. Synthetic edge-case fixtures

Create individual fixtures where practical. These are synthetic examples, not real people.

### EC-DATA-01 — Empty file
A zero-byte file.

**Expected:** Show a clear “file is empty” or equivalent error; no crash and no false success.

### EC-DATA-02 — Header-only CSV

```csv
Customer ID,First Name,Last Name,City,Email
```

**Expected:** Report zero data rows or explain that no records were found. Do not invent records.

### EC-DATA-03 — Blank rows and whitespace-only cells

```csv
Customer ID,First Name,Last Name,City,Email
C001,Asha,Rao,Newark,asha@example.test
,,,,
C002,   ,Shah, Secaucus ,dev@example.test
C003,Mina,Lee,,mina@example.test
```

**Expected:** Blank rows and whitespace-only cells are handled consistently with documented rules. Missing values are not silently converted to valid data. Trimming occurs only under explicit normalization rules.

### EC-DATA-04 — Missing, reordered, and extra headers

```csv
Email,City,Customer ID,Unexpected Field
asha@example.test,Newark,C001,extra
dev@example.test,Secaucus,C002,extra2
```

**Expected:** Column order does not corrupt mapping. Extra columns are preserved or explicitly reported. Missing required columns are identified; no field is guessed without appropriate review.

### EC-DATA-05 — Duplicate headers

```csv
Customer ID,City,City,Email
C001,Newark,New York,asha@example.test
```

**Expected:** Duplicate-header ambiguity is surfaced. The app does not silently choose the wrong City column.

### EC-DATA-06 — Duplicate identifiers and duplicate rows

```csv
Customer ID,First Name,Last Name,City,Email
C001,Asha,Rao,Newark,asha@example.test
C001,Asha,Rao,Newark,asha@example.test
C001,Asha,Rao,Secaucus,asha2@example.test
C002,Dev,Shah,Newark,dev@example.test
```

**Expected:** Exact duplicate rows and conflicting duplicate IDs are identified according to documented rules. No record is silently merged or deleted. Conflicting duplicates remain reviewable.

### EC-DATA-07 — Invalid and unusual values

```csv
Customer ID,First Name,Last Name,City,Email,Phone
C001,Asha,Rao,Newark,asha@example.test,555-0101
C002,Dev,Shah,Secaucus,not-an-email,abc
C003,Mina,Lee,New York,,555-0103
C004,Noah,Patel,,noah@example.test,555-0104
C005,Ira,Das,Newark,ira@example.test,555-0105
```

**Expected:** Validation follows configured rules; missing, malformed, and optional values are classified correctly. Do not assume a field is required unless the BRD/configuration says so.

### EC-DATA-08 — CSV quoting, commas, and embedded newlines

```csv
Customer ID,First Name,Last Name,City,Notes
C001,"Asha, Jr.",Rao,Newark,"Customer requested ""email only"""
C002,Dev,Shah,Secaucus,"First line
second line"
```

**Expected:** A compliant parser preserves field boundaries, embedded commas, escaped quotes, and quoted newlines. If unsupported, show a clear error rather than silently shifting columns.

### EC-DATA-09 — Unicode and international text

```csv
Customer ID,First Name,Last Name,City,Email
C001,José,García,Newark,jose@example.test
C002,李,王,New York,li@example.test
C003,Zoë,O’Neil,Secaucus,zoe@example.test
C004,Élodie,Martin,Montréal,elodie@example.test
```

**Expected:** Text renders and exports without character loss. Unicode is not stripped or transliterated unless an explicit rule requires it.

### EC-DATA-10 — Encoding and BOM
Test UTF-8 with BOM and, if supported, a separately prepared alternate-encoding file.

**Expected:** Supported encodings parse correctly. Unsupported encoding produces a useful message; the first header must not unexpectedly contain a BOM character.

### EC-DATA-11 — Extreme lengths and control characters
Use synthetic values containing a very long name/notes field, tabs, spaces, valid embedded line breaks, and harmless control characters in a dedicated fixture.

**Expected:** UI remains usable, values render as text, and parsing does not crash. Do not inject executable markup into the app.

### EC-DATA-12 — Formula-like spreadsheet values
Include text values beginning with `=`, `+`, `-`, and `@` in a synthetic export fixture.

**Expected:** Review CSV export behavior for spreadsheet formula injection. Dangerous values are handled according to a documented safe-export policy without corrupting normal data.

### EC-DATA-13 — Large inputs and resource limits
Create synthetic files with increasing row counts, such as 1,000, 10,000, and a larger size appropriate to the intended use.

**Expected:** The app remains responsive within documented limits, reports limits clearly, and avoids freezing or exhausting browser memory. Record file size, row count, browser, and observed processing time. Do not invent a performance target.

### EC-DATA-14 — Unsupported, renamed, or corrupt files
Test a `.txt` file, a corrupt file with a `.csv` extension, and unsupported formats.

**Expected:** Validate file type/content as appropriate, provide a helpful error, and never show success for a file that was not parsed.

## 4. Five-agent edge cases

### Profile Agent
- Empty/header-only input.
- Duplicate headers and mixed data types in a column.
- Mostly empty columns.
- Numeric-looking identifiers with leading zeros, such as `000123`.
- High-cardinality columns and unusually long values.

**Expected:** Counts and profiles are accurate; identifiers retain leading zeros where required; uncertain types are not destructively coerced.

### Mapping Agent
- Missing required target field.
- Two possible source columns for one target.
- Header casing, punctuation, and whitespace variations.
- Unexpected extra fields.
- No plausible source for a required field.

**Expected:** Suggestions are explainable; ambiguity requires review; no confident mapping is fabricated.

### Normalization Agent
- Null, empty string, whitespace-only string, and literal `NULL`/`N/A`.
- Mixed case and accented characters.
- Phone numbers with punctuation or country codes.
- Ambiguous dates such as `03/04/2025`.
- IDs with leading zeros.
- Repeated normalization of already-normalized values.

**Expected:** Only explicit rules are applied. Ambiguous dates are not guessed. Required identifiers are preserved. Rules intended to be idempotent produce the same result when repeated.

### Validation Agent
- Missing required values.
- Invalid email/phone/date formats.
- Boundary values and unexpected data types.
- Conflicting cross-field values.
- Duplicate identifiers.
- All-valid and all-invalid input.

**Expected:** Findings match configured rules; each failure has a useful reason; no unconfigured rule is enforced.

### Exception Agent
- One record with several validation issues.
- Multiple records with the same issue.
- Conflict that cannot be resolved automatically.
- Empty exception set.
- Exception export or reprocessing, if supported.

**Expected:** Issues are not lost or unexpectedly duplicated; reasons are visible; ambiguous records remain for human review; empty states are clear.

## 5. Chatbot and Q&A edge cases

| ID | Scenario | Expected behavior |
|---|---|---|
| EC-CHAT-01 | Approved matching question with extra spaces | Matching follows defined rules without changing approved wording |
| EC-CHAT-02 | Case variation in question | Match only if intended by matching rules |
| EC-CHAT-03 | Punctuation variation | Correct match or safe fallback |
| EC-CHAT-04 | Near-match or ambiguous question | Ask for clarification or use safe fallback |
| EC-CHAT-05 | Empty/whitespace-only message | No crash; prompt for a question |
| EC-CHAT-06 | Very long message | Graceful handling within documented limits |
| EC-CHAT-07 | Unmatched question | Safe fallback; no fabricated facts |
| EC-CHAT-08 | Missing Q&A JSON | Clear error/fallback; no uncaught exception |
| EC-CHAT-09 | Malformed Q&A JSON | Clear error/fallback; no made-up substitute entries |
| EC-CHAT-10 | Q&A entry missing fields or wrong types | Invalid entry handled safely and flagged for review |
| EC-CHAT-11 | Held patient/PHI or BRD-review entry | Remains excluded from matching and recommendations |
| EC-CHAT-12 | Duplicate eligible Q&A entries | Deterministic behavior; no confusing duplicate suggestions |
| EC-CHAT-13 | Empty recommendations list | Clean empty state; no fabricated suggestions |
| EC-CHAT-14 | Rapid repeated messages | Responses do not cross-contaminate or appear against the wrong question |
| EC-CHAT-15 | Close and reopen chatbot | UI and state behave consistently with requirements |
| EC-CHAT-16 | Keyboard-only use | Open, navigate, submit, and close with keyboard; focus remains visible |
| EC-CHAT-17 | JSON/network request failure | Recoverable error; retry only if implemented |
| EC-CHAT-18 | Location question without uploaded file | Prompt for upload; no invented count |
| EC-CHAT-19 | Missing/ambiguous location column | Explain limitation or request column selection |
| EC-CHAT-20 | Exact, case-varied, and zero-match city | Count from active file using documented matching rules |
| EC-CHAT-21 | Replace file, ask same location question | Count updates; no stale cached answer |
| EC-CHAT-22 | Held question resembles an approved question | Held content is not exposed through matching, recommendations, or fallback |

Location-count tests are `NOT IMPLEMENTED` if the feature does not exist; do not treat them as passing.

## 6. Workflow and state edge cases

- Upload a second file while a first file is loaded.
- Cancel or replace file selection.
- Trigger processing before upload completes.
- Navigate away and return to Live Demo.
- Attempt export before processing.
- Process an empty dataset.
- Cause a parsing/validation error, then upload a valid file.
- Repeat the same workflow twice.
- Refresh during or after a workflow.

**Expected:** State resets or persists according to requirements; old data is not mixed into new results; controls do not get stuck; errors can be recovered from without reloading unless documented.

## 7. Export and privacy edge cases

- Export empty, valid, and invalid/review datasets.
- Compare exported row counts and columns with on-screen results.
- Check Unicode, commas, quotes, and newlines after export.
- Test formula-like values from EC-DATA-12.
- Check for unexpected record deletion or silent duplicate merging.
- Inspect browser Network requests during upload, profiling, chat, and export.
- Confirm uploaded data is not sent to unapproved external services.
- Ensure errors/logs do not expose full uploaded records unnecessarily.

**Expected:** Exports match intended output and safely represent values. Exclusions are documented and explainable.

## 8. Browser and accessibility edge cases

Run locally in a real browser:
- Desktop and narrow/mobile viewports.
- Keyboard-only navigation using Tab, Shift+Tab, Enter, Space, and Escape where appropriate.
- Visible focus and sensible focus return after closing the chatbot.
- Long labels, large error messages, empty states, and large tables.
- Browser refresh and direct navigation to each page.
- Missing JSON request and network-disabled behavior.
- Console and Network panel inspection.

Do not report browser verification as passed if no browser was exercised.

## 9. Automation guidance

Inspect project scripts before choosing commands. Run only commands that match files actually present.

Example syntax checks:

```bash
node --check demo.js
node --check demo-chat.js
node --check chat-core.js
node --check demo-core.js
```

Use the configured test runner. If none exists, propose a minimal compatible setup before adding dependencies. Prefer unit tests for parsing, mapping, normalization, validation, exception classification, chatbot filtering, and location-count logic. Record exact commands and exit codes.

## 10. Defect severity guide

- **Critical:** Data exposure, cross-file contamination, major data loss, fabricated counts presented as fact, or core workflow unusable.
- **High:** Incorrect mapping/normalization/validation that may corrupt data; held Q&A exposed; exports materially differ from results.
- **Medium:** Recoverable feature failure, incorrect error handling, broken navigation, or inaccessible important control.
- **Low:** Minor visual issue that does not block the workflow.

For each defect, record reproduction steps, expected versus actual behavior, evidence, severity, and the smallest safe fix.

## 11. Results log

| Test ID | Status | Steps/command | Expected | Actual/evidence | Severity/notes |
|---|---|---|---|---|---|
| EC-DATA-01 | NOT RUN | | | | |
| EC-DATA-05 | NOT RUN | | | | |
| EC-DATA-08 | NOT RUN | | | | |
| EC-DATA-12 | NOT RUN | | | | |
| EC-MAP-01 | NOT RUN | | | | |
| EC-NORM-01 | NOT RUN | | | | |
| EC-VAL-01 | NOT RUN | | | | |
| EC-EXC-01 | NOT RUN | | | | |
| EC-CHAT-09 | NOT RUN | | | | |
| EC-CHAT-11 | NOT RUN | | | | |
| EC-CHAT-20 | NOT RUN | | | | |
| EC-CHAT-21 | NOT RUN | | | | |
| EC-EXP-01 | NOT RUN | | | | |
| EC-SEC-01 | NOT RUN | | | | |

Allowed statuses: `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, `NOT IMPLEMENTED`.

## 12. Definition of done

- Every applicable critical/high edge case is run or explicitly marked blocked/not implemented.
- Automated results include exact commands and observed outcomes.
- Browser tests are verified manually where automation cannot exercise them.
- No held Q&A entry is exposed and approved wording remains unchanged.
- No unexplained record loss, fabricated results, stale cross-file counts, or unapproved external transfer occurs.
- Defects have severity, reproduction steps, evidence, and disposition.
- Final report separates verified behavior from assumptions, blocked tests, and remaining gaps.

## 13. Codex prompt

> Read `EDGE_CASE_TEST_PLAN.md` and inspect the actual repository before running tests. Identify existing test commands and run applicable edge-case tests using synthetic fixtures only. Do not change approved Q&A JSON, expose held entries, deploy, push, or commit. Do not invent test results. Fix only reproducible defects within approved scope and rerun relevant tests. Report each test ID with status, exact command or steps, expected and actual result, evidence, severity, files changed, and browser checks still required. Mark absent features as `NOT IMPLEMENTED`; mark environment restrictions as `BLOCKED`; never describe unrun tests as passed.
