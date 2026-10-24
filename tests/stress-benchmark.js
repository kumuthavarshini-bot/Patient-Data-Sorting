"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const core = require("../demo-core.js");
const chat = require("../chat-core.js");

const HEADERS = ["Customer ID", "First Name", "Last Name", "City", "Email", "Phone"];
const MAPPINGS = { customer_id: "Customer ID", full_name: "First Name", email: "Email", phone: "Phone" };
const CITIES = ["Newark", "Secaucus", "New York", "Edison"];
const LEVELS = [100, 1000, 5000, 10000, 25000, 50000, 100000];

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function makeCsv(rowCount, options = {}) {
  const lines = [HEADERS.join(",")];
  for (let index = 0; index < rowCount; index++) {
    const number = index + 1;
    let id = `C${String(number).padStart(8, "0")}`;
    if (options.missingEvery && number % options.missingEvery === 0) id = "";
    if (options.duplicateTail && index >= rowCount - options.duplicateTail) {
      id = `C${String(index - options.duplicateTail + 1).padStart(8, "0")}`;
    }
    const values = [
      id,
      index % 1000 === 0 ? "Zoë" : `Synthetic${number}`,
      index % 997 === 0 ? "Rao, Jr." : `Record${number}`,
      CITIES[index % CITIES.length],
      `user${String(number).padStart(8, "0")}@example.test`,
      `555-${String(number % 10000).padStart(4, "0")}`
    ];
    lines.push(values.map(csvCell).join(","));
  }
  return lines.join("\n");
}

function serializeResults(results) {
  const headers = ["source_row", "customer_id", "full_name", "email", "phone", ...HEADERS.map((header) => `source:${header}`), "normalization_log"];
  const rows = results.map((record) => [
    record.rowNumber,
    record.canonical.customer_id,
    record.canonical.full_name,
    record.canonical.email,
    record.canonical.phone,
    ...record.values,
    record.changes.map((change) => `${change.target}: ${change.rule}`).join(" | ")
  ]);
  return [headers, ...rows].map((row) => row.map(core.csvEscape).join(",")).join("\r\n");
}

function median(values) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

function report(test, details) {
  console.log(JSON.stringify({ test, ...details }));
}

function runStepLoad() {
  for (const rowCount of LEVELS) {
    const csv = makeCsv(rowCount);
    const parseTimes = [], processingTimes = [], serializationTimes = [];
    let exportBytes = 0;
    for (let trial = 0; trial < 3; trial++) {
      let started = performance.now();
      const parsed = core.parseCsv(csv);
      parseTimes.push(performance.now() - started);
      assert.equal(parsed.headers.length, HEADERS.length);
      assert.equal(parsed.rows.length, rowCount);

      started = performance.now();
      const results = core.processRows(parsed.headers, parsed.rows, MAPPINGS);
      processingTimes.push(performance.now() - started);
      assert.equal(results.length, rowCount);
      assert.equal(results.filter((record) => record.errors.length).length, 0);
      for (let index = 0; index < rowCount; index++) {
        assert.deepEqual(results[index].values, parsed.rows[index]);
        assert.equal(results[index].canonical.customer_id, parsed.rows[index][0]);
      }

      for (let cityIndex = 0; cityIndex < CITIES.length; cityIndex++) {
        const expected = Math.floor(rowCount / 4) + (cityIndex < rowCount % 4 ? 1 : 0);
        assert.equal(core.countLocationRecords(parsed, CITIES[cityIndex]).count, expected);
      }
      assert.equal(core.countLocationRecords(parsed, "NoSuchCity").count, 0);

      started = performance.now();
      const serialized = serializeResults(results);
      serializationTimes.push(performance.now() - started);
      exportBytes = Buffer.byteLength(serialized, "utf8");
      assert.equal(serialized.split("\r\n").length, rowCount + 1);
      if (global.gc) global.gc();
    }
    report("ST-02/03", {
      status: "PASS",
      rows: rowCount,
      inputBytes: Buffer.byteLength(csv, "utf8"),
      exportSerializationBytes: exportBytes,
      trials: 3,
      parseMedianMs: +median(parseTimes).toFixed(2),
      processMedianMs: +median(processingTimes).toFixed(2),
      exportSerializationMedianMs: +median(serializationTimes).toFixed(2),
      validRows: rowCount,
      invalidRows: 0,
      locationCounts: Object.fromEntries(CITIES.map((city, index) => [city, Math.floor(rowCount / 4) + (index < rowCount % 4 ? 1 : 0)]).concat([["NoSuchCity", 0]])),
      nodeHeapUsedBytesAfterGc: process.memoryUsage().heapUsed
    });
  }
}

