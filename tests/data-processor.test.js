const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../demo-core.js");

test("parses quoted commas, escaped quotes, embedded newlines, and CRLF", () => {
  const parsed = core.parseCsv('Customer ID,Name,Notes\r\nC1,"Doe, Jane","said ""hello"""\r\nC2,Lee,"line one\nline two"\r\n');
  assert.equal(parsed.delimiter, ",");
  assert.deepEqual(parsed.headers, ["Customer ID", "Name", "Notes"]);
  assert.deepEqual(parsed.rows, [["C1", "Doe, Jane", 'said "hello"'], ["C2", "Lee", "line one\nline two"]]);
  assert.deepEqual(parsed.sourceRows, [2, 3]);
});

test("detects semicolon and tab delimiters", () => {
  assert.equal(core.parseCsv("id;email\nA; a@example.com").delimiter, ";");
  assert.equal(core.parseCsv("id\temail\nA\ta@example.com").delimiter, "\t");
});

test("counts uploaded CSV locations with case-insensitive whitespace normalization", () => {
  const parsed = core.parseCsv("Customer ID,Customer City\nC1, Newark \nC2,NEWARK\nC3,New York");
  const result = core.countLocationRecords({ headers: parsed.headers, rows: parsed.rows }, "  newark  ");
  assert.deepEqual(result, { status: "count", count: 2, column: "Customer City" });
});

test("location counts return zero for exact non-matches without fuzzy matching", () => {
  const parsed = core.parseCsv("ID,City\n1,Newark\n2,New York");
  const result = core.countLocationRecords({ headers: parsed.headers, rows: parsed.rows }, "Newarks");
  assert.deepEqual(result, { status: "count", count: 0, column: "City" });
});

test("location counts use whichever uploaded dataset is current", () => {
  const first = core.parseCsv("ID,City\n1,Newark");
  const replacement = core.parseCsv("ID,Location\n2,Secaucus");
  assert.equal(core.countLocationRecords({ headers: first.headers, rows: first.rows }, "Newark").count, 1);
  assert.equal(core.countLocationRecords({ headers: replacement.headers, rows: replacement.rows }, "Newark").count, 0);
  assert.equal(core.countLocationRecords({ headers: replacement.headers, rows: replacement.rows }, "Secaucus").count, 1);
});

test("location counts report missing and ambiguous columns and absent uploads", () => {
  assert.equal(core.countLocationRecords(null, "Newark").status, "no_dataset");
  assert.equal(core.countLocationRecords({ headers: ["ID", "Name"], rows: [["1", "A"]] }, "Newark").status, "missing_column");
  assert.equal(core.countLocationRecords({ headers: ["City", "Location"], rows: [["Newark", "Newark"]] }, "Newark").status, "ambiguous_column");
});

test("malformed CSV input is rejected for location counting", () => {
  assert.throws(() => core.parseCsv('ID,City\n1,"Newark'), /not closed/);
});

test("rejects malformed quoting, duplicate headers, empty headers, and uneven rows", () => {
  assert.throws(() => core.parseCsv('id,name\n1,"open'), /not closed/);
  assert.throws(() => core.parseCsv("id,ID\n1,2"), /duplicate header/);
  assert.throws(() => core.parseCsv(",name\n1,Jane"), /non-empty header/);
  assert.throws(() => core.parseCsv("id,name\n1,Jane,extra"), /No rows were dropped/);
});

test("rejects processing when Customer ID has not been mapped", () => {
  assert.throws(() => core.processRows(["Name"], [["A"]], {}), /Customer ID/);
});

test("flags missing and every same-batch duplicate customer ID after trimming", () => {
  const result = core.processRows(["ID", "Name"], [[" x ", "A"], ["x", "B"], ["", "C"], ["Y", "D"]], { customer_id: "ID", full_name: "Name" }, [2, 4, 5, 6]);
  assert.deepEqual(result.map((row) => row.errors.map((error) => error.code)), [["BR-02"], ["BR-02"], ["BR-01"], []]);
  assert.match(result[0].errors[0].message, /all 2 conflicting rows/);
  assert.equal(result[0].canonical.customer_id, "x");
  assert.deepEqual(result.map((row) => row.rowNumber), [2, 4, 5, 6]);
});

