const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../demo-core.js");
const importer = require("../spreadsheet-importer.js");

class MockElement {
  constructor(tagName = "div", id = "") {
    this.tagName = tagName;
    this.id = id;
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.dataset = {};
    this._text = "";
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.className = "";
    this.tabIndex = 0;
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  get options() { return this.children.filter((child) => child.tagName === "option"); }
  get textContent() { return this._text + this.children.map((child) => child.textContent || "").join(""); }
  set textContent(value) { this._text = String(value); this.children = []; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this._text = ""; this.children = [...nodes]; }
  addEventListener(type, listener) { const list = this.listeners.get(type) || []; list.push(listener); this.listeners.set(type, list); }
  async dispatch(type, event = {}) {
    const payload = { target: this, currentTarget: this, preventDefault() {}, ...event };
    for (const listener of this.listeners.get(type) || []) await listener(payload);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() {}
  scrollIntoView() {}
  click() { this.clicked = true; }
  remove() { this.removed = true; }
}

async function startDemo() {
  const html = fs.readFileSync(path.join(__dirname, "../demo.html"), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const elements = Object.fromEntries(ids.map((id) => [id, new MockElement("div", id)]));
  elements.fileInput = new MockElement("input", "fileInput");
  elements.dropZone = new MockElement("label", "dropZone");
  elements.cleanButton.disabled = true;
  const downloads = [];
  const downloadLinks = [];
  const body = new MockElement("body", "body");
  const document = {
    body,
    getElementById(id) { if (!elements[id]) elements[id] = new MockElement("div", id); return elements[id]; },
    createElement(tag) {
      const element = new MockElement(tag);
      if (tag === "a") element.click = () => downloadLinks.push({ filename: element.download, blob: MockURL.lastBlob });
      return element;
    },
    createTextNode(text) { return { textContent: String(text) }; }
  };
  const MockBlob = class { constructor(parts, options) { this.parts = parts; this.options = options; downloads.push(this); } };
  const MockURL = { createObjectURL(blob) { MockURL.lastBlob = blob; return "blob:synthetic"; }, revokeObjectURL() {} };
  const window = { addEventListener() {}, dispatchEvent() {} };
  const context = {
    document, window, CdcCore: core, CdcImporter: importer, TextDecoder, Event: class {}, Blob: MockBlob, URL: MockURL,
    setTimeout() { return 1; }, clearTimeout() {}, console, Date, Math
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../demo.js"), "utf8"), context, { filename: "demo.js" });
  return { elements, downloads, downloadLinks, context, body, window };
}
function mappingSelect(app, id) {
  for (const row of app.elements.mappingList.children) {
    for (const child of row.children) if (child.id === id) return child;
  }
  throw new Error(`Mapping control ${id} was not rendered`);
}

test("uploaded CSV requires explicit Customer ID mapping, filters real rows, and emits report downloads", async () => {
  const app = await startDemo();
  const csv = "Customer Number,City,Email\nC1, Newark ,person@example.test\nC2,Secaucus,not-an-email";
  const file = {
    name: "synthetic customers.csv", type: "text/csv", size: Buffer.byteLength(csv),
    async arrayBuffer() { const buffer = Buffer.from(csv); return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); }
  };
  const fileEventTarget = { files: [file], value: "selected" };
  await app.elements.fileInput.dispatch("change", { target: fileEventTarget });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.elements.previewSection.hidden, false);
  assert.match(app.elements.fileSummary.textContent, /Rows:\s*2/);

  await app.elements.profileButton.dispatch("click");
  assert.equal(app.elements.mappingSection.hidden, false);
  assert.equal(mappingSelect(app, "map-customer_id").value, "", "a suggestion must not count as explicit Customer ID approval");
  assert.equal(app.elements.cleanButton.disabled, true);
  mappingSelect(app, "map-customer_id").value = "Customer Number";
  await mappingSelect(app, "map-customer_id").dispatch("change");
  await app.elements.addMapping.dispatch("click");
  const optionalRow = app.elements.mappingList.children.find((row) => row.children.some((child) => child.id === "target-full_name"));
  const targetSelector = optionalRow.children.find((child) => child.id === "target-full_name");
  targetSelector.value = "email";
  await targetSelector.dispatch("change");
  mappingSelect(app, "map-email").value = "Email";
  await mappingSelect(app, "map-email").dispatch("change");
  assert.equal(app.elements.cleanButton.disabled, false, "manual Customer ID selection enables processing immediately");

  assert.equal(app.elements.filterSection.hidden, false);
  app.elements.filterColumn.value = "City";
  app.elements.filterValue.value = "newark";
  await app.elements.addFilter.dispatch("click");
  app.elements.cleanButton.disabled = false;
  await app.elements.cleanButton.dispatch("click");
  assert.equal(app.elements.resultsSection.hidden, false);
  assert.match(app.elements.resultStatus.textContent, /Filtered subset: 1 valid, 0 need review, 0 invalid/);
  assert.match(app.elements.filteredPane.textContent, /C1/);
  assert.doesNotMatch(app.elements.filteredPane.textContent, /C2/);
  assert.match(app.elements.exceptionPane.textContent, /C2/);
  assert.match(app.elements.mappingStatus.textContent, /Processing completed locally/);

  await app.elements.downloadFiltered.dispatch("click");
  assert.match(app.downloadLinks.at(-1).filename, /^customer_data_filtered_city-newark\.csv$/);
  assert.match(app.downloadLinks.at(-1).blob.parts.join(""), /C1/);
  assert.doesNotMatch(app.downloadLinks.at(-1).blob.parts.join(""), /C2/);
  await app.elements.downloadExceptions.dispatch("click");
  assert.match(app.downloadLinks.at(-1).blob.parts.join(""), /source:Customer Number/);
  assert.match(app.downloadLinks.at(-1).blob.parts.join(""), /C2/);
  await app.elements.downloadSummary.dispatch("click");
  const summary = JSON.parse(app.downloadLinks.at(-1).blob.parts.join(""));
  assert.equal(summary.counts.input_rows, 2);
  assert.equal(summary.counts.filtered_rows, 1);
  assert.equal(summary.counts.excluded_by_filters, 1);
  assert.equal(summary.counts.needs_review_rows, 1);
  assert.equal(summary.mapping_decisions.customer_id.decision, "manual");
  assert.equal(summary.applied_filters[0].value, "newark");
});

test("mapping readiness blocks reused source columns and permits reset of active filters", async () => {
  const app = await startDemo();
  const csv = "Customer ID,Name\nC1,A";
  const file = { name: "synthetic.csv", type: "text/csv", size: csv.length, async arrayBuffer() { const b = Buffer.from(csv); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } };
  await app.elements.fileInput.dispatch("change", { target: { files: [file], value: "" } });
  await new Promise((resolve) => setImmediate(resolve));
  await app.elements.profileButton.dispatch("click");
  mappingSelect(app, "map-customer_id").value = "Customer ID";
  await mappingSelect(app, "map-customer_id").dispatch("change");
  await app.elements.addMapping.dispatch("click");
  mappingSelect(app, "map-full_name").value = "Customer ID";
  await mappingSelect(app, "map-full_name").dispatch("change");
  assert.equal(app.elements.cleanButton.disabled, true);
  assert.match(app.elements.mappingStatus.textContent, /multiple targets/);
  mappingSelect(app, "map-full_name").value = "";
  await mappingSelect(app, "map-full_name").dispatch("change");
  assert.equal(app.elements.cleanButton.disabled, false);
  app.elements.filterColumn.value = "Name";
  app.elements.filterValue.value = "A";
  await app.elements.addFilter.dispatch("click");
  assert.match(app.elements.activeFilters.textContent, /Name: A/);
  await app.elements.resetFilters.dispatch("click");
  assert.match(app.elements.activeFilters.textContent, /No active filters/);
});

test("upload automatically profiles a wide dataset, preserves columns and paginates the source preview", async () => {
  const app = await startDemo();
  const headers = ["Customer ID", ...Array.from({ length: 31 }, (_, index) => `Long descriptive customer source field ${String(index + 2).padStart(2, "0")}`)];
  const rows = Array.from({ length: 120 }, (_, rowIndex) => headers.map((_, columnIndex) => columnIndex === 0 ? `C${rowIndex + 1}` : `row-${rowIndex + 1}-field-${columnIndex + 1}`));
  rows[0][31] = "";
  const csv = [headers, ...rows].map((row) => row.map(core.csvEscape).join(",")).join("\r\n");
  const file = { name: "synthetic-wide.csv", type: "text/csv", size: Buffer.byteLength(csv), async arrayBuffer() { const buffer = Buffer.from(csv); return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); } };
  await app.elements.fileInput.dispatch("change", { target: { files: [file], value: "selected" } });
  await new Promise((resolve) => setImmediate(resolve));
  const profile = app.window.CdcDemoData.getCurrentProfile();
  assert.equal(profile.metadata.row_count, 120);
  assert.equal(profile.metadata.column_count, 32);
  assert.equal(profile.columns[31].missing_count, 1);
  assert.equal(app.elements.profileActions.hidden, false);
  assert.equal(app.elements.mappingSection.hidden, false);
  assert.equal(app.elements.mappingList.children.length, 1, "only required Customer ID is shown initially");
  assert.equal(app.elements.sourcePreview.children[0].children[0].children[0].children[0].children.length, 32, "all source columns remain present in the table");
  assert.equal(app.elements.sourcePreview.children[0].children[0].children[1].children.length, 50, "preview renders a manageable page without discarding rows");
  assert.equal(app.elements.previewPageInfo.textContent, "Page 1 of 3");
  await app.elements.previewNext.dispatch("click");
  assert.equal(app.elements.previewPageInfo.textContent, "Page 2 of 3");
  assert.equal(app.elements.sourcePreview.children[0].children[0].children[1].children[0].children[0].textContent, "C51");
  assert.equal(app.window.CdcDemoData.getCurrentDataset().rows.length, 120);
});

test("profile downloads contain aggregate data and recommended filters download the matching rows", async () => {
  const app = await startDemo();
  const csv = "Customer ID,City,Email\nC1,Newark,one@example.test\n,Newark,\ntwo,Secaucus,two@example.test";
  const file = { name: "synthetic-profile.csv", type: "text/csv", size: Buffer.byteLength(csv), async arrayBuffer() { const buffer = Buffer.from(csv); return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); } };
  await app.elements.fileInput.dispatch("change", { target: { files: [file], value: "selected" } });
  await new Promise((resolve) => setImmediate(resolve));
  const profile = app.window.CdcDemoData.getCurrentProfile();
  assert.equal(profile.counts.blank_cells, 2);
  assert.equal(profile.counts.missing_customer_id_records, 1);
  assert.equal(profile.findings[0].source_row, 3);
  await app.elements.downloadProfileJson.dispatch("click");
  const exportedProfile = JSON.parse(app.downloadLinks.at(-1).blob.parts.join(""));
  assert.equal(exportedProfile.metadata.source_file, "synthetic-profile.csv");
  assert.doesNotMatch(JSON.stringify(exportedProfile), /one@example|Newark|C1/);
  await app.elements.downloadColumnQuality.dispatch("click");
  assert.match(app.downloadLinks.at(-1).blob.parts.join("").replace(/^\uFEFF/, ""), /"column","inferred_type","present_count"/);

  mappingSelect(app, "map-customer_id").value = "Customer ID";
  await mappingSelect(app, "map-customer_id").dispatch("change");
  const missingAction = app.elements.recommendedActions.children.find((card) => /Review missing Customer IDs/.test(card.textContent));
  const actionButton = missingAction.children.find((child) => child.tagName === "button");
  await actionButton.dispatch("click");
  assert.equal(app.elements.qualityFilter.value, "missing_id");
  assert.equal(app.downloadLinks.at(-1).filename, "customer_data_filtered_missing-id.csv");
  assert.match(app.downloadLinks.at(-1).blob.parts.join(""), /source_row.*Customer ID/);
  assert.match(app.downloadLinks.at(-1).blob.parts.join(""), /"Newark"/);
  assert.doesNotMatch(app.downloadLinks.at(-1).blob.parts.join(""), /C1/);
});
