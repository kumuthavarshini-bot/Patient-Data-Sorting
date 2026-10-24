(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(() => require("xlsx"), require("./demo-core.js"));
  else root.CdcImporter = factory(() => root.XLSX, root.CdcCore);
})(typeof globalThis !== "undefined" ? globalThis : this, function (getXlsx, core) {
  "use strict";

  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const TEXT_FORMATS = new Set(["csv", "tsv", "txt"]);
  const WORKBOOK_FORMATS = new Set(["xlsx", "xls", "xlsm", "ods"]);

  class ImportError extends Error {
    constructor(code, message) { super(message); this.name = "ImportError"; this.code = code; }
  }

  function extensionOf(fileName) {
    const match = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }
  function asBytes(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    throw new ImportError("INVALID_BYTES", "The selected file could not be read. Choose it again and retry.");
  }
  function signature(bytes) {
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2]) && [0x04, 0x06, 0x08].includes(bytes[3])) return "zip";
    if (bytes.length >= 8 && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, index) => bytes[index] === byte)) return "ole";
    return "text";
  }
  function assertFormatContent(extension, bytes) {
    const type = signature(bytes);
    if (TEXT_FORMATS.has(extension)) {
      if (type !== "text" || bytes.subarray(0, Math.min(bytes.length, 4096)).includes(0)) throw new ImportError("CONTENT_MISMATCH", `The .${extension} file does not contain valid delimited text. Check the file format and try again.`);
      return;
    }
    if (extension === "xls" && type !== "ole") throw new ImportError("CONTENT_MISMATCH", "This .xls file does not have the expected Excel binary signature. It may be renamed or damaged.");
    if (["xlsx", "xlsm", "ods"].includes(extension) && type !== "zip") throw new ImportError("CONTENT_MISMATCH", `This .${extension} file does not have the expected workbook signature. It may be renamed or damaged.`);
  }
  function uniqueHeaders(rawHeaders) {
    const seen = new Map();
    const originalHeaders = rawHeaders.map((value) => String(value == null ? "" : value));
    const headers = originalHeaders.map((raw, index) => {
      const base = raw.trim() || `Column ${index + 1}`;
      const normalized = core.normalizeHeader(base) || `column ${index + 1}`;
      const count = (seen.get(normalized) || 0) + 1;
      seen.set(normalized, count);
      if (count === 1) return base;
      return `${base} (${count})`;
    });
    return { headers, originalHeaders };
  }
  function makeTable({ grid, sourceRows, fileName, format, sheetName = "", worksheetNames = [], headerRow = 0, delimiter = "", warnings = [], metadata = {} }) {
    if (!Array.isArray(grid) || grid.length === 0) throw new ImportError("EMPTY_DATA", "The selected file or worksheet is empty. Choose a worksheet with tabular data.");
    let headerIndex = Number.isInteger(Number(headerRow)) && Number(headerRow) > 0 ? Number(headerRow) - 1 : -1;
    if (headerIndex < 0) headerIndex = grid.findIndex((row) => Array.isArray(row) && row.some((value) => String(value == null ? "" : value).trim() !== ""));
    if (headerIndex < 0 || headerIndex >= grid.length) throw new ImportError("INVALID_HEADER_ROW", "The selected header row is outside the worksheet. Choose a row containing column names.");
    const rawHeader = Array.isArray(grid[headerIndex]) ? grid[headerIndex] : [];
    const body = grid.slice(headerIndex + 1).map((row) => Array.isArray(row) ? row : []);
    let width = Math.max(rawHeader.length, ...body.map((row) => row.length));
    if (!width) throw new ImportError("EMPTY_HEADER", "No columns were found. Select a row that contains column headers.");
    const expandedHeaders = rawHeader.slice();
    while (expandedHeaders.length < width) expandedHeaders.push("");
    const { headers, originalHeaders } = uniqueHeaders(expandedHeaders);
    const notices = [...warnings];
    if (headerIndex > 0) notices.push(`Rows 1–${headerIndex} above the selected header row were not treated as records.`);
    const seen = new Map();
    originalHeaders.forEach((raw, index) => {
      const key = core.normalizeHeader(raw);
      if (!raw.trim()) notices.push(`Blank header at column ${index + 1} was named “${headers[index]}” so the source column remains available.`);
      else if (key && seen.has(key)) notices.push(`Duplicate header “${raw}” at column ${index + 1} was named “${headers[index]}” to keep both columns addressable.`);
      if (key) seen.set(key, true);
    });
    const rows = [], rowNumbers = [];
    let irregular = 0, blankRows = 0;
    body.forEach((sourceRow, index) => {
      if (sourceRow.length !== width) irregular++;
      if (sourceRow.every((value) => value == null || String(value).trim() === "")) blankRows++;
      const padded = Array.from({ length: width }, (_, column) => sourceRow[column] == null ? "" : String(sourceRow[column]));
      rows.push(padded);
      rowNumbers.push(sourceRows && Number.isFinite(sourceRows[headerIndex + index + 1]) ? sourceRows[headerIndex + index + 1] : headerIndex + index + 2);
    });
    if (irregular) notices.push(`${irregular} row(s) had a different number of cells than the widest row; blank cells were padded and all extra columns were retained.`);
    if (blankRows) notices.push(`${blankRows} blank row(s) in the selected data range were retained for review.`);
    if (!rows.length) throw new ImportError("NO_RECORDS", "The selected header row has no records beneath it.");
    return {
      sourceFileName: fileName,
      detectedFormat: format,
      selectedWorksheet: sheetName,
      worksheetNames: [...worksheetNames],
      headers,
      originalHeaders,
      rows,
      sourceRows: rowNumbers,
      headerRow: headerIndex + 1,
      delimiter,
      warnings: [...new Set(notices)],
      metadata: { ...metadata, rowCount: rows.length, columnCount: headers.length, headerRow: headerIndex + 1, delimiter }
    };
  }
  function parseText(context, options = {}) {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text;
    try { text = decoder.decode(context.bytes).replace(/^\uFEFF/, ""); }
    catch { throw new ImportError("INVALID_ENCODING", "This text file is not valid UTF-8. Save it as UTF-8 delimited text and try again."); }
    if (!text.trim()) throw new ImportError("EMPTY_FILE", "The selected file is empty.");
    if (text.includes("\u0000")) throw new ImportError("INVALID_TEXT", "The selected text file contains binary data. Choose a CSV, TSV, or plain-text delimited file.");
    const delimiterChoice = options.delimiter || (context.extension === "tsv" ? "\t" : "auto");
    const delimiter = delimiterChoice === "auto" ? core.detectDelimiter(text) : delimiterChoice;
    const parsed = core.parseDelimited(text, delimiter);
    return makeTable({
      grid: parsed.records,
      sourceRows: parsed.sourceLines,
      fileName: context.fileName,
      format: context.extension,
      headerRow: options.headerRow || 0,
      delimiter,
      warnings: [],
      metadata: { encoding: "UTF-8", physicalLineCount: text.split(/\r\n|\r|\n/).length }
    });
  }
  function worksheetWarnings(workbook, worksheet) {
    const warnings = [];
    const merges = worksheet["!merges"] || [];
    if (merges.length) warnings.push(`${merges.length} merged cell range(s) were found. Only cell values are imported; merged-cell layout is not preserved.`);
    const hiddenRows = (worksheet["!rows"] || []).filter((row) => row && row.hidden).length;
    const hiddenColumns = (worksheet["!cols"] || []).filter((column) => column && column.hidden).length;
    if (hiddenRows || hiddenColumns) warnings.push(`Hidden worksheet content is included (${hiddenRows} hidden row(s), ${hiddenColumns} hidden column(s)).`);
    let formulaCount = 0, formulasWithoutCachedValue = 0;
    Object.keys(worksheet).forEach((address) => {
      if (address[0] === "!") return;
      const cell = worksheet[address];
      if (!cell || !cell.f) return;
      formulaCount++;
      if (cell.v == null || cell.v === "") formulasWithoutCachedValue++;
    });
    if (formulaCount) warnings.push(`${formulaCount} formula cell(s) were found. Formulas are not evaluated; cached values are imported when present.`);
    if (formulasWithoutCachedValue) warnings.push(`${formulasWithoutCachedValue} formula cell(s) have no cached result and will appear blank.`);
    if (workbook && workbook.Workbook && workbook.Workbook.Sheets) {
      const metadata = workbook.Workbook.Sheets.find((sheet) => sheet.name === worksheetNameFor(workbook, worksheet));
      if (metadata && metadata.Hidden) warnings.push("The selected worksheet is hidden; its cell values are still included because it was explicitly selected.");
    }
    return { warnings, formulaCount, formulasWithoutCachedValue, mergeCount: merges.length, hiddenRows, hiddenColumns };
  }
  function worksheetNameFor(workbook, worksheet) {
    return workbook.SheetNames.find((name) => workbook.Sheets[name] === worksheet) || "";
  }
  function parseWorkbook(context, options = {}) {
    const workbook = context.workbook;
    const worksheetNames = [...(workbook.SheetNames || [])];
    if (!worksheetNames.length) throw new ImportError("EMPTY_WORKBOOK", "No worksheets were found in this workbook.");
    const sheetName = options.sheetName || worksheetNames[0];
    if (!worksheetNames.includes(sheetName)) throw new ImportError("UNKNOWN_WORKSHEET", "The selected worksheet is not available in this workbook. Choose another worksheet.");
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet || !worksheet["!ref"]) throw new ImportError("EMPTY_WORKSHEET", `Worksheet “${sheetName}” is empty. Choose a worksheet with tabular data.`);
    const XLSX = getXlsx();
    const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "", blankrows: true, dateNF: "yyyy-mm-dd" });
    const details = worksheetWarnings(workbook, worksheet);
    const formatWarnings = [...details.warnings];
    if (context.extension === "xlsm") formatWarnings.push("Macro-enabled workbook imported as cell data only. Macros and embedded scripts are not executed.");
    if (context.extension === "ods") formatWarnings.push("ODS formatting, formulas, and workbook-specific features are not preserved; imported values are read-only.");
    return makeTable({
      grid,
      fileName: context.fileName,
      format: context.extension,
      sheetName,
      worksheetNames,
      headerRow: options.headerRow || 0,
      warnings: formatWarnings,
      metadata: { workbookType: workbook.bookType || context.extension, ...details }
    });
  }
  function openBytes(fileName, input, fileSize = null) {
    const extension = extensionOf(fileName);
    if (!TEXT_FORMATS.has(extension) && !WORKBOOK_FORMATS.has(extension)) throw new ImportError("UNSUPPORTED_FORMAT", "Unsupported file type. Choose .csv, .tsv, .txt, .xlsx, .xls, .xlsm, or .ods.");
    const bytes = asBytes(input);
    const size = fileSize == null ? bytes.byteLength : fileSize;
    if (size > MAX_FILE_BYTES) throw new ImportError("FILE_TOO_LARGE", `This file is larger than the 25 MiB prototype limit. Split it into smaller files and try again.`);
    if (!bytes.length) throw new ImportError("EMPTY_FILE", "The selected file is empty.");
    assertFormatContent(extension, bytes);
    const context = { fileName: String(fileName), extension, fileSize: size, bytes };
    if (TEXT_FORMATS.has(extension)) {
      const table = parseText(context);
      return { context, table, worksheetNames: [], format: extension };
    }
    const XLSX = getXlsx();
    if (!XLSX || typeof XLSX.read !== "function") throw new ImportError("PARSER_UNAVAILABLE", "The spreadsheet parser did not load. Reload the demo while connected to the local app server and try again.");
    let workbook;
    try {
      workbook = XLSX.read(bytes, { type: "array", cellFormula: true, cellNF: true, cellText: true, cellDates: false, bookVBA: false, bookDeps: false, bookFiles: false });
    } catch (error) {
      throw new ImportError("MALFORMED_WORKBOOK", `The workbook could not be parsed. Check that it is a valid, unencrypted .${extension} file${error && error.message ? ` (${error.message})` : ""}.`);
    }
    const actualType = workbook.bookType;
    if (extension === "ods" && actualType && actualType !== "ods") throw new ImportError("CONTENT_MISMATCH", "The file contents are not an OpenDocument spreadsheet as indicated by its .ods extension.");
    if (extension === "xlsx" && actualType === "ods") throw new ImportError("CONTENT_MISMATCH", "The file contents are an OpenDocument spreadsheet, not an .xlsx workbook.");
    context.workbook = workbook;
    const worksheetNames = [...(workbook.SheetNames || [])];
    if (!worksheetNames.length) return { context, table: null, worksheetNames, format: extension };
    const firstNonEmpty = worksheetNames.find((name) => workbook.Sheets[name] && workbook.Sheets[name]["!ref"]) || worksheetNames[0];
    let table = null;
    try { table = parseWorkbook(context, { sheetName: firstNonEmpty }); } catch { /* Keep the workbook available so the user can select another worksheet. */ }
    return { context, table, worksheetNames, format: extension };
  }
  function parseContext(context, options = {}) {
    return TEXT_FORMATS.has(context.extension) ? parseText(context, options) : parseWorkbook(context, options);
  }

  return { MAX_FILE_BYTES, ImportError, openBytes, parseContext, uniqueHeaders };
});
