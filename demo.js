(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TARGETS = CdcCore.canonicalTargets;

  const state = { file: null, importContext: null, importTable: null, headers: [], rows: [], previewPage: 0, profile: null, mappings: {}, mappingRows: ["customer_id"], mappingSuggestions: {}, mappingSources: {}, filters: [], qualityFilter: "all", results: null, filteredResults: [], excludedResults: [], run: null, processing: false };
  let spreadsheetLibraryPromise = null;
  window.CdcDemoData = {
    getCurrentDataset() {
      return state.file ? { headers: [...state.headers], rows: state.rows.map((record) => [...record.values]), sourceFileName: state.file.name, format: state.importTable && state.importTable.detectedFormat, worksheet: state.importTable && state.importTable.selectedWorksheet } : null;
    },
    getCurrentProfile() { return state.profile ? JSON.parse(JSON.stringify(state.profile)) : null; }
  };
  const fileInput = $("fileInput");
  const dropZone = $("dropZone");

  function ensureSpreadsheetLibrary() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (spreadsheetLibraryPromise) return spreadsheetLibraryPromise;
    spreadsheetLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL("./vendor/xlsx.full.min.js", document.baseURI).href;
      script.async = true;
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("The spreadsheet parser loaded without its expected interface."));
      script.onerror = () => { spreadsheetLibraryPromise = null; reject(new Error("The local spreadsheet parser could not be loaded. Confirm the app was built and served from its project URL, then retry.")); };
      document.head.appendChild(script);
    });
    return spreadsheetLibraryPromise;
  }

  function clearCurrentDataset() {
    state.file = null; state.importContext = null; state.importTable = null; state.headers = []; state.rows = []; state.previewPage = 0; state.profile = null; state.mappings = {}; state.mappingRows = ["customer_id"]; state.mappingSuggestions = {}; state.mappingSources = {}; state.filters = []; state.qualityFilter = "all"; state.results = null; state.filteredResults = []; state.excludedResults = []; state.run = null; state.processing = false;
    $("profileActions").hidden = true;
    $("previewSection").hidden = true; $("profileSection").hidden = true; $("mappingSection").hidden = true; $("filterSection").hidden = true; $("resultsSection").hidden = true;
    $("importOptions").hidden = true; $("worksheetControl").hidden = true; $("delimiterControl").hidden = true; $("importWarnings").hidden = true;
    window.dispatchEvent(new Event("cdc:dataset-changed"));
  }

  function showError(message) {
    $("errorBox").textContent = message;
    $("errorBox").hidden = false;
    $("fileStatus").textContent = "The file could not be prepared.";
  }
  function clearError() { $("errorBox").textContent = ""; $("errorBox").hidden = true; }
  function textNode(tag, value, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value == null || value === "" ? "—" : String(value);
    return node;
  }
  function cell(row, value, tag = "td") { row.appendChild(textNode(tag, value)); }
  function buildTable(container, headers, rows, maxRows = 30, startRow = 0) {
    const wrap = document.createElement("div"); wrap.className = "table-wrap";
    if (container.id === "sourcePreview") wrap.classList.add("source-table-wrap");
    const table = document.createElement("table");
    table.setAttribute("aria-label", (container.getAttribute && container.getAttribute("aria-label")) || "Data table");
    const thead = document.createElement("thead"), headRow = document.createElement("tr");
    headers.forEach((header) => { const th = textNode("th", header); th.scope = "col"; headRow.appendChild(th); }); thead.appendChild(headRow); table.appendChild(thead);
    const tbody = document.createElement("tbody");
    rows.slice(startRow, startRow + maxRows).forEach((values) => { const tr = document.createElement("tr"); values.forEach((value) => cell(tr, value)); tbody.appendChild(tr); });
    table.appendChild(tbody); wrap.appendChild(table); container.replaceChildren(wrap);
    if (rows.length > maxRows) container.appendChild(textNode("p", `Showing rows ${startRow + 1}–${Math.min(startRow + maxRows, rows.length)} of ${rows.length.toLocaleString()}. Use the row controls to inspect every record.`, "caption"));
    if (!rows.length) container.appendChild(textNode("p", "There are no records in this outcome.", "empty-state"));
  }

  async function loadFile(file) {
    clearError();
    if (!file) return;
    clearCurrentDataset();
    if (file.size > CdcImporter.MAX_FILE_BYTES) {
      showError("This file is larger than the 25 MiB prototype limit. Split it into smaller files and try again.");
      return;
    }
    $("fileStatus").textContent = `Reading ${file.name} locally…`;
    try {
      const bytes = await file.arrayBuffer();
      const extension = String(file.name).split(".").pop().toLowerCase();
      if (["xlsx", "xls", "xlsm", "ods"].includes(extension)) {
        $("fileStatus").textContent = `Loading the local spreadsheet parser for ${file.name}…`;
        await ensureSpreadsheetLibrary();
      }
      const opened = CdcImporter.openBytes(file.name, bytes, file.size);
      state.file = file;
      state.importContext = opened.context;
      renderImportOptions(opened);
      if (opened.table) applyImportedTable(opened.table);
      else reparseSelection();
    } catch (error) {
      clearCurrentDataset();
      showError(error.message || "The selected file could not be parsed.");
    }
  }
  function formatBytes(bytes) { return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`; }
  function delimiterName(value) { return value === "\t" ? "tab" : value === ";" ? "semicolon" : value === "|" ? "pipe" : "comma"; }
  function renderImportOptions(opened) {
    const context = opened.context;
    const isWorkbook = Boolean(context.workbook);
    const isText = ["csv", "tsv", "txt"].includes(context.extension);
    $("importOptions").hidden = false;
    $("worksheetControl").hidden = !isWorkbook;
    $("delimiterControl").hidden = !isText;
    if (isWorkbook) {
      const select = $("worksheetSelect"); select.replaceChildren();
      opened.worksheetNames.forEach((name) => { const option = document.createElement("option"); option.value = name; option.textContent = name; select.appendChild(option); });
      select.value = (opened.table && opened.table.selectedWorksheet) || opened.worksheetNames[0] || "";
    }
    $("delimiterSelect").value = context.extension === "tsv" ? "\t" : "auto";
    $("headerRowInput").value = String(opened.table.headerRow);
  }
  function applyImportedTable(table) {
    state.importTable = table;
    state.headers = [...table.headers];
    state.rows = table.rows.map((values, index) => ({ rowNumber: table.sourceRows[index], values }));
    state.profile = null; state.previewPage = 0; state.mappings = {}; state.mappingRows = ["customer_id"]; state.mappingSuggestions = {}; state.mappingSources = {}; state.filters = []; state.qualityFilter = "all";
    state.results = null; state.filteredResults = []; state.excludedResults = []; state.run = null;
    $("previewSection").hidden = false; $("profileSection").hidden = false; $("mappingSection").hidden = true; $("filterSection").hidden = true; $("resultsSection").hidden = true;
    window.dispatchEvent(new Event("cdc:dataset-changed"));
    const sheet = table.selectedWorksheet ? ` · Worksheet: ${table.selectedWorksheet}` : "";
    const delimiter = table.delimiter ? ` · ${delimiterName(table.delimiter)} delimiter` : "";
    $("fileStatus").textContent = `${table.sourceFileName} · ${String(table.detectedFormat).toUpperCase()} · ${formatBytes(state.file.size)} · ${state.rows.length.toLocaleString()} data rows · ${table.headers.length.toLocaleString()} columns${sheet}${delimiter} · parsed locally`;
    $("importWarnings").replaceChildren();
    if (table.warnings.length) {
      table.warnings.forEach((message) => $("importWarnings").appendChild(textNode("p", message)));
      $("importWarnings").hidden = false;
    } else $("importWarnings").hidden = true;
    renderPreview();
    profileData();
  }
  function reparseSelection() {
    if (!state.importContext) return;
    clearError();
    const headerRow = Number($("headerRowInput").value);
    if (!Number.isInteger(headerRow) || headerRow < 1) { showError("Enter a header row number of 1 or greater."); return; }
    try {
      const table = CdcImporter.parseContext(state.importContext, {
        sheetName: $("worksheetSelect").value,
        headerRow,
        delimiter: $("delimiterSelect").value
      });
      applyImportedTable(table);
    } catch (error) {
      state.importTable = null; state.headers = []; state.rows = [];
      $("previewSection").hidden = true; $("profileSection").hidden = true; $("mappingSection").hidden = true; $("filterSection").hidden = true; $("resultsSection").hidden = true;
      showError(error.message || "The selected worksheet options could not be parsed.");
    }
  }
  function renderPreview() {
    const summary = $("fileSummary"); summary.replaceChildren();
    [["File", state.file.name], ["Format", String(state.importTable.detectedFormat).toUpperCase()], ["Size", formatBytes(state.file.size)], ["Rows", state.rows.length.toLocaleString()], ["Columns", state.headers.length], ["Header row", state.importTable.headerRow], ...(state.importTable.selectedWorksheet ? [["Worksheet", state.importTable.selectedWorksheet]] : [])].forEach(([label, value]) => {
      const chip = document.createElement("span"); chip.className = "summary-chip"; chip.append(textNode("b", `${label}:`), document.createTextNode(` ${value}`)); summary.appendChild(chip);
    });
    const pageSize = 50;
    buildTable($("sourcePreview"), state.headers, state.rows.map((record) => record.values), pageSize, state.previewPage * pageSize);
    const pages = Math.max(1, Math.ceil(state.rows.length / pageSize));
    $("previewPrevious").disabled = state.previewPage === 0;
    $("previewNext").disabled = state.previewPage >= pages - 1;
    $("previewPageInfo").textContent = `Page ${state.previewPage + 1} of ${pages}`;
  }

  const PROFILE_PAGE_SIZE = 50;
  function profileColumnValues(index) { return state.rows.map((record) => record.values[index]); }
  function calculateProfile() {
    const suggestions = Object.fromEntries(TARGETS.map((target) => [target.key, CdcCore.suggestMappingWithEvidence(state.headers, state.rows.map((record) => record.values), target.key)]));
    const byHeader = new Map();
    Object.entries(suggestions).forEach(([key, suggestion]) => {
      if (suggestion.recommendable && suggestion.header) byHeader.set(suggestion.header, [...(byHeader.get(suggestion.header) || []), key]);
    });
    Object.entries(suggestions).forEach(([key, suggestion]) => {
      if (suggestion.header && (byHeader.get(suggestion.header) || []).length > 1) {
        suggestion.confidence = "low"; suggestion.recommendable = false;
        suggestion.rationale = `This source column also matches ${(byHeader.get(suggestion.header) || []).filter((candidate) => candidate !== key).join(", ")}; resolve the conflict manually.`;
      }
    });
    const columns = state.headers.map((name, index) => {
      const values = profileColumnValues(index);
      const nonblank = values.filter((value) => value.trim() !== "");
      const missing = values.length - nonblank.length;
      return { name, inferred_type: CdcCore.inferColumnType(values), present_count: nonblank.length, missing_count: missing, missing_percentage: values.length ? Number((missing / values.length * 100).toFixed(1)) : 0, distinct_count: new Set(nonblank).size, quality_status: missing === 0 ? "Complete" : missing === values.length ? "No values" : "Missing values", recommended_action: missing ? "Review missing values" : "No action" };
    });
    const idSuggestion = suggestions.customer_id;
    const idColumn = idSuggestion && idSuggestion.recommendable ? idSuggestion.header : "";
    const idIndex = state.headers.indexOf(idColumn);
    const findings = [];
    let missingIdCount = null;
    let duplicateIdRowCount = null;
    if (idIndex >= 0) {
      const groups = new Map();
      missingIdCount = 0;
      state.rows.forEach((record) => {
        const value = record.values[idIndex].trim();
        if (!value) { missingIdCount++; findings.push({ source_row: record.rowNumber, category: "missing_required_identifier", field: idColumn, rule_code: "BR-01" }); return; }
        groups.set(value, [...(groups.get(value) || []), record.rowNumber]);
      });
      duplicateIdRowCount = 0;
      groups.forEach((sourceRows) => {
        if (sourceRows.length > 1) sourceRows.forEach((sourceRow) => { duplicateIdRowCount++; findings.push({ source_row: sourceRow, category: "potential_duplicate_identifier", field: idColumn, rule_code: "BR-02" }); });
      });
    }
    const locationColumns = CdcCore.detectLocationColumns(state.headers).map((name) => {
      const index = state.headers.indexOf(name), counts = new Map();
      state.rows.forEach((record) => {
        const value = record.values[index].trim().replace(/\s+/g, " ");
        if (value) counts.set(value, (counts.get(value) || 0) + 1);
      });
      return { name, values: [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, 5) };
    });
    const blankCellCount = columns.reduce((sum, column) => sum + column.missing_count, 0);
    return {
      metadata: { run_id: makeRunId(), generated_at: new Date().toISOString(), source_file: state.file.name, source_format: state.importTable.detectedFormat, worksheet: state.importTable.selectedWorksheet || null, header_row: state.importTable.headerRow, row_count: state.rows.length, column_count: state.headers.length },
      counts: { blank_cells: blankCellCount, missing_customer_id_records: missingIdCount, potential_duplicate_identifier_records: duplicateIdRowCount, records_requiring_review: null },
      columns, findings, mapping_suggestions: suggestions, location_columns: locationColumns, warnings: [...state.importTable.warnings], limitations: ["Profile values and data types are heuristic observations, not validation outcomes.", "Customer ID findings are provisional until the source mapping is reviewed.", "No clinical or demographic fields are inferred or recommended."]
    };
  }
  function renderProfileKpis() {
    const profile = state.profile;
    const values = [
      ["Total records", profile.metadata.row_count.toLocaleString(), "Parsed data rows"],
      ["Total columns", profile.metadata.column_count.toLocaleString(), "Source fields"],
      ["Blank cells", profile.counts.blank_cells.toLocaleString(), "Blank or whitespace-only values"],
      ["Potential duplicate ID rows", profile.counts.potential_duplicate_identifier_records == null ? "Requires mapping" : profile.counts.potential_duplicate_identifier_records.toLocaleString(), "Candidate only; confirm Customer ID"],
      ["Missing Customer ID", profile.counts.missing_customer_id_records == null ? "Requires mapping" : profile.counts.missing_customer_id_records.toLocaleString(), "BRD-required field; candidate mapping only"],
      ["Records requiring review", profile.counts.records_requiring_review == null ? "Requires validation" : profile.counts.records_requiring_review.toLocaleString(), "Profile is not a validation decision"]
    ];
    const container = $("profileResults"); container.replaceChildren();
    const grid = document.createElement("div"); grid.className = "profile-kpis";
    values.forEach(([label, value, note]) => { const card = document.createElement("article"); card.className = "profile-kpi"; card.append(textNode("span", label), textNode("b", value), textNode("small", note)); grid.appendChild(card); });
    container.appendChild(grid);
    const priorities = [...profile.columns].sort((a, b) => b.missing_count - a.missing_count || a.name.localeCompare(b.name)).filter((column) => column.missing_count > 0).slice(0, 5);
    const shown = priorities.length ? priorities : profile.columns.slice(0, 5);
    const table = document.createElement("div"); table.className = "profile-priority-table";
    buildTable(table, ["Column", "Inferred type", "Present", "Missing", "Distinct", "Quality", "Recommended action"], shown.map((column) => [column.name, column.inferred_type, column.present_count, column.missing_count, column.distinct_count, column.quality_status, column.recommended_action]));
    container.appendChild(textNode("h3", priorities.length ? "Columns with the most missing values" : "Column overview"));
    container.appendChild(table);
    $("columnQualityTitle").textContent = `View all columns (${profile.columns.length})`;
    renderColumnQuality();
  }
  function renderColumnQuality() {
    if (!state.profile) return;
    const search = $("columnSearch").value.trim().toLowerCase();
    const sort = $("columnSort").value;
    const columns = state.profile.columns.filter((column) => column.name.toLowerCase().includes(search));
    columns.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "missing" ? b.missing_count - a.missing_count || a.name.localeCompare(b.name) : sort === "status" ? a.quality_status.localeCompare(b.quality_status) || b.missing_count - a.missing_count : b.missing_count - a.missing_count || a.name.localeCompare(b.name));
    buildTable($("columnQualityTable"), ["Column", "Inferred type", "Present", "Missing", "Missing %", "Distinct", "Quality status", "Recommended action"], columns.map((column) => [column.name, column.inferred_type, column.present_count, column.missing_count, `${column.missing_percentage}%`, column.distinct_count, column.quality_status, column.recommended_action]), Math.max(1, columns.length));
    if (!columns.length) $("columnQualityTable").replaceChildren(textNode("p", "No columns match this search.", "empty-state"));
  }
  function addRecommendation(container, { title, reason, count, action, onClick }) {
    const card = document.createElement("article"); card.className = "recommendation-card";
    const copy = document.createElement("div"); copy.appendChild(textNode("strong", title)); copy.appendChild(textNode("p", reason));
    if (count != null) copy.appendChild(textNode("span", `${Number(count).toLocaleString()} matching records`, "recommendation-count"));
    const button = document.createElement("button"); button.type = "button"; button.className = "button secondary"; button.textContent = action; button.addEventListener("click", onClick);
    card.append(copy, button); container.appendChild(card);
  }
  function renderProfileRecommendations() {
    if (!state.profile) return;
    const container = $("recommendedActions"); container.replaceChildren();
    const profile = state.profile;
    const idColumn = profile.mapping_suggestions.customer_id.recommendable ? profile.mapping_suggestions.customer_id.header : "";
    if (!idColumn) addRecommendation(container, { title: "Confirm the Customer ID source", reason: "No reliable unique header-and-value match was found. Select the correct source field before using identifier-based checks.", action: "Review mapping", onClick: () => $("mappingSection").scrollIntoView({ behavior: "smooth", block: "start" }) });
    else {
      if (profile.counts.missing_customer_id_records > 0) addRecommendation(container, { title: "Review missing Customer IDs", reason: `Blank values were observed in “${idColumn}”. This is a required BRD field; rows remain in the dataset for review.`, count: profile.counts.missing_customer_id_records, action: "Preview & download rows", onClick: () => applyProfileFilter({ quality: "missing_id" }) });
      if (profile.counts.potential_duplicate_identifier_records > 0) addRecommendation(container, { title: "Inspect potential duplicate IDs", reason: `Exact repeated values were found in “${idColumn}”. These are candidates pending mapping confirmation; no records were merged or removed.`, count: profile.counts.potential_duplicate_identifier_records, action: "Preview & download rows", onClick: () => applyProfileFilter({ quality: "duplicate_id" }) });
    }
    profile.columns.filter((column) => column.missing_count > 0 && column.name !== idColumn).sort((a, b) => b.missing_count - a.missing_count).slice(0, 3).forEach((column) => addRecommendation(container, { title: `Review missing values in ${column.name}`, reason: `Missingness is an observed profile fact; the field is not assumed mandatory.`, count: column.missing_count, action: "Preview & download blank rows", onClick: () => applyProfileFilter({ column: column.name, mode: "missing" }) }));
    profile.location_columns.forEach((location) => location.values.slice(0, 3).forEach(({ value, count }) => addRecommendation(container, { title: `Filter ${location.name}: ${value}`, reason: `This exact value occurs in the currently uploaded file. Matching is case-insensitive after whitespace normalization.`, count, action: "Preview & download matches", onClick: () => applyProfileFilter({ column: location.name, value, mode: "exact" }) })));
    if (state.results) {
      const eligible = state.results.filter((record) => record.status === "valid").length;
      addRecommendation(container, { title: "Review records eligible in this demo", reason: "Eligibility reflects only the configured demo checks. It is not import approval; no destination is connected.", count: eligible, action: "Preview & download eligible rows", onClick: () => applyProfileFilter({ quality: "valid" }) });
    }
    if (!container.children.length) container.appendChild(textNode("p", "No additional data-driven actions were identified. Custom filters remain available below.", "empty-state"));
  }
  function renderProfile() {
    if (!state.rows.length || !state.profile) return;
    renderProfileKpis();
    renderProfileRecommendations();
    $("profileActions").hidden = false;
    $("downloadProfileFindings").hidden = !state.profile.findings.length;
  }
  function profileData() {
    if (!state.rows.length) return;
    try {
      state.profile = calculateProfile();
      $("profileSection").hidden = false;
      renderProfile();
      renderMappings();
      $("mappingSection").hidden = false; $("filterSection").hidden = false;
    } catch (error) {
      state.profile = null;
      $("profileActions").hidden = true;
      $("profileResults").replaceChildren(textNode("p", `Profiling could not be completed: ${error.message || "Unexpected profiling error."}`, "error-box"));
    }
  }

  const USE_CASE_TARGETS = { customer_identity: ["customer_id"], contact: ["email", "phone"], address: ["address"], date: ["date_of_birth"] };
  function renderMappingRecommendations() {
    const container = $("mappingRecommendations"); container.replaceChildren();
    if (!state.profile) return;
    if (!$("mappingUseCase").value) $("mappingUseCase").value = "customer_identity";
    const useCase = $("mappingUseCase").value;
    const keys = USE_CASE_TARGETS[useCase] || [];
    keys.forEach((key) => {
      const target = TARGETS.find((item) => item.key === key);
      const suggestion = state.mappingSuggestions[key];
      const card = document.createElement("article"); card.className = "mapping-recommendation";
      const label = document.createElement("strong"); label.textContent = target.label;
      const evidence = document.createElement("p"); evidence.textContent = suggestion.rationale || "No reliable match was found from the available evidence.";
      const confidence = document.createElement("span"); confidence.className = `confidence confidence-${suggestion.confidence || "low"}`;
      confidence.textContent = `${(suggestion.confidence || "low").toUpperCase()} heuristic · ${suggestion.header || "No source candidate"}`;
      card.append(label, confidence, evidence);
      if (suggestion.recommendable && suggestion.header) {
        const button = document.createElement("button"); button.type = "button"; button.className = "button secondary";
        if (target.required) {
          button.textContent = state.mappingSources[key] === "manual" ? "Customer ID confirmed" : "Use as Customer ID suggestion";
          button.disabled = state.mappingSources[key] === "manual";
          button.addEventListener("click", () => { state.mappings[key] = suggestion.header; state.mappingSources[key] = "suggested"; renderMappings(); });
        } else {
          button.textContent = state.mappingRows.includes(key) ? "Mapping added" : "Add and confirm mapping";
          button.disabled = state.mappingRows.includes(key);
          button.addEventListener("click", () => addMappingTarget(key, suggestion.header, true));
        }
        card.appendChild(button);
      } else if (suggestion.header) card.appendChild(textNode("span", "Needs review · no automatic mapping", "mapping-review"));
      container.appendChild(card);
    });
  }
  function createSourceSelect(target, value) {
    const select = document.createElement("select"); select.id = `map-${target.key}`; select.dataset.target = target.key;
    select.setAttribute("aria-label", `Map source column to ${target.label}`);
    const none = document.createElement("option"); none.value = ""; none.textContent = target.required ? "Select a source column…" : "Do not map"; select.appendChild(none);
    state.headers.forEach((header) => { const option = document.createElement("option"); option.value = header; option.textContent = header; select.appendChild(option); });
    select.value = value || "";
    select.addEventListener("change", () => {
      state.mappings[target.key] = select.value;
      state.mappingSources[target.key] = select.value ? "manual" : "manual_unmapped";
      state.results = null; state.filteredResults = []; state.excludedResults = []; state.run = null; $("resultsSection").hidden = true;
      renderMappings();
    });
    return select;
  }
  function addMappingTarget(targetKey, sourceHeader = "", confirmed = false) {
    const target = TARGETS.find((item) => item.key === targetKey);
    if (!target || target.required || state.mappingRows.includes(targetKey)) return;
    state.mappingRows.push(targetKey);
    state.mappings[targetKey] = sourceHeader;
    state.mappingSources[targetKey] = sourceHeader ? (confirmed ? "manual" : "suggested") : "manual_unmapped";
    renderMappings();
  }
  function renderMappings() {
    if (!state.profile) return;
    state.mappingSuggestions = state.profile.mapping_suggestions;
    const list = $("mappingList"); list.replaceChildren();
    state.mappingRows.forEach((key, index) => {
      const target = TARGETS.find((item) => item.key === key);
      if (!target) return;
      const row = document.createElement("div"); row.className = "mapping-row";
      if (target.required) {
        const label = document.createElement("label"); label.htmlFor = `map-${key}`; label.textContent = `${target.label} · Required`;
        row.append(label, textNode("span", "←"), createSourceSelect(target, state.mappings[key]));
        const suggestion = state.mappingSuggestions[key];
        const hint = suggestion.header && suggestion.recommendable
          ? `${suggestion.confidence.toUpperCase()} heuristic suggestion: ${suggestion.header}. Explicit confirmation is still required.`
          : "No reliable match. Choose the Customer ID source manually; do not map an unrelated field.";
        row.appendChild(textNode("small", hint));
        if (state.mappingSources[key] === "suggested" && state.mappings[key]) {
          const confirm = document.createElement("button"); confirm.type = "button"; confirm.className = "button secondary"; confirm.textContent = "Confirm Customer ID mapping";
          confirm.addEventListener("click", () => { state.mappingSources[key] = "manual"; renderMappings(); }); row.appendChild(confirm);
        }
      } else {
        const targetLabel = document.createElement("label"); targetLabel.htmlFor = `target-${key}`; targetLabel.textContent = "Canonical field · optional";
        const targetSelect = document.createElement("select"); targetSelect.id = `target-${key}`; targetSelect.setAttribute("aria-label", "Choose optional canonical customer field");
        TARGETS.filter((item) => !item.required && (!state.mappingRows.includes(item.key) || item.key === key)).forEach((item) => { const option = document.createElement("option"); option.value = item.key; option.textContent = item.label; targetSelect.appendChild(option); });
        targetSelect.value = key;
        targetSelect.addEventListener("change", () => {
          const nextKey = targetSelect.value; state.mappingRows[index] = nextKey;
          state.mappings[nextKey] = state.mappings[key] || ""; state.mappingSources[nextKey] = state.mappingSources[key] || "manual_unmapped";
          delete state.mappings[key]; delete state.mappingSources[key]; renderMappings();
        });
        const sourceLabel = document.createElement("label"); sourceLabel.htmlFor = `map-${key}`; sourceLabel.textContent = "Source column";
        row.append(targetLabel, targetSelect, sourceLabel, createSourceSelect(target, state.mappings[key]));
        const remove = document.createElement("button"); remove.type = "button"; remove.className = "button secondary mapping-remove"; remove.textContent = "Remove"; remove.setAttribute("aria-label", `Remove ${target.label} mapping`);
        remove.addEventListener("click", () => { state.mappingRows = state.mappingRows.filter((item) => item !== key); delete state.mappings[key]; delete state.mappingSources[key]; renderMappings(); }); row.appendChild(remove);
      }
      list.appendChild(row);
    });
    const available = TARGETS.filter((target) => !target.required && !state.mappingRows.includes(target.key));
    $("addMapping").disabled = available.length === 0;
    $("addHighConfidenceMappings").disabled = !TARGETS.some((target) => !target.required && state.mappingSuggestions[target.key]?.recommendable && state.mappingSuggestions[target.key]?.confidence === "high" && !state.mappingRows.includes(target.key));
    populateFilterColumns(); renderMappingRecommendations(); updateMappingSummary(); updateMappingStatus();
  }
  function updateMappingSummary() {
    const confirmed = state.mappingRows.filter((key) => state.mappingSources[key] === "manual" && state.mappings[key]).length;
    const suggested = state.mappingRows.filter((key) => state.mappingSources[key] === "suggested" && state.mappings[key]).length;
    const mappedOptional = state.mappingRows.filter((key) => key !== "customer_id" && state.mappings[key]).length;
    const unmappedRows = state.mappingRows.filter((key) => !state.mappings[key]).length;
    const validation = CdcCore.validateMappings(state.headers, state.mappings);
    const conflicts = validation.errors.filter((error) => error.code === "MAPPING_SOURCE_REUSED").length;
    $("mappingSummary").textContent = `Required Customer ID: ${state.mappingSources.customer_id === "manual" && state.mappings.customer_id ? "confirmed" : "unconfirmed"} · Confirmed: ${confirmed} · Suggested: ${suggested} · Optional mapped: ${mappedOptional} · Unmapped: ${unmappedRows} · Conflicts: ${conflicts}`;
  }
  function updateMappingStatus() {
    const readiness = CdcCore.processingReadiness({ hasFile: Boolean(state.file), rowCount: state.rows.length, headers: state.headers, mappings: state.mappings, processing: state.processing });
    const explicitlyConfirmed = state.mappingSources.customer_id === "manual";
    const enabled = readiness.enabled && explicitlyConfirmed;
    $("cleanButton").disabled = !enabled;
    $("mappingStatus").textContent = enabled
      ? "Customer ID mapping is confirmed. Optional fields may remain unmapped."
      : readiness.enabled && !explicitlyConfirmed ? "Review and explicitly confirm the Customer ID mapping before processing." : readiness.reason;
    updateMappingSummary();
  }
  function refreshMappingOptions() {
    renderMappings();
  }

  function cleanAndValidate() {
    const validation = CdcCore.validateMappings(state.headers, state.mappings);
    if (!state.file || !state.rows.length || !validation.valid || state.mappingSources.customer_id !== "manual") {
      $("mappingStatus").textContent = state.mappingSources.customer_id !== "manual" ? "Explicitly confirm the Customer ID mapping before processing." : validation.errors[0]?.message || "Upload a supported file with at least one data row before processing.";
      updateMappingStatus();
      return;
    }
    state.processing = true;
    updateMappingStatus();
    $("mappingStatus").textContent = "Processing uploaded records locally: normalization → validation → exceptions → filtered results…";
    $("resultStatus").textContent = "Processing locally…";
    let processingMessage = "";
    try {
      state.results = CdcCore.processRows(state.headers, state.rows.map((record) => record.values), state.mappings, state.rows.map((record) => record.rowNumber));
      const selected = CdcCore.filterRecords(state.results, state.filters, state.qualityFilter);
      state.filteredResults = selected.matched;
      state.excludedResults = selected.excluded;
      state.run = { id: makeRunId(), timestamp: new Date().toISOString() };
      renderResults();
      $("resultsSection").hidden = false;
      $("resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
      processingMessage = "Processing completed locally. Source values were retained; inspect the status and reports before using outputs.";
    } catch (error) {
      state.results = null; state.filteredResults = []; state.excludedResults = []; state.run = null;
      $("resultsSection").hidden = true;
      processingMessage = `Processing failed: ${error.message || "An unexpected processing error occurred."}`;
    } finally {
      state.processing = false;
      updateMappingStatus();
      if (processingMessage) $("mappingStatus").textContent = processingMessage;
    }
  }

  function sourceColumnHeaders() { return state.headers.map((header) => `source:${header}`); }
  function outputHeaders(includeStatus = false) {
    const mapped = TARGETS.filter((target) => state.mappings[target.key]).map((target) => target.key);
    return ["source_row", ...mapped, ...sourceColumnHeaders(), ...(includeStatus ? ["processing_status"] : []), "normalization_log"];
  }
  function outputRow(record, includeStatus = false) {
    const mapped = TARGETS.filter((target) => state.mappings[target.key]).map((target) => record.canonical[target.key]);
    return [record.rowNumber, ...mapped, ...record.values, ...(includeStatus ? [record.status] : []), record.changes.map((change) => `${change.target}: ${change.rule}`).join(" | ")];
  }
  function renderResults() {
    const results = state.results || [];
    const valid = results.filter((record) => record.status === "valid");
    const invalid = results.filter((record) => record.status === "invalid");
    const review = results.filter((record) => record.status === "needs_review");
    const exceptions = [...invalid, ...review].sort((a, b) => a.rowNumber - b.rowNumber);
    const modified = results.filter((record) => record.changes.length > 0);
    const metricData = [["Total input", results.length], ["Filtered matches", state.filteredResults.length], ["Excluded by filters", state.excludedResults.length], ["Valid · full file", valid.length], ["Needs review · full file", review.length], ["Invalid · full file", invalid.length], ["Duplicate ID rows", results.filter((record) => record.errors.some((error) => error.code === "BR-02")).length], ["Modified records", modified.length]];
    $("metrics").replaceChildren(...metricData.map(([label, value]) => { const item = document.createElement("div"); item.className = "metric"; item.append(textNode("b", Number(value).toLocaleString()), textNode("span", label)); return item; }));
    buildTable($("validPane"), outputHeaders(), valid.map((record) => outputRow(record)));
    buildTable($("filteredPane"), outputHeaders(true), state.filteredResults.map((record) => outputRow(record, true)));
    const exceptionReport = CdcCore.exceptionReport(exceptions, state.headers);
    buildTable($("exceptionPane"), exceptionReport.headers, exceptionReport.rows);
    const changeRows = modified.flatMap((record) => record.changes.map((change) => [record.rowNumber, change.sourceField, change.target, change.rule, change.before, change.after]));
    buildTable($("changesPane"), ["source_row", "source_field", "canonical_field", "normalization_rule", "original_value", "normalized_value"], changeRows);
    const filteredValid = state.filteredResults.filter((record) => record.status === "valid").length;
    const filteredReview = state.filteredResults.filter((record) => record.status === "needs_review").length;
    const filteredInvalid = state.filteredResults.filter((record) => record.status === "invalid").length;
    $("resultStatus").textContent = state.filteredResults.length
      ? `Full-file totals: ${valid.length} valid, ${review.length} need review, ${invalid.length} invalid. Filtered subset: ${filteredValid} valid, ${filteredReview} need review, ${filteredInvalid} invalid.`
      : "No records match the selected filters. The full-file results and full validation report remain available; the filtered CSV will contain headers only.";
    if (state.profile) {
      state.profile.counts.records_requiring_review = invalid.length + review.length;
      state.profile.findings = state.results.flatMap((record) => [...(record.errors || []), ...(record.warnings || [])].map((issue) => ({ source_row: record.rowNumber, category: issue.category, field: issue.field || "", rule_code: issue.code })));
      state.profile.validation_observed = true;
      renderProfile();
    }
  }

  function downloadCsv(filename, headers, rows) {
    const csv = [headers, ...rows].map((row) => row.map(CdcCore.csvEscape).join(",")).join("\r\n");
    downloadText(filename, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  }
  function downloadText(filename, content, type) {
    downloadBlob(filename, new Blob([content], { type }));
  }
  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function profileReport() {
    if (!state.profile) throw new Error("Profile this uploaded file before downloading profile reports.");
    return state.profile;
  }
  function downloadProfileSummary() {
    try {
      const profile = profileReport();
      const text = `# Customer data profile\n\n- File: ${profile.metadata.source_file}\n- Format: ${profile.metadata.source_format}\n- Worksheet: ${profile.metadata.worksheet || "Not applicable"}\n- Run ID: ${profile.metadata.run_id}\n- Generated: ${profile.metadata.generated_at}\n- Header row: ${profile.metadata.header_row}\n- Records: ${profile.metadata.row_count}\n- Columns: ${profile.metadata.column_count}\n- Blank cells: ${profile.counts.blank_cells}\n- Potential duplicate identifier records: ${profile.counts.potential_duplicate_identifier_records == null ? "Requires mapping" : profile.counts.potential_duplicate_identifier_records}\n\n## Column quality\n\n| Column | Type (heuristic) | Present | Missing | Distinct | Status |\n|---|---|---:|---:|---:|---|\n${profile.columns.map((column) => `| ${column.name.replace(/\|/g, "\\|")} | ${column.inferred_type} | ${column.present_count} | ${column.missing_count} | ${column.distinct_count} | ${column.quality_status} |`).join("\n")}\n\n## Findings\n\n${profile.findings.length ? profile.findings.map((finding) => `- Source row ${finding.source_row}: ${finding.category} (${finding.rule_code})`).join("\n") : "No record-level findings were identified by the configured profile checks."}\n\nProfile findings are observations, not final validation or import decisions.\n`;
      downloadText(`${safeFilenamePart(profile.metadata.source_file)}_profile_summary.md`, text, "text/markdown;charset=utf-8");
    } catch (error) { $("profileResults").appendChild(textNode("p", error.message, "error-box")); }
  }
  function downloadProfileJson() {
    try {
      const profile = profileReport();
      const report = { ...profile, location_columns: profile.location_columns.map((column) => ({ name: column.name, distinct_value_count: column.values.length })) };
      downloadText(`${safeFilenamePart(profile.metadata.source_file)}_profile.json`, `${JSON.stringify(report, null, 2)}\n`, "application/json;charset=utf-8");
    }
    catch (error) { $("profileResults").appendChild(textNode("p", error.message, "error-box")); }
  }
  function downloadColumnQuality() {
    try {
      const profile = profileReport();
      const headers = ["column", "inferred_type", "present_count", "missing_count", "missing_percentage", "distinct_count", "quality_status", "recommended_action"];
      downloadCsv(`${safeFilenamePart(profile.metadata.source_file)}_column_quality.csv`, headers, profile.columns.map((column) => [column.name, column.inferred_type, column.present_count, column.missing_count, column.missing_percentage, column.distinct_count, column.quality_status, column.recommended_action]));
    } catch (error) { $("profileResults").appendChild(textNode("p", error.message, "error-box")); }
  }
  function downloadProfileFindings() {
    try {
      const profile = profileReport();
      if (!profile.findings.length) throw new Error("No record-level profile findings are available for this file.");
      downloadCsv(`${safeFilenamePart(profile.metadata.source_file)}_profile_findings.csv`, ["source_row", "category", "field", "rule_code"], profile.findings.map((finding) => [finding.source_row, finding.category, finding.field, finding.rule_code]));
    } catch (error) { $("profileResults").appendChild(textNode("p", error.message, "error-box")); }
  }
  function applyProfileFilter(filter) {
    if (filter.quality) { state.qualityFilter = filter.quality; state.filters = []; }
    else { state.qualityFilter = "all"; state.filters = [{ column: filter.column, value: filter.value || "", mode: filter.mode || "exact" }]; }
    $("qualityFilter").value = state.qualityFilter; renderActiveFilters();
    if (state.results) refreshFilteredResults();
    else if (state.mappingSources.customer_id === "manual") cleanAndValidate();
    else {
      $("filterStatus").textContent = "Filter is ready. Confirm the required Customer ID mapping before records can be processed or downloaded.";
      $("mappingStatus").textContent = "Confirm Customer ID to run this recommended filter.";
      $("mappingSection").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (state.results) downloadFiltered();
  }
  function makeRunId() {
    return globalThis.crypto && typeof globalThis.crypto.randomUUID === "function" ? globalThis.crypto.randomUUID() : `run-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }
  function safeFilenamePart(value) {
    return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "value";
  }
  function filteredFilename() {
    const clauses = state.filters.map((filter) => `${safeFilenamePart(filter.column)}-${safeFilenamePart(filter.mode === "missing" ? "missing" : filter.value)}`);
    if (state.qualityFilter !== "all") clauses.push(safeFilenamePart(state.qualityFilter));
    return `customer_data_filtered_${clauses.length ? clauses.join("_and_").slice(0, 100) : "all"}.csv`;
  }
  function outputFileNames() {
    const filtered = filteredFilename();
    const sourceBase = safeFilenamePart(state.file ? state.file.name.replace(/\.[^.]+$/, "") : "customer-data");
    return {
      cleaned_dataset: "customer_data_cleaned.csv",
      filtered_dataset: filtered,
      validation_report: "validation_report.csv",
      filtered_validation_report: "filtered_validation_report.csv",
      exception_report: "exception_report.csv",
      processing_summary: "processing_summary.json",
      reports_workbook: `${sourceBase}_reports.xlsx`
    };
  }
  function downloadClean() {
    const rows = (state.results || []).filter((record) => record.status === "valid").map((record) => outputRow(record));
    downloadCsv(outputFileNames().cleaned_dataset, outputHeaders(), rows);
  }
  function downloadFiltered() {
    downloadCsv(outputFileNames().filtered_dataset, outputHeaders(true), state.filteredResults.map((record) => outputRow(record, true)));
  }
  function downloadValidation(filteredOnly = false) {
    if (filteredOnly) {
      const filtered = CdcCore.validationReport(state.filteredResults || [], state.filteredResults || []);
      downloadCsv(outputFileNames().filtered_validation_report, filtered.headers, filtered.rows);
    } else {
      const full = CdcCore.validationReport(state.results || [], state.filteredResults || []);
      downloadCsv(outputFileNames().validation_report, full.headers, full.rows);
    }
  }
  function downloadExceptions() {
    const report = CdcCore.exceptionReport(state.results || [], state.headers);
    downloadCsv(outputFileNames().exception_report, report.headers, report.rows);
  }
  function mappingDecisionArtifacts() {
    return Object.fromEntries(TARGETS.map((target) => {
      const suggestion = state.mappingSuggestions[target.key] || { header: "", kind: "none", confidence: "low", score: 0, rationale: "No recommendation available.", candidates: [] };
      return [target.key, {
        required: Boolean(target.required),
        selected_source_column: state.mappings[target.key] || null,
        decision: state.mappingSources[target.key] || "unmapped",
        suggested_source_column: suggestion.header || null,
        suggestion_type: suggestion.kind,
        confidence_category: suggestion.confidence,
        heuristic_score: suggestion.score,
        rationale: suggestion.rationale,
        inferred_source_type: suggestion.inferredType,
        type_compatible: suggestion.typeCompatible,
        ambiguous_candidates: suggestion.candidates
      }];
    }));
  }
  function downloadSummary() {
    const summary = CdcCore.processingSummary({
      runId: state.run.id,
      timestamp: state.run.timestamp,
      sourceFileName: state.file.name,
      records: state.results,
      filteredRecords: state.filteredResults,
      excludedRecords: state.excludedResults,
      mappings: state.mappings,
      filters: state.filters,
      mappingDecisions: mappingDecisionArtifacts(),
      qualityFilter: state.qualityFilter,
      outputFiles: outputFileNames()
    });
    summary.source_format = state.importTable.detectedFormat;
    summary.selected_worksheet = state.importTable.selectedWorksheet || null;
    summary.header_row = state.importTable.headerRow;
    summary.import_warnings = [...state.importTable.warnings];
    summary.applied_delimiter = state.importTable.delimiter || null;
    downloadText(outputFileNames().processing_summary, `${JSON.stringify(summary, null, 2)}\n`, "application/json;charset=utf-8");
  }

  async function downloadWorkbook() {
    try {
      const XLSX = await ensureSpreadsheetLibrary();
      const workbook = XLSX.utils.book_new();
      const addSheet = (name, headers, rows) => {
        const safeRows = rows.map((row) => row.map((value) => value == null ? "" : String(value)));
        const sheet = XLSX.utils.aoa_to_sheet([headers, ...safeRows], { cellDates: false });
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };
      const valid = (state.results || []).filter((record) => record.status === "valid");
      addSheet("Cleaned Data", outputHeaders(), valid.map((record) => outputRow(record)));
      addSheet("Filtered Data", outputHeaders(true), state.filteredResults.map((record) => outputRow(record, true)));
      const validation = CdcCore.validationReport(state.results || [], state.filteredResults || []);
      addSheet("Validation Report", validation.headers, validation.rows);
      const exceptions = CdcCore.exceptionReport(state.results || [], state.headers);
      if (exceptions.rows.length) addSheet("Exceptions", exceptions.headers, exceptions.rows);
      const summary = CdcCore.processingSummary({
        runId: state.run.id, timestamp: state.run.timestamp, sourceFileName: state.file.name,
        records: state.results, filteredRecords: state.filteredResults, excludedRecords: state.excludedResults,
        mappings: state.mappings, filters: state.filters,
        mappingDecisions: mappingDecisionArtifacts(),
        qualityFilter: state.qualityFilter, outputFiles: outputFileNames()
      });
      summary.source_format = state.importTable.detectedFormat;
      summary.selected_worksheet = state.importTable.selectedWorksheet || null;
      summary.header_row = state.importTable.headerRow;
      summary.import_warnings = [...state.importTable.warnings];
      const summaryRows = [["Property", "Value"], ...Object.entries(summary).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : String(value)])];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Processing Summary");
      const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
      downloadBlob(outputFileNames().reports_workbook, new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    } catch (error) {
      $("resultStatus").textContent = `The Excel report could not be generated: ${error.message || "Unknown workbook error."}`;
    }
  }

  function populateFilterColumns() {
    const select = $("filterColumn");
    select.replaceChildren();
    const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Choose a source column…"; select.appendChild(placeholder);
    state.headers.forEach((header) => { const option = document.createElement("option"); option.value = header; option.textContent = header; select.appendChild(option); });
    renderActiveFilters();
  }
  function renderActiveFilters() {
    const list = $("activeFilters"); list.replaceChildren();
    const visibleFilters = [...state.filters];
    if (state.qualityFilter !== "all") visibleFilters.push({ column: "Record status", value: state.qualityFilter, quality: true });
    if (!visibleFilters.length) {
      list.appendChild(textNode("span", "No active filters. All uploaded records will be included in the filtered view.", "caption"));
      return;
    }
    visibleFilters.forEach((filter, index) => {
      const chip = document.createElement("span"); chip.className = "filter-chip";
      const label = filter.quality ? `${filter.column}: ${filter.value}` : filter.mode === "missing" ? `${filter.column}: is blank` : `${filter.column}: ${filter.value}`;
      chip.appendChild(document.createTextNode(label));
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", `Remove filter ${label}`);
      remove.addEventListener("click", () => {
        if (filter.quality) state.qualityFilter = "all";
        else state.filters.splice(index, 1);
        $("qualityFilter").value = state.qualityFilter;
        refreshFilteredResults();
      });
      chip.appendChild(remove); list.appendChild(chip);
    });
  }
  function refreshFilteredResults() {
    renderActiveFilters();
    if (!state.results) {
      $("filterStatus").textContent = state.filters.length || state.qualityFilter !== "all"
        ? "Filters saved. Process the mapped file to calculate matching and excluded counts."
        : "Configure optional filters before processing.";
      return;
    }
    const selected = CdcCore.filterRecords(state.results, state.filters, state.qualityFilter);
    state.filteredResults = selected.matched;
    state.excludedResults = selected.excluded;
    $("filterStatus").textContent = `${selected.matched.length.toLocaleString()} records match; ${selected.excluded.length.toLocaleString()} records are excluded from the filtered view. Full-file results remain available.`;
    renderResults();
  }
  function addFilter() {
    const column = $("filterColumn").value;
    const value = $("filterValue").value.trim();
    if (!column) { $("filterStatus").textContent = "Choose a source column before adding a filter."; $("filterColumn").focus(); return; }
    if (!value) { $("filterStatus").textContent = "Enter an exact value to filter on."; $("filterValue").focus(); return; }
    if (!state.headers.includes(column)) { $("filterStatus").textContent = "The selected source column is no longer available."; return; }
    if (!state.filters.some((filter) => filter.column === column && CdcCore.normalizeLocation(filter.value) === CdcCore.normalizeLocation(value))) state.filters.push({ column, value });
    $("filterValue").value = "";
    refreshFilteredResults();
  }
  function resetFilters() {
    state.filters = []; state.qualityFilter = "all";
    $("qualityFilter").value = "all"; $("filterValue").value = "";
    refreshFilteredResults();
  }

  function activateTab(buttonId, paneId) {
    const tabs = [["validTab", "validPane"], ["filteredTab", "filteredPane"], ["exceptionTab", "exceptionPane"], ["changesTab", "changesPane"]];
    tabs.forEach(([tab, pane]) => { const active = tab === buttonId; $(tab).classList.toggle("active", active); $(tab).setAttribute("aria-selected", String(active)); $(tab).tabIndex = active ? 0 : -1; $(pane).hidden = pane !== paneId; });
  }
  function moveTab(event) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const tabIds = ["validTab", "filteredTab", "exceptionTab", "changesTab"];
    const current = tabIds.indexOf(event.currentTarget.id);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = tabIds[(current + offset + tabIds.length) % tabIds.length];
    const panes = { validTab: "validPane", filteredTab: "filteredPane", exceptionTab: "exceptionPane", changesTab: "changesPane" };
    event.preventDefault(); activateTab(next, panes[next]); $(next).focus();
  }

  fileInput.addEventListener("change", (event) => { const file = event.target.files[0]; loadFile(file); event.target.value = ""; });
  $("worksheetSelect").addEventListener("change", reparseSelection);
  $("headerRowInput").addEventListener("change", reparseSelection);
  $("delimiterSelect").addEventListener("change", reparseSelection);
  ["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove("dragging"); }));
  dropZone.addEventListener("drop", (event) => { const file = event.dataTransfer.files[0]; loadFile(file); });
  $("replaceFile").addEventListener("click", () => fileInput.click());
  $("profileButton").addEventListener("click", profileData);
  $("previewPrevious").addEventListener("click", () => { if (state.previewPage > 0) { state.previewPage--; renderPreview(); } });
  $("previewNext").addEventListener("click", () => { if ((state.previewPage + 1) * PROFILE_PAGE_SIZE < state.rows.length) { state.previewPage++; renderPreview(); } });
  $("downloadProfileSummary").addEventListener("click", downloadProfileSummary);
  $("downloadProfileJson").addEventListener("click", downloadProfileJson);
  $("downloadColumnQuality").addEventListener("click", downloadColumnQuality);
  $("downloadProfileFindings").addEventListener("click", downloadProfileFindings);
  $("columnSearch").addEventListener("input", renderColumnQuality);
  $("columnSort").addEventListener("change", renderColumnQuality);
  $("mappingUseCase").addEventListener("change", renderMappingRecommendations);
  $("addMapping").addEventListener("click", () => {
    const target = TARGETS.find((item) => !item.required && !state.mappingRows.includes(item.key));
    if (target) addMappingTarget(target.key);
  });
  $("addHighConfidenceMappings").addEventListener("click", () => {
    TARGETS.filter((target) => !target.required && !state.mappingRows.includes(target.key)).forEach((target) => {
      const suggestion = state.mappingSuggestions[target.key];
      if (suggestion && suggestion.recommendable && suggestion.confidence === "high") addMappingTarget(target.key, suggestion.header, true);
    });
  });
  $("cleanButton").addEventListener("click", cleanAndValidate);
  $("downloadClean").addEventListener("click", downloadClean);
  $("downloadFiltered").addEventListener("click", downloadFiltered);
  $("downloadValidation").addEventListener("click", () => downloadValidation(false));
  $("downloadFilteredValidation").addEventListener("click", () => downloadValidation(true));
  $("downloadExceptions").addEventListener("click", downloadExceptions);
  $("downloadSummary").addEventListener("click", downloadSummary);
  $("downloadXlsx").addEventListener("click", downloadWorkbook);
  $("filterColumn").addEventListener("change", () => { $("filterValue").focus(); });
  $("filterValue").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addFilter(); } });
  $("addFilter").addEventListener("click", addFilter);
  $("qualityFilter").addEventListener("change", () => { state.qualityFilter = $("qualityFilter").value; refreshFilteredResults(); });
  $("resetFilters").addEventListener("click", resetFilters);
  $("validTab").addEventListener("click", () => activateTab("validTab", "validPane"));
  $("filteredTab").addEventListener("click", () => activateTab("filteredTab", "filteredPane"));
  $("exceptionTab").addEventListener("click", () => activateTab("exceptionTab", "exceptionPane"));
  $("changesTab").addEventListener("click", () => activateTab("changesTab", "changesPane"));
  ["validTab", "filteredTab", "exceptionTab", "changesTab"].forEach((id) => $(id).addEventListener("keydown", moveTab));
})();
