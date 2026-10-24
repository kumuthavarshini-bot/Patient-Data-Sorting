# Spreadsheet import — audit and implementation notes

## Baseline audit (before implementation)

The application is a static, browser-local HTML/CSS/JavaScript site. `demo.html` provides the Live Demo upload controls, `demo.js` reads a selected `File`, and `demo-core.js` contains the shared parser, mapping, profiling support, filtering, validation, and report logic. The current upload path rejects anything other than `.csv`, decodes UTF-8 text, and calls `CdcCore.parseCsv()`. That parser assumes the first parsed record is a unique, nonblank header row. The rest of the workflow consumes `headers`, `rows`, and source row numbers; report generation preserves original source values.

`package.json` has build, test, and local server scripts, but no dependencies or lockfile were present during the audit. The static build explicitly copies the app's HTML and JavaScript files into `dist/`. CSV outputs and validation/exception/summary reports are generated in `demo.js`. Location filters operate on the current parsed row arrays. The browser page does not call the five CLI orchestration agents; the web demo uses the shared deterministic `CdcCore` processing path. The separate CLI orchestration remains unchanged by the import adapter.

The CSV-only assumption appeared in the upload `accept` attribute and helper text in `demo.html`, plus extension/MIME checks and UTF-8 decoding in `demo.js`. Existing product requirements do not specify a maximum upload size, spreadsheet date policy, or formula behavior. These remain explicitly scoped prototype choices below and are not promoted as approved production data rules.

## Implementation contract

The importer will normalize accepted input into one table shape used by the existing pipeline: original filename, detected format, selected worksheet when relevant, unique safe headers, row values, source row references, warnings, and parsing metadata. CSV continues to use the existing strict parser behavior unless a user-selected header row or blank rows require importer-level tabular parsing. TSV and delimited text use deterministic delimiter parsing. Spreadsheet parsing uses a locally bundled SheetJS Community Edition build; workbook bytes and records stay in the browser.

Formats are enabled only when the relevant parser and tests are included. Excel workbook selection is explicit and single-sheet; sheets are never combined automatically. Header-row selection is 1-based. Duplicate and blank header labels are retained in warnings and given unique internal names so every source column remains addressable. Source row references are retained for validation and exception reports.

Excel formulas are never evaluated. The parser reads cached values only; formulas with no cached result become blank values and are reported as warnings. Dates are represented using the parser's formatted display text and are not guessed or converted into another locale. Macro-enabled workbooks are parsed as data only; macros and external links are not executed. Formatting, merged-cell geometry, hidden-row state, comments, and workbook behavior are not preserved in row-oriented exports. Merged ranges and hidden rows are surfaced as warnings when discoverable.

Until a production limit is approved, the prototype will enforce a documented 25 MiB file-size ceiling to bound browser memory use. This is a protective implementation limit, not a BRD requirement or a tested browser-performance guarantee. Parsing is synchronous in the current static architecture; progress is surfaced before parsing, but this does not guarantee that large workbooks will remain responsive. Do not use real or sensitive customer data in this prototype.

Existing CSV downloads and reports remain. XLSX export is not enabled unless it is implemented and covered by tests. The original uploaded file is never modified or overwritten.

## Status

This file begins with the audit findings required before implementation. Update the implementation, test results, package/library version, and remaining limitations after changes and verification are complete.