test("preserves original cells while recording whitespace and email-case transformations", () => {
  const input = [[" C1 ", " A@Example.COM "]];
  const result = core.processRows(["ID", "Email"], input, { customer_id: "ID", email: "Email" });
  assert.deepEqual(input, [[" C1 ", " A@Example.COM "]]);
  assert.equal(result[0].values[0], " C1 ");
  assert.equal(result[0].values[1], " A@Example.COM ");
  assert.equal(result[0].canonical.customer_id, "C1");
  assert.equal(result[0].canonical.email, "a@example.com");
  assert.equal(result[0].changes.length, 3);
  assert.deepEqual(result[0].changes.map((change) => change.rule), ["whitespace trimming", "whitespace trimming", "email casing normalization"]);
  assert.equal(result[0].errors.length, 0);
});

test("does not use fuzzy names to mark records as duplicates", () => {
  const result = core.processRows(["ID", "Name"], [["C1", "Alex Kim"], ["C2", "Alex Kim"]], { customer_id: "ID", full_name: "Name" });
  assert.deepEqual(result.map((row) => row.errors), [[], []]);
});

test("quotes CSV values and neutralizes formula-like export cells", () => {
  assert.equal(core.csvEscape('a,"b"'), '"a,""b"""');
  assert.equal(core.csvEscape("=1+1"), '"\'=1+1"');
  assert.equal(core.csvEscape("  @SUM(A1:A2)"), '"\'  @SUM(A1:A2)"');
  assert.equal(core.csvEscape("-12.50"), '"-12.50"');
  assert.equal(core.csvEscape("-SUM(A1:A2)"), '"\'-SUM(A1:A2)"');
});

test("suggests exact, normalized, and heuristic Customer ID headers without choosing unrelated fields", () => {
  assert.deepEqual(core.suggestMapping(["Customer ID"], "customer_id"), { header: "Customer ID", kind: "exact", ambiguous: false, candidates: ["Customer ID"] });
  assert.equal(core.suggestMapping(["customer_id"], "customer_id").kind, "normalized");
  assert.equal(core.suggestMapping(["customerId"], "customer_id").header, "customerId");
  assert.deepEqual(core.suggestMapping(["Customer Number"], "customer_id"), { header: "Customer Number", kind: "heuristic", ambiguous: false, candidates: ["Customer Number"] });
  assert.equal(core.suggestMapping(["Client ID"], "customer_id").header, "Client ID");
  assert.equal(core.suggestMapping(["ID", "City", "Date of Birth"], "customer_id").header, "");
});

test("mapping evidence combines header and sampled value compatibility and flags wrong types", () => {
  const good = core.suggestMappingWithEvidence(["Email Address"], [["one@example.test"], ["two@example.test"]], "email");
  assert.equal(good.header, "Email Address");
  assert.equal(good.inferredType, "email");
  assert.equal(good.recommendable, true);
  assert.equal(good.confidence, "medium", "header aliases produce an uncalibrated suggestion, not a high-confidence claim");
  const wrong = core.suggestMappingWithEvidence(["Email"], [["Newark"], ["Secaucus"]], "email");
  assert.equal(wrong.recommendable, false);
  assert.match(wrong.rationale, /look like text\/mixed/i);
  const ambiguous = core.suggestMappingWithEvidence(["Customer ID", "Client ID"], [["C1", "C1"]], "customer_id");
  assert.equal(ambiguous.confidence, "low");
  assert.equal(ambiguous.header, "");
});

test("ambiguous identifier candidates require a manual choice and do not auto-select", () => {
  const suggestion = core.suggestMapping(["Customer ID", "Client ID", "Date of Birth"], "customer_id");
  assert.equal(suggestion.ambiguous, true);
  assert.deepEqual(suggestion.candidates, ["Customer ID", "Client ID"]);
  assert.equal(core.validateMappings(suggestion.candidates, {}).valid, false);
  assert.equal(core.validateMappings(suggestion.candidates, { customer_id: "Client ID" }).valid, true);
});

