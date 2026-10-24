(function (root) {
  "use strict";

  function normalizedHeader(value) {
    return String(value == null ? "" : value)
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }
  const CANONICAL_TARGETS = [
    { key: "customer_id", label: "Customer ID", required: true, primary: "customer id", normalized: ["customer id"], heuristic: ["customer number", "client id"] },
    { key: "full_name", label: "Name (illustrative, optional)", required: false, primary: "full name", normalized: ["full name"], heuristic: ["name", "customer name"] },
    { key: "email", label: "Email (illustrative, optional)", required: false, primary: "email", normalized: ["email"], heuristic: ["email address", "e mail"] },
    { key: "phone", label: "Phone (illustrative, optional)", required: false, primary: "phone", normalized: ["phone"], heuristic: ["phone number", "telephone", "mobile"] },
    { key: "address", label: "Address (illustrative, optional)", required: false, primary: "address", normalized: ["address"], heuristic: ["postal address"] },
    { key: "date_of_birth", label: "Date of birth (illustrative, optional)", required: false, primary: "date of birth", normalized: ["date of birth"], heuristic: ["dob", "birth date"] }
  ];
  const MAPPING_CONFIDENCE_THRESHOLDS = { high: 0.82, medium: 0.62 };
  function mappingTarget(key) { return CANONICAL_TARGETS.find((target) => target.key === key); }
  function suggestMapping(headers, targetKey) {
    const target = mappingTarget(targetKey);
    if (!target) return { header: "", kind: "none", ambiguous: false, candidates: [] };
    const matches = headers.flatMap((header) => {
      const normalized = normalizedHeader(header);
      if (target.normalized.includes(normalized)) return [{ header, kind: header.trim() === target.label ? "exact" : "normalized" }];
      if (target.heuristic.includes(normalized)) return [{ header, kind: "heuristic" }];
      return [];
    });
    if (matches.length !== 1) return { header: "", kind: matches.length > 1 ? "ambiguous" : "none", ambiguous: matches.length > 1, candidates: matches.map((match) => match.header) };
    return { header: matches[0].header, kind: matches[0].kind, ambiguous: false, candidates: [matches[0].header] };
  }
  function inferColumnType(values) {
    const sample = (values || []).map((value) => String(value == null ? "" : value).trim()).filter(Boolean).slice(0, 100);
    if (!sample.length) return "empty";
    const ratio = (test) => sample.filter(test).length / sample.length;
    if (ratio((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) >= 0.8) return "email";
    if (ratio((value) => /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$/.test(value)) >= 0.8) return "date";
    if (ratio((value) => /^[+\d() .-]+$/.test(value) && value.replace(/\D/g, "").length >= 7) >= 0.8) return "phone";
    if (sample.every((value) => /^-?\d+(\.\d+)?$/.test(value))) return "numeric";
    if (sample.every((value) => /^(true|false)$/i.test(value))) return "boolean";
    if (new Set(sample).size / sample.length >= 0.9 && sample.length >= 3) return "identifier/text";
    return "text/mixed";
  }
  function suggestMappingWithEvidence(headers, rows, targetKey) {
    const target = mappingTarget(targetKey);
    const headerSuggestion = suggestMapping(headers, targetKey);
    if (!target) return { ...headerSuggestion, confidence: "low", score: 0, rationale: "The target is not part of the configured schema.", inferredType: "unknown" };
    if (headerSuggestion.ambiguous) return { ...headerSuggestion, confidence: "low", score: 0, rationale: "Multiple headers match this target; choose manually.", inferredType: "unknown" };
    if (!headerSuggestion.header) return { ...headerSuggestion, confidence: "low", score: 0, rationale: "No recognized header or value pattern supports this target.", inferredType: "unknown" };
    const index = headers.indexOf(headerSuggestion.header);
    const values = (rows || []).map((row) => Array.isArray(row) ? row[index] : "");
    const inferredType = inferColumnType(values);
    const expected = ({
      customer_id: ["identifier/text", "numeric", "text/mixed"],
      full_name: ["text/mixed", "identifier/text"],
      email: ["email"],
      phone: ["phone", "text/mixed"],
      address: ["text/mixed"],
      date_of_birth: ["date"]
    })[targetKey] || [];
    const typeCompatible = inferredType === "empty" || expected.includes(inferredType);
    const nonblank = values.map((value) => String(value == null ? "" : value).trim()).filter(Boolean);
    const headerScore = headerSuggestion.kind === "exact" ? 0.66 : headerSuggestion.kind === "normalized" ? 0.62 : 0.48;
    const typeScore = inferredType === "empty" ? 0 : typeCompatible ? 0.22 : -0.38;
    const completenessScore = values.length ? (nonblank.length / values.length) * 0.06 : 0;
    const uniquenessScore = targetKey === "customer_id" && nonblank.length ? (new Set(nonblank).size / nonblank.length) * 0.06 : 0;
    const score = Math.max(0, Math.min(1, headerScore + typeScore + completenessScore + uniquenessScore));
    const confidence = score >= MAPPING_CONFIDENCE_THRESHOLDS.high ? "high" : score >= MAPPING_CONFIDENCE_THRESHOLDS.medium ? "medium" : "low";
    const rationale = !typeCompatible
      ? `Header suggests ${target.label}, but sampled values look like ${inferredType}; review or reject this candidate.`
      : `${headerSuggestion.kind === "heuristic" ? "Recognized alias" : "Header match"} plus ${inferredType === "empty" ? "no usable value evidence" : `observed ${inferredType} values`}${targetKey === "customer_id" ? ` and ${nonblank.length ? Math.round(new Set(nonblank).size / nonblank.length * 100) : 0}% distinct nonblank values` : ""}. Heuristic confidence is not calibrated.`;
    return { ...headerSuggestion, confidence, score: Number(score.toFixed(2)), rationale, inferredType, typeCompatible, recommendable: typeCompatible && confidence !== "low" };
  }
  function validateMappings(headers, mappings) {
    const errors = [];
    const idColumn = mappings && mappings.customer_id;
    if (!idColumn) errors.push({ code: "MAPPING_REQUIRED", message: "Select and confirm a source column for Customer ID." });
    else if (!headers.includes(idColumn)) errors.push({ code: "MAPPING_SOURCE_MISSING", message: "The selected Customer ID source column is not in the uploaded file." });
    const selected = Object.entries(mappings || {}).filter(([, column]) => column);
    selected.forEach(([target, column]) => {
      if (!mappingTarget(target)) errors.push({ code: "MAPPING_TARGET_UNKNOWN", message: `Unknown canonical target: ${target}.` });
      if (!headers.includes(column)) errors.push({ code: "MAPPING_SOURCE_MISSING", message: `The selected source column for ${target} is not in the uploaded file.` });
    });
    const sources = new Map();
    selected.forEach(([target, column]) => {
      if (!headers.includes(column)) return;
      const targets = sources.get(column) || [];
      targets.push(target); sources.set(column, targets);
    });
    sources.forEach((targets, column) => {
      if (targets.length > 1) errors.push({ code: "MAPPING_SOURCE_REUSED", message: `Source column “${column}” is assigned to multiple targets (${targets.join(", ")}). Choose a different column or leave an optional target unmapped.` });
    });
    return { valid: errors.length === 0, errors };
  }
  function processingReadiness({ hasFile, rowCount, headers, mappings, processing = false }) {
    if (processing) return { enabled: false, reason: "Processing is already in progress." };
    if (!hasFile || !rowCount) return { enabled: false, reason: "Upload a CSV with at least one data row first." };
    const mapping = validateMappings(headers, mappings);
    return { enabled: mapping.valid, reason: mapping.valid ? "Mapping is valid." : mapping.errors[0].message, errors: mapping.errors };
  }
  function normalizeLocation(value) { return String(value == null ? "" : value).trim().replace(/\s+/g, " ").toLowerCase(); }
  function detectLocationColumns(headers) {
    const recognized = new Set(["city", "location", "customer city"]);
    return headers.filter((header) => recognized.has(String(header).trim().toLowerCase().replace(/[\s_-]+/g, " ")));
  }
  function countLocationRecords(dataset, location, selectedColumn = "") {
    if (!dataset || !Array.isArray(dataset.headers) || !Array.isArray(dataset.rows)) return { status: "no_dataset" };
    const candidates = detectLocationColumns(dataset.headers);
    const column = selectedColumn || (candidates.length === 1 ? candidates[0] : "");
    if (!column) return { status: candidates.length > 1 ? "ambiguous_column" : "missing_column", candidates, headers: dataset.headers };
    const columnIndex = dataset.headers.indexOf(column);
    if (columnIndex < 0) return { status: "invalid_column", headers: dataset.headers };
    const needle = normalizeLocation(location);
    if (!needle) return { status: "invalid_location", column };
    const count = dataset.rows.reduce((total, row) => total + (normalizeLocation(row[columnIndex]) === needle ? 1 : 0), 0);
    return { status: "count", count, column };
  }
  function detectDelimiter(text) {
    const first = text.split(/\r?\n/).find((line) => line.trim() !== "") || "";
    const candidates = [",", "\t", ";", "|"];
    return candidates.map((delimiter) => {
      let quoted = false, count = 0;
      for (let i = 0; i < first.length; i++) {
        if (first[i] === '"' && first[i + 1] === '"' && quoted) { i++; continue; }
        if (first[i] === '"') quoted = !quoted;
        else if (!quoted && first[i] === delimiter) count++;
      }
      return { delimiter, count };
    }).sort((a, b) => b.count - a.count)[0].delimiter;
  }
  function parseDelimited(text, delimiter) {
    const records = [], sourceLines = [];
    let row = [], field = "", quoted = false, afterQuote = false, lineNumber = 1, rowStartLine = 1;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { quoted = false; afterQuote = true; }
        else if (ch === "\r" || ch === "\n") {
          if (ch === "\r" && text[i + 1] === "\n") { field += "\r\n"; i++; }
          else field += ch;
          lineNumber++;
        } else field += ch;
        continue;
      }
      if (afterQuote && ch !== delimiter && ch !== "\r" && ch !== "\n" && ch !== " " && ch !== "\t") {
        throw new Error(`Unexpected character after a quoted value near character ${i + 1}.`);
      }
      if (ch === '"') {
        if (field.length) throw new Error(`Unexpected quote inside an unquoted value near character ${i + 1}.`);
        quoted = true; afterQuote = false;
      } else if (ch === delimiter) {
        row.push(field); field = ""; afterQuote = false;
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = ""; afterQuote = false;
        records.push(row); sourceLines.push(rowStartLine);
        row = [];
        lineNumber++; rowStartLine = lineNumber;
      } else {
        field += ch;
        if (ch !== " " && ch !== "\t") afterQuote = false;
      }
    }
    if (quoted) throw new Error("A quoted field is not closed. Check the CSV quoting and try again.");
    if (field.length || row.length) {
      row.push(field);
        records.push(row); sourceLines.push(rowStartLine);
    }
    return { records, sourceLines };
  }
  function parseCsv(text) {
    const delimiter = detectDelimiter(text);
    const { records, sourceLines } = parseDelimited(text, delimiter);
    if (records.length < 2) throw new Error("The CSV needs a header row and at least one non-empty data row.");
    const headers = records[0].map((value) => value.trim());
    if (headers.some((value) => !value)) throw new Error("Every column needs a non-empty header.");
    const seen = new Set();
    for (const header of headers) {
      const key = normalizedHeader(header);
      if (seen.has(key)) throw new Error(`The CSV contains a duplicate header: “${header}”. Rename duplicate columns and try again.`);
      seen.add(key);
    }
    const body = records.slice(1);
    const mismatched = body.findIndex((record) => record.length !== headers.length);
    if (mismatched !== -1) throw new Error(`Data row ${mismatched + 2} has ${body[mismatched].length} columns; the header has ${headers.length}. No rows were dropped.`);
    return { delimiter, headers, rows: body, sourceRows: sourceLines.slice(1) };
  }
  function processRows(headers, rows, mappings, sourceRowNumbers = [], options = null) {
    const mappingCheck = validateMappings(headers, mappings);
    if (!mappingCheck.valid) throw new Error(mappingCheck.errors.map((error) => error.message).join(" "));
    const approvedTransforms = options && Array.isArray(options.approvedTransforms) ? new Set(options.approvedTransforms) : null;
    const selected = Object.entries(mappings).filter(([, column]) => column).map(([key, column]) => [key, headers.indexOf(column)]);
    const results = rows.map((values, index) => {
      const canonical = {}, changes = [], errors = [], warnings = [];
      selected.forEach(([target, sourceIndex]) => {
        const original = values[sourceIndex];
        const shouldTrim = approvedTransforms === null || approvedTransforms.has("whitespace_trim");
        const trimmed = shouldTrim ? original.trim() : original;
        const shouldNormalizeEmail = target === "email" && (approvedTransforms === null || approvedTransforms.has("email_lowercase"));
        const cleaned = shouldNormalizeEmail ? trimmed.toLowerCase() : trimmed;
        canonical[target] = cleaned;
        if (trimmed !== original) changes.push({ sourceField: headers[sourceIndex], target, before: original, after: trimmed, rule: "whitespace trimming", reviewRequired: false });
        if (target === "email" && cleaned !== trimmed) changes.push({ sourceField: headers[sourceIndex], target, before: trimmed, after: cleaned, rule: "email casing normalization", reviewRequired: false });
      });
      const rowNumber = sourceRowNumbers[index] || index + 2;
      if (!String(canonical.customer_id == null ? "" : canonical.customer_id).trim()) errors.push({ code: "BR-01", category: "missing_required", severity: "blocking", field: "customer_id", message: "Customer ID is missing or blank.", recommendedAction: "Provide a customer identifier and reprocess the corrected CSV." });
      if (canonical.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canonical.email)) {
        warnings.push({ code: "BR-04", category: "format_review", severity: "review", field: "email", message: "Email does not match the demo's basic email pattern. The format policy is not approved; confirm or correct it before downstream use.", recommendedAction: "Review the email value and confirm the applicable format policy." });
      }
      if (canonical.date_of_birth) {
        const match = canonical.date_of_birth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const validIso = match && (() => {
          const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
          return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
        })();
        if (!validIso) warnings.push({ code: "BR-05", category: "date_review", severity: "review", field: "date_of_birth", message: "Date value is invalid or not in the unambiguous ISO YYYY-MM-DD form. No date conversion was applied because the source format is not configured.", recommendedAction: "Confirm the source date format, correct invalid values, and reprocess." });
      }
      return { rowNumber, headers, values: [...values], canonical, changes, errors, warnings };
    });
    const groups = new Map();
    results.forEach((record) => {
      const id = String(record.canonical.customer_id == null ? "" : record.canonical.customer_id).trim();
      if (!id) return;
      const group = groups.get(id) || []; group.push(record); groups.set(id, group);
    });
    groups.forEach((group) => {
      if (group.length > 1) group.forEach((record) => record.errors.push({ code: "BR-02", category: "duplicate_identifier", severity: "blocking", field: "customer_id", message: `Customer ID is duplicated in this batch; all ${group.length} conflicting rows are flagged.`, recommendedAction: "Review all rows sharing this identifier, correct the source data, and reprocess." }));
    });
    results.forEach((record) => { record.status = getRecordStatus(record); });
    return results;
  }
  function getRecordStatus(record) {
    if (record.errors && record.errors.length) return "invalid";
    if (record.warnings && record.warnings.length) return "needs_review";
    return "valid";
  }
  function filterRecords(records, filters = [], quality = "all") {
    const groups = new Map();
    filters.forEach(({ column, value, mode = "exact" }) => {
      if (!column || (mode !== "missing" && !normalizeLocation(value))) return;
      const rules = groups.get(column) || [];
      rules.push(mode === "missing" ? { mode } : { mode: "exact", value: normalizeLocation(value) });
      groups.set(column, rules);
    });
    const matched = [], excluded = [];
    records.forEach((record) => {
      const sourceMatches = [...groups].every(([column, values]) => {
        const index = record.headers ? record.headers.indexOf(column) : -1;
        const actual = index >= 0 ? record.values[index] : "";
        return values.some((rule) => rule.mode === "missing" ? !String(actual == null ? "" : actual).trim() : rule.value === normalizeLocation(actual));
      });
      const codes = new Set([...(record.errors || []), ...(record.warnings || [])].map((issue) => issue.code));
      const qualityMatches = quality === "all" || quality === "valid" && record.status === "valid" || quality === "needs_review" && record.status === "needs_review" || quality === "invalid" && record.status === "invalid" || quality === "missing_id" && codes.has("BR-01") || quality === "duplicate_id" && codes.has("BR-02");
      (sourceMatches && qualityMatches ? matched : excluded).push(record);
    });
    return { matched, excluded };
  }
  function validationReport(records, filteredRecords = records) {
    const included = new Set(filteredRecords.map((record) => record.rowNumber));
    const headers = ["source_row", "status", "failed_rule_codes", "review_rule_codes", "affected_fields", "explanation", "matches_active_filters"];
    const rows = records.map((record) => {
      const issues = [...(record.errors || []), ...(record.warnings || [])];
      return [record.rowNumber, record.status || getRecordStatus(record), (record.errors || []).map((issue) => issue.code).join("; "), (record.warnings || []).map((issue) => issue.code).join("; "), [...new Set(issues.map((issue) => issue.field).filter(Boolean))].join("; "), issues.map((issue) => issue.message).join(" "), included.has(record.rowNumber) ? "yes" : "no"];
    });
    return { headers, rows };
  }
  function exceptionReport(records, originalHeaders = records[0] && records[0].headers ? records[0].headers : []) {
    const sourceHeaders = originalHeaders.map((header) => `source:${header}`);
    const headers = ["source_row", "exception_category", "severity", "explanation", "recommended_action", "resolution_status", "rule_codes", ...sourceHeaders];
    const rows = records.filter((record) => (record.errors || []).length || (record.warnings || []).length).map((record) => {
      const issues = [...(record.errors || []), ...(record.warnings || [])];
      return [record.rowNumber, [...new Set(issues.map((issue) => issue.category))].join("; "), record.errors && record.errors.length ? "blocking" : "review", issues.map((issue) => issue.message).join(" "), [...new Set(issues.map((issue) => issue.recommendedAction).filter(Boolean))].join(" "), "unresolved", [...new Set(issues.map((issue) => issue.code))].join("; "), ...(record.values || [])];
    });
    return { headers, rows };
  }
  function processingSummary({ runId, timestamp, sourceFileName, records, filteredRecords, excludedRecords, mappings, mappingDecisions = {}, filters, qualityFilter, outputFiles }) {
    const count = (items, status) => items.filter((record) => record.status === status).length;
    const duplicateRows = records.filter((record) => (record.errors || []).some((issue) => issue.code === "BR-02")).length;
    const ruleCounts = {};
    records.forEach((record) => [...(record.errors || []), ...(record.warnings || [])].forEach((issue) => { ruleCounts[issue.code] = (ruleCounts[issue.code] || 0) + 1; }));
    return {
      run_id: runId,
      processed_at: timestamp,
      source_filename: sourceFileName,
      counts: {
        input_rows: records.length,
        filtered_rows: filteredRecords.length,
        excluded_by_filters: excludedRecords.length,
        valid_rows: count(records, "valid"),
        needs_review_rows: count(records, "needs_review"),
        invalid_rows: count(records, "invalid"),
        duplicate_identifier_rows: duplicateRows
      },
      filtered_counts: {
        valid_rows: count(filteredRecords, "valid"),
        needs_review_rows: count(filteredRecords, "needs_review"),
        invalid_rows: count(filteredRecords, "invalid")
      },
      applied_mappings: { ...mappings },
      mapping_decisions: { ...mappingDecisions },
      applied_filters: filters.map((filter) => ({ column: filter.column, value: filter.value })),
      quality_filter: qualityFilter,
      normalization_rules: ["trim surrounding whitespace on mapped fields", "lowercase mapped email values"],
      validation_results_by_rule: ruleCounts,
      output_files: { ...outputFiles }
    };
  }
  function csvEscape(value) {
    const text = value == null ? "" : String(value);
    const formulaLike = /^[\s]*[=@]/.test(text) || /^[\s]*[+\-]\s*(?=[^\d.])/.test(text);
    const safe = formulaLike ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }
  const api = { normalizeHeader: normalizedHeader, canonicalTargets: CANONICAL_TARGETS, mappingConfidenceThresholds: MAPPING_CONFIDENCE_THRESHOLDS, suggestMapping, inferColumnType, suggestMappingWithEvidence, validateMappings, processingReadiness, detectDelimiter, parseDelimited, parseCsv, processRows, getRecordStatus, filterRecords, validationReport, exceptionReport, processingSummary, csvEscape, normalizeLocation, detectLocationColumns, countLocationRecords };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CdcCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