function runSupplementalChecks() {
  const repeated = makeCsv(10000);
  const repeatedTimes = [];
  for (let iteration = 0; iteration < 10; iteration++) {
    const parsed = core.parseCsv(repeated);
    const started = performance.now();
    const results = core.processRows(parsed.headers, parsed.rows, MAPPINGS);
    const output = serializeResults(results);
    repeatedTimes.push(performance.now() - started);
    assert.equal(results.length, 10000);
    assert.equal(output.split("\r\n").length, 10001);
  }
  report("ST-04", { status: "PASS", rowsPerRun: 10000, repeats: 10, processAndSerializationMs: { runs: repeatedTimes.map((time) => +time.toFixed(2)), min: +Math.min(...repeatedTimes).toFixed(2), median: +median(repeatedTimes).toFixed(2), max: +Math.max(...repeatedTimes).toFixed(2) } });

  const replacementRows = [];
  for (const rowCount of [1000, 10000, 100, 5000]) {
    const parsed = core.parseCsv(makeCsv(rowCount));
    const results = core.processRows(parsed.headers, parsed.rows, MAPPINGS);
    assert.equal(results.length, rowCount);
    replacementRows.push(results.length);
  }
  report("ST-05", { status: "PASS", replacementSequenceRows: replacementRows });

  assert.throws(() => core.parseCsv(""), /header row/);
  assert.throws(() => core.parseCsv('id,city\n1,"bad'), /not closed/);
  const recovered = core.parseCsv(makeCsv(100));
  assert.equal(core.processRows(recovered.headers, recovered.rows, MAPPINGS).length, 100);
  report("ST-07", { status: "PASS", errorRecoveryRows: 100 });

  for (const every of [100, 10]) {
    const parsed = core.parseCsv(makeCsv(1000, { missingEvery: every }));
    const results = core.processRows(parsed.headers, parsed.rows, MAPPINGS);
    assert.equal(results.filter((record) => record.errors.some((error) => error.code === "BR-01")).length, 1000 / every);
  }
  for (const percent of [1, 5]) {
    const duplicateCount = 1000 * percent / 100;
    const parsed = core.parseCsv(makeCsv(1000, { duplicateTail: duplicateCount }));
    const results = core.processRows(parsed.headers, parsed.rows, MAPPINGS);
    assert.equal(results.filter((record) => record.errors.some((error) => error.code === "BR-02")).length, duplicateCount * 2);
  }
  report("ST-08", { status: "PASS", rows: 1000, missingIdRatesPercent: [1, 10], duplicateInjectedRatesPercent: [1, 5] });

  const knowledgePath = path.join(__dirname, "../input/customer_data_cleaner_chatbot_approved_qa.json");
  const knowledgeBase = JSON.parse(fs.readFileSync(knowledgePath, "utf8"));
  const entries = chat.availableEntries(knowledgeBase.entries);
  const latencies = [];
  const variants = Array.from({ length: 50 }, (_, index) => {
    const entry = entries[index % entries.length];
    const question = index % 3 === 0 ? `  ${entry.question.toUpperCase()}  ` : index % 3 === 1 ? `${entry.question.replace(/[?!.]+$/, "")}!` : ` ${entry.question} `;
    return { question, id: entry.id };
  });
  for (let index = 0; index < 60; index++) {
    const sample = variants[index % variants.length];
    const started = performance.now();
    const match = chat.matchQuestion(sample.question, entries);
    latencies.push(performance.now() - started);
    assert.equal(match && match.id, sample.id);
  }
  latencies.sort((a, b) => a - b);
  report("ST-10", { status: "PASS", requests: 60, externalRequests: 0, latencyMs: { p50: +latencies[30].toFixed(4), p95: +latencies[56].toFixed(4) } });

  for (const columnCount of [50, 200]) {
    const headers = ["Customer ID", ...Array.from({ length: columnCount - 1 }, (_, index) => `Extra ${index + 1}`)];
    const lines = [headers.join(",")];
    for (let row = 1; row <= 100; row++) lines.push([`C${row}`, ...Array.from({ length: columnCount - 1 }, (_, index) => `v${row}_${index}`)].join(","));
    const parsed = core.parseCsv(lines.join("\n"));
    assert.equal(parsed.headers.length, columnCount);
    assert.equal(parsed.rows.length, 100);
  }
  report("ST-13", { status: "PASS", rows: 100, testedColumnCounts: [50, 200], scope: "parser only" });
}

try {
  runStepLoad();
  runSupplementalChecks();
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", error: error.message, stack: error.stack }));
  process.exitCode = 1;
}