test("mapping validation rejects missing sources, unknown columns, and source reuse", () => {
  assert.equal(core.validateMappings(["Customer ID"], {}).errors[0].code, "MAPPING_REQUIRED");
  assert.equal(core.validateMappings(["Customer ID"], { customer_id: "Birth Date" }).errors[0].code, "MAPPING_SOURCE_MISSING");
  const duplicate = core.validateMappings(["Customer ID", "Email"], { customer_id: "Customer ID", email: "Customer ID" });
  assert.equal(duplicate.valid, false);
  assert.match(duplicate.errors[0].message, /multiple targets/);
  assert.equal(core.validateMappings(["Customer ID", "Name"], { customer_id: "Customer ID", full_name: "Name" }).valid, true);
});

test("processing readiness keeps the clean action disabled until a file and explicit valid ID mapping exist", () => {
  const headers = ["Customer ID", "Name"];
  assert.equal(core.processingReadiness({ hasFile: false, rowCount: 0, headers, mappings: { customer_id: "Customer ID" } }).enabled, false);
  assert.equal(core.processingReadiness({ hasFile: true, rowCount: 2, headers, mappings: {} }).enabled, false);
  assert.equal(core.processingReadiness({ hasFile: true, rowCount: 2, headers, mappings: { customer_id: "Customer ID", full_name: "Name" } }).enabled, true);
  assert.equal(core.processingReadiness({ hasFile: true, rowCount: 2, headers, mappings: { customer_id: "Customer ID", full_name: "Customer ID" } }).enabled, false);
  assert.equal(core.processingReadiness({ hasFile: true, rowCount: 2, headers, mappings: { customer_id: "Customer ID" }, processing: true }).enabled, false);
});

test("preserves blank physical records by rejecting malformed row widths instead of silently dropping them", () => {
  assert.throws(() => core.parseCsv("Customer ID,City\nC1,Newark\n\nC2,Secaucus"), /No rows were dropped/);
});

test("flags obviously malformed supplied emails for review without blocking optional fields", () => {
  const rows = core.processRows(["Customer ID", "Email"], [["C1", "person@example.test"], ["C2", "not-an-email"], ["C3", ""]], { customer_id: "Customer ID", email: "Email" });
  assert.deepEqual(rows.map((record) => record.status), ["valid", "needs_review", "valid"]);
  assert.deepEqual(rows[1].warnings.map((issue) => issue.code), ["BR-04"]);
  assert.equal(rows[1].errors.length, 0);
  assert.equal(rows[1].values[1], "not-an-email");
});

test("flags invalid or ambiguous mapped dates for review without inventing a conversion", () => {
  const rows = core.processRows(["Customer ID", "DOB"], [["C1", "2024-02-29"], ["C2", "2024-02-31"], ["C3", "01/02/2024"]], { customer_id: "Customer ID", date_of_birth: "DOB" });
  assert.deepEqual(rows.map((record) => record.status), ["valid", "needs_review", "needs_review"]);
  assert.equal(rows[1].warnings[0].code, "BR-05");
  assert.equal(rows[2].canonical.date_of_birth, "01/02/2024");
  assert.equal(rows[2].changes.some((change) => change.target === "date_of_birth"), false);
});

test("filters combine values on the same source column as alternatives and different columns as AND", () => {
  const parsed = core.parseCsv("Customer ID,City,Status\nC1,Newark,Active\nC2, Secaucus ,Active\nC3,NEW YORK,Inactive\nC4,Newark,Inactive");
  const records = core.processRows(parsed.headers, parsed.rows, { customer_id: "Customer ID" }, parsed.sourceRows);
  const filtered = core.filterRecords(records, [{ column: "City", value: " newark " }, { column: "City", value: "SECAUCUS" }, { column: "Status", value: "active" }]);
  assert.deepEqual(filtered.matched.map((record) => record.canonical.customer_id), ["C1", "C2"]);
  assert.equal(filtered.excluded.length, 2);
  assert.equal(core.filterRecords(records, []).matched.length, records.length);
  assert.equal(core.filterRecords(records, [{ column: "City", value: "No such city" }]).matched.length, 0);
});

