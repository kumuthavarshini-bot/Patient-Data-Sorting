const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const importer = require("../spreadsheet-importer.js");
const core = require("../demo-core.js");

function workbookBytes(sheets, bookType = "xlsx") {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(workbook, { type: "buffer", bookType });
}
function bytesAsFile(fileName, bytes, size) { return importer.openBytes(fileName, bytes, size == null ? bytes.byteLength : size); }

test("imports CSV, TSV, and TXT with header selection, preserved source rows, and visible irregular-row warnings", () => {
  const csv = bytesAsFile("synthetic.csv", Buffer.from("Report title\n\nCustomer ID,City\n00123,Newark\nC2,Secaucus,extra\n", "utf8"), undefined);
  const table = importer.parseContext(csv.context, { headerRow: 3, delimiter: "," });
  assert.deepEqual(table.headers, ["Customer ID", "City", "Column 3"]);
  assert.deepEqual(table.rows, [["00123", "Newark", ""], ["C2", "Secaucus", "extra"]]);
  assert.deepEqual(table.sourceRows, [4, 5]);
  assert.match(table.warnings.join(" "), /extra columns were retained/);

  const tsv = bytesAsFile("synthetic.tsv", Buffer.from("Customer ID\tCity\nC1\tNewark\n", "utf8"));
  assert.equal(tsv.table.delimiter, "\t");
  assert.deepEqual(tsv.table.rows, [["C1", "Newark"]]);

  const txt = bytesAsFile("synthetic.txt", Buffer.from("Customer ID;City\nC2;Edison\n", "utf8"));
  assert.equal(txt.table.delimiter, ";");
  assert.equal(importer.parseContext(txt.context, { headerRow: 1, delimiter: ";" }).rows[0][1], "Edison");
});

test("imports an XLSX workbook, exposes worksheets, selects a sheet/header, and preserves formatted identifiers", () => {
  const data = workbookBytes({
    Empty: [],
    Customers: [["Export generated"], ["Customer ID", "City", "Extra", "Extra"], ["", "", "", ""], ["00123", "Newark", "x", "y"], ["C2", "Secaucus", "", ""]]
  }, "xlsx");
  const opened = bytesAsFile("synthetic.xlsx", data);
  assert.deepEqual(opened.worksheetNames, ["Empty", "Customers"]);
  assert.equal(opened.table.selectedWorksheet, "Customers");
  const initial = importer.parseContext(opened.context, { sheetName: "Customers", headerRow: 2 });
  assert.equal(initial.headerRow, 2);
  const selected = initial;
  assert.deepEqual(selected.headers, ["Customer ID", "City", "Extra", "Extra (2)"]);
  assert.deepEqual(selected.rows[0], ["", "", "", ""]);
  assert.equal(selected.rows[1][0], "00123");
  assert.equal(selected.sourceRows[1], 4);
  assert.match(selected.warnings.join(" "), /Duplicate header/);
  assert.match(selected.warnings.join(" "), /blank row/);
});

test("imports XLS, ODS, and macro-enabled XLSM data without executing macros", () => {
  for (const [extension, bookType] of [["xls", "xls"], ["ods", "ods"], ["xlsm", "xlsm"]]) {
    const bytes = workbookBytes({ Customers: [["Customer ID", "City"], ["C1", "Newark"]] }, bookType);
    const opened = bytesAsFile(`synthetic.${extension}`, bytes);
    assert.deepEqual(opened.table.rows, [["C1", "Newark"]], extension);
    if (extension === "xlsm") assert.match(opened.table.warnings.join(" "), /Macros and embedded scripts are not executed/);
  }
});

test("formula values use cached results only and warn when caches are missing", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["Customer ID", "Calculated"], ["C1", ""]]);
  sheet.B2 = { t: "n", f: "1+1", v: 2 };
  sheet.C2 = { t: "n", f: "2+2" };
  sheet["!ref"] = "A1:C2";
  XLSX.utils.book_append_sheet(workbook, sheet, "Customers");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const parsed = bytesAsFile("formula.xlsx", bytes).table;
  assert.equal(parsed.rows[0][1], "2");
  assert.equal(parsed.rows[0][2], "");
  assert.match(parsed.warnings.join(" "), /2 formula cell\(s\) were found/);
  assert.match(parsed.warnings.join(" "), /1 formula cell\(s\) have no cached result/);
});

test("preserves row references through the existing Customer ID and location pipeline", () => {
  const bytes = workbookBytes({ Customers: [["Customer ID", "Customer City"], [" C1 ", " Newark "], ["C2", "Secaucus"]] }, "xlsx");
  const table = bytesAsFile("synthetic.xlsx", bytes).table;
  const records = core.processRows(table.headers, table.rows, { customer_id: "Customer ID" }, table.sourceRows);
  const location = core.filterRecords(records, [{ column: "Customer City", value: "newark" }]);
  assert.deepEqual(location.matched.map((row) => row.rowNumber), [2]);
  assert.equal(location.matched[0].values[0], " C1 ");
});

test("rejects unsupported, mismatched, malformed, empty, and oversized files with actionable errors", () => {
  assert.throws(() => bytesAsFile("synthetic.pdf", Buffer.from("not a spreadsheet")), { code: "UNSUPPORTED_FORMAT" });
  assert.throws(() => bytesAsFile("renamed.xlsx", Buffer.from("Customer ID,City\nC1,Newark")), { code: "CONTENT_MISMATCH" });
  assert.throws(() => bytesAsFile("broken.csv", Buffer.from('Customer ID,City\nC1,"unterminated')), /not closed/);
  assert.throws(() => bytesAsFile("empty.csv", Buffer.alloc(0)), { code: "EMPTY_FILE" });
  assert.throws(() => bytesAsFile("large.csv", Buffer.from("x"), importer.MAX_FILE_BYTES + 1), { code: "FILE_TOO_LARGE" });
  assert.throws(() => bytesAsFile("bad.txt", Buffer.from([0xff, 0xfe, 0xfd])), { code: "INVALID_ENCODING" });
});

test("allows worksheet selection and reports a selected empty worksheet without dropping the workbook", () => {
  const bytes = workbookBytes({ Empty: [], Customers: [["Customer ID"], ["C1"]] });
  const opened = bytesAsFile("synthetic.xlsx", bytes);
  assert.throws(() => importer.parseContext(opened.context, { sheetName: "Empty", headerRow: 1 }), { code: "EMPTY_WORKSHEET" });
  assert.equal(importer.parseContext(opened.context, { sheetName: "Customers", headerRow: 1 }).rows[0][0], "C1");
});