test("missing-value filter selects blank source cells and composes with other columns", () => {
  const records = core.processRows(["Customer ID", "City", "Email"], [["C1", "Newark", ""], ["C2", "Newark", "person@example.test"], ["C3", "Secaucus", ""]], { customer_id: "Customer ID" });
  const filtered = core.filterRecords(records, [{ column: "Email", mode: "missing" }, { column: "City", value: "Newark" }]);
  assert.deepEqual(filtered.matched.map((record) => record.rowNumber), [2]);
  assert.deepEqual(filtered.excluded.map((record) => record.rowNumber), [3, 4]);
});

test("quality filters compose with column filters and support missing and duplicate IDs", () => {
  const parsed = core.parseCsv("Customer ID,City\nD1,Newark\nD1,Newark\n,Newark\nV1,Secaucus");
  const records = core.processRows(parsed.headers, parsed.rows, { customer_id: "Customer ID" }, parsed.sourceRows);
  assert.deepEqual(core.filterRecords(records, [], "duplicate_id").matched.map((r) => r.rowNumber), [2, 3]);
  assert.deepEqual(core.filterRecords(records, [], "missing_id").matched.map((r) => r.rowNumber), [4]);
  assert.deepEqual(core.filterRecords(records, [{ column: "City", value: "Newark" }], "invalid").matched.map((r) => r.rowNumber), [2, 3, 4]);
  assert.deepEqual(core.filterRecords(records, [], "valid").matched.map((r) => r.rowNumber), [5]);
});

test("validation and exception reports use real findings and exception output preserves source rows", () => {
  const records = core.processRows(["Customer ID", "Email"], [["C1", "bad"], ["", "ok@example.test"]], { customer_id: "Customer ID", email: "Email" }, [2, 3]);
  const validation = core.validationReport(records, [records[0]]);
  assert.deepEqual(validation.rows.map((row) => [row[0], row[1], row[6]]), [[2, "needs_review", "yes"], [3, "invalid", "no"]]);
  const exceptions = core.exceptionReport(records);
  assert.equal(exceptions.rows.length, 2);
  assert.equal(exceptions.rows[0][0], 2);
  assert.equal(exceptions.rows[0][2], "review");
  assert.equal(exceptions.rows[1][2], "blocking");
  assert.deepEqual(exceptions.headers.slice(-2), ["source:Customer ID", "source:Email"]);
  assert.deepEqual(exceptions.rows[0].slice(-2), ["C1", "bad"]);
  assert.deepEqual(exceptions.rows[1].slice(-2), ["", "ok@example.test"]);
});

test("processing summary reconciles statuses and filter exclusions and records applied configuration", () => {
  const parsed = core.parseCsv("Customer ID,City,Email\nC1,Newark,good@example.test\nC2,Secaucus,bad\nC1,Newark,other@example.test\n,Newark,ok@example.test");
  const records = core.processRows(parsed.headers, parsed.rows, { customer_id: "Customer ID", email: "Email" }, parsed.sourceRows);
  const selected = core.filterRecords(records, [{ column: "City", value: "Newark" }]);
  const summary = core.processingSummary({ runId: "synthetic-run", timestamp: "2026-01-01T00:00:00.000Z", sourceFileName: "synthetic.csv", records, filteredRecords: selected.matched, excludedRecords: selected.excluded, mappings: { customer_id: "Customer ID", email: "Email" }, filters: [{ column: "City", value: "Newark" }], qualityFilter: "all", outputFiles: { cleaned_dataset: "customer_data_cleaned.csv" } });
  assert.equal(summary.counts.input_rows, 4);
  assert.equal(summary.counts.valid_rows + summary.counts.needs_review_rows + summary.counts.invalid_rows, 4);
  assert.equal(summary.counts.filtered_rows + summary.counts.excluded_by_filters, 4);
  assert.equal(summary.counts.filtered_rows, 3);
  assert.equal(summary.counts.duplicate_identifier_rows, 2);
  assert.equal(summary.applied_mappings.customer_id, "Customer ID");
  assert.equal(summary.applied_filters[0].value, "Newark");
});
