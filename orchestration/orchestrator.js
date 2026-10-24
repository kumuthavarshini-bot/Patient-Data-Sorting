"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const core = require("../demo-core.js");

const ROOT = path.resolve(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "workflow.config.json"), "utf8"));
const PHASES = CONFIG.execution;
const safeId = (value) => /^[A-Za-z0-9_-]{1,80}$/.test(value);
const mkdir = (dir) => fs.mkdirSync(dir, { recursive: true });
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const hashFile = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function csv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(core.csvEscape).join(",")).join("\r\n") + "\r\n";
}
function profileDataset(dataset) {
  return {
    headers: dataset.headers,
    rowCount: dataset.rows.length,
    columns: dataset.headers.map((name, index) => {
      const vals = dataset.rows.map((row) => row[index]);
      const nonblank = vals.filter((value) => value.trim() !== "");
      const numeric = nonblank.length > 0 && nonblank.every((value) => /^-?\d+(\.\d+)?$/.test(value.trim()));
      return { name, type: nonblank.length === 0 ? "empty" : numeric ? "numeric-looking text" : "text/mixed", missingCount: vals.length - nonblank.length, distinctNonblankCount: new Set(nonblank).size };
    })
  };
}
function proposeMappings(headers) {
  const aliases = { customer_id: ["customer id", "customer_id", "customerid", "id", "client id", "client_id"] };
  const norm = (s) => core.normalizeHeader(String(s).replace(/_/g, " "));
  return Object.entries(aliases).map(([target, names]) => {
    const matches = headers.filter((header) => names.includes(norm(header)));
    return { target, source: matches.length === 1 ? matches[0] : null, confidence: matches.length === 1 ? "high" : matches.length ? "ambiguous" : "missing", candidates: matches };
  });
}
function validateHandoff(value, expectedRun, expectedStep) {
  if (!value || value.runId !== expectedRun || value.stepId !== expectedStep || !Array.isArray(value.findings)) throw new Error(`Invalid handoff contract at ${expectedStep}.`);
  return value;
}

async function execute({ inputFile, mappings, approved = false, outputRoot = path.join(ROOT, "runs"), runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${crypto.randomBytes(4).toString("hex")}` }) {
  if (!inputFile || !fs.existsSync(inputFile)) throw new Error("Provide an existing CSV input file.");
  if (!safeId(runId)) throw new Error("Run ID must contain only letters, digits, underscores, or hyphens.");
  const outputBase = path.resolve(outputRoot);
  const runDir = path.resolve(outputBase, runId);
  if (!runDir.startsWith(`${outputBase}${path.sep}`)) throw new Error("Unsafe run output path.");
  if (fs.existsSync(runDir)) throw new Error(`Run directory already exists: ${runId}`);
  mkdir(runDir);
  for (const dir of ["agent-results", "validation", "artifacts"]) mkdir(path.join(runDir, dir));
  const startedAt = new Date().toISOString();
  const events = [];
  const stepStarts = new Map();
  const statuses = Object.fromEntries(PHASES.map((phase) => [phase, "PENDING"]));
  const agentSkills = CONFIG.agents.map((agent) => ({ id: agent.id, version: agent.version, instruction: agent.instruction, instructionSha256: hashFile(path.join(ROOT, agent.instruction)), skill: agent.skill, skillSha256: hashFile(path.join(ROOT, agent.skill)) }));
  const manifest = { runId, startedAt, application: CONFIG.id, workflowVersion: CONFIG.version, configVersion: CONFIG.version, schemaVersion: CONFIG.schemaVersion, ruleVersion: CONFIG.ruleVersion, input: { sha256: hashFile(inputFile), bytes: fs.statSync(inputFile).size }, agentSkills, phases: statuses, artifacts: ["run-manifest.json", "workflow-events.jsonl", "workflow-summary.md"], finalStatus: "RUNNING" };
  const emit = (phaseId, status, details = {}) => {
    const timestamp = new Date();
    if (status === "RUNNING") stepStarts.set(phaseId, timestamp);
    const started = stepStarts.get(phaseId);
    const event = { runId, stepId: phaseId, agentId: ({ profile: "profile", mapping: "mapping", normalization: "normalization", validation: "validation", exceptions: "exception" })[phaseId] || null, instructionVersion: CONFIG.version, timestamp: timestamp.toISOString(), status, ...(status === "RUNNING" ? {} : { startedAt: (started || timestamp).toISOString(), completedAt: timestamp.toISOString(), durationMs: timestamp - (started || timestamp) }), ...details };
    events.push(event); statuses[phaseId] = status;
  };
  const saveEvents = () => fs.writeFileSync(path.join(runDir, "workflow-events.jsonl"), events.map((event) => JSON.stringify(event)).join("\n") + "\n");
  const artifact = (relative, content) => { const target = path.join(runDir, relative); mkdir(path.dirname(target)); fs.writeFileSync(target, content); manifest.artifacts.push(relative); return relative; };
  try {
    emit("upload", "RUNNING");
    let raw = fs.readFileSync(inputFile);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(raw).replace(/^\uFEFF/, "");
    if (text.includes("\0")) throw new Error("CSV contains null bytes.");
    const dataset = core.parseCsv(text);
    emit("upload", "PASSED", { rowCount: dataset.rows.length, columnCount: dataset.headers.length, durationMs: 0 });
    const recordRef = `sha256:${manifest.input.sha256}`;

    emit("profile", "RUNNING");
    const profile = profileDataset(dataset);
    const profileOutput = { runId, stepId: "profile", agentId: "profile", agentVersion: "1.0.0", inputRefs: [recordRef], outputRefs: ["profile-report.json"], status: "PASSED", findings: [], profile };
    validateHandoff(profileOutput, runId, "profile");
    manifest.artifacts.push("agent-results/profile-report.json");
    writeJson(path.join(runDir, "agent-results/profile-report.json"), profileOutput);
    artifact("artifacts/profile-report.md", `# Profile report\n\nRun: ${runId}\n\nRows: ${profile.rowCount}\n\n| Column | Inferred type | Missing | Distinct nonblank |\n|---|---|---:|---:|\n${profile.columns.map((c) => `| ${c.name.replace(/\|/g, "\\|")} | ${c.type} | ${c.missingCount} | ${c.distinctNonblankCount} |`).join("\n")}\n`);
    emit("profile", "PASSED", { rowCount: dataset.rows.length });

    emit("mapping", "RUNNING");
    const proposals = proposeMappings(dataset.headers);
    const effectiveMappings = mappings || {};
    const selected = effectiveMappings.customer_id || (proposals[0].confidence === "high" ? proposals[0].source : "");
    const mappingOutput = { runId, stepId: "mapping", agentId: "mapping", agentVersion: "1.0.0", inputRefs: ["profile-report.json"], outputRefs: ["mapping-proposal.json"], findings: proposals.filter((proposal) => proposal.confidence !== "high"), proposals, mapping: selected ? { customer_id: selected } : {}, approved: Boolean(approved), status: selected && approved ? "PASSED" : "NEEDS_REVIEW" };
    validateHandoff(mappingOutput, runId, "mapping");
    manifest.artifacts.push("agent-results/mapping-proposal.json");
    writeJson(path.join(runDir, "agent-results/mapping-proposal.json"), mappingOutput);
    if (!selected || !approved) {
      emit("mapping", "NEEDS_REVIEW", { reason: !selected ? "A unique Customer ID mapping was not found." : "Explicit mapping approval is required." });
      PHASES.slice(PHASES.indexOf("mapping") + 1).forEach((phase) => emit(phase, "BLOCKED", { reason: "Upstream mapping approval gate did not pass." }));
      manifest.finalStatus = "NEEDS_REVIEW";
      manifest.finishedAt = new Date().toISOString();
      manifest.outputRecordCount = null;
      writeJson(path.join(runDir, "run-manifest.json"), manifest); saveEvents();
      fs.writeFileSync(path.join(runDir, "workflow-summary.md"), `# Workflow stopped for human review\n\nRun: ${runId}\n\nThe mapping agent did not proceed without an explicit Customer ID mapping approval. No normalization or validation outputs were created.\n`);
      return { runDir, manifest };
    }
    if (!dataset.headers.includes(selected)) throw new Error("Approved Customer ID mapping references a missing source column.");
    emit("mapping", "PASSED", { approved: true, targetCount: 1 });

    emit("normalization", "RUNNING");
    const results = core.processRows(dataset.headers, dataset.rows, { customer_id: selected }, dataset.sourceRows);
    const normalized = { runId, stepId: "normalization", agentId: "normalization", agentVersion: "1.0.0", inputRefs: ["mapping-proposal.json", recordRef], outputRefs: ["normalized-records.csv", "normalization-report.json"], status: "PASSED", findings: [], rowCount: results.length, transformations: results.reduce((sum, row) => sum + row.changes.length, 0), originalValuesPreserved: true };
    validateHandoff(normalized, runId, "normalization");
    manifest.artifacts.push("agent-results/normalization-report.json");
    writeJson(path.join(runDir, "agent-results/normalization-report.json"), normalized);
    artifact("artifacts/normalized-records.csv", csv(["source_row", ...dataset.headers.map((h) => `source:${h}`), "normalized_customer_id"], results.map((row) => [row.rowNumber, ...row.values, row.canonical.customer_id || ""])));
    emit("normalization", "PASSED", { rowCount: results.length, transformations: normalized.transformations });

    emit("validation", "RUNNING");
    const eligible = results.filter((record) => record.errors.length === 0);
    const invalid = results.filter((record) => record.errors.length > 0);
    const validation = { runId, stepId: "validation", agentId: "validation", agentVersion: "1.0.0", inputRefs: ["normalized-records.csv"], outputRefs: ["validation-report.json", "validated-records.csv"], status: "PASSED", findings: [], inputCount: results.length, eligibleCount: eligible.length, invalidCount: invalid.length, reconciled: eligible.length + invalid.length === results.length, records: results.map((row) => ({ sourceRow: row.rowNumber, status: row.errors.length ? "INVALID" : "ELIGIBLE", codes: row.errors.map((error) => error.code) })) };
    if (!validation.reconciled) throw new Error("Validation counts did not reconcile to source rows.");
    validateHandoff(validation, runId, "validation");
    manifest.artifacts.push("validation/validation-report.json");
    writeJson(path.join(runDir, "validation/validation-report.json"), validation);
    artifact("artifacts/validated-records.csv", csv(["source_row", ...dataset.headers.map((h) => `source:${h}`), "normalized_customer_id"], eligible.map((row) => [row.rowNumber, ...row.values, row.canonical.customer_id])));
    emit("validation", "PASSED", { inputCount: results.length, eligibleCount: eligible.length, invalidCount: invalid.length, reconciled: true });

    emit("exceptions", "RUNNING");
    const exceptions = { runId, stepId: "exceptions", agentId: "exception", agentVersion: "1.0.0", inputRefs: ["validation-report.json"], outputRefs: ["exception-register.json", "exception-report.md", "exceptions.csv"], status: "PASSED", findings: [], count: invalid.length, items: invalid.map((row) => ({ sourceRow: row.rowNumber, status: "UNRESOLVED", codes: row.errors.map((error) => error.code), reasons: row.errors.map((error) => error.message) })) };
    validateHandoff(exceptions, runId, "exceptions");
    manifest.artifacts.push("agent-results/exception-register.json");
    writeJson(path.join(runDir, "agent-results/exception-register.json"), exceptions);
    artifact("artifacts/exceptions.csv", csv(["source_row", "customer_id", "rule_codes", "reasons", ...dataset.headers.map((h) => `source:${h}`)], invalid.map((row) => [row.rowNumber, row.canonical.customer_id || "", row.errors.map((error) => error.code).join(";"), row.errors.map((error) => error.message).join(" "), ...row.values])));
    artifact("artifacts/exception-report.md", `# Exception report\n\nRun: ${runId}\n\nRows requiring correction: ${invalid.length}\n\n${invalid.map((row) => `- Source row ${row.rowNumber}: ${row.errors.map((error) => `${error.code} ${error.message}`).join("; ")}`).join("\n") || "No exceptions found."}\n`);
    emit("exceptions", "PASSED", { exceptionCount: invalid.length });

    emit("import", "BLOCKED", { reason: "No import destination or service contract is configured; this run stops at local export readiness." });
    manifest.phases = statuses;
    manifest.finishedAt = new Date().toISOString();
    manifest.outputRecordCount = results.length;
    manifest.counts = { input: results.length, eligible: eligible.length, invalid: invalid.length, exceptions: invalid.length };
    manifest.finalStatus = "READY_FOR_REVIEW";
    writeJson(path.join(runDir, "run-manifest.json"), manifest); saveEvents();
    fs.writeFileSync(path.join(runDir, "workflow-summary.md"), `# Synthetic/local workflow run\n\n- Run ID: ${runId}\n- Status: ${manifest.finalStatus}\n- Input rows: ${results.length}\n- Eligible for preview: ${eligible.length}\n- Invalid rows: ${invalid.length}\n- Import: blocked (no destination configured)\n\nFiles are local only. Review and approve records before any downstream import.\n`);
    return { runDir, manifest };
  } catch (error) {
    const active = PHASES.find((phase) => statuses[phase] === "RUNNING");
    if (active) emit(active, "FAILED", { errorCode: "STEP_FAILED", message: error.message });
    manifest.phases = statuses; manifest.finalStatus = "FAILED"; manifest.finishedAt = new Date().toISOString();
    writeJson(path.join(runDir, "run-manifest.json"), manifest); saveEvents();
    fs.writeFileSync(path.join(runDir, "workflow-summary.md"), `# Workflow failed\n\nRun: ${runId}\n\n${error.message}\n`);
    throw Object.assign(error, { runDir });
  }
}

module.exports = { execute, profileDataset, proposeMappings, validateHandoff, CONFIG };

if (require.main === module) {
  const args = process.argv.slice(2);
  const inputFile = args.find((arg) => !arg.startsWith("--"));
  const approved = args.includes("--approve-mappings");
  const mappingIndex = args.indexOf("--customer-id-column");
  const mappings = mappingIndex >= 0 ? { customer_id: args[mappingIndex + 1] } : undefined;
  if (args.includes("--help") || !inputFile) {
    console.log("Usage: node orchestration/orchestrator.js <input.csv> [--customer-id-column <header>] --approve-mappings");
    process.exitCode = inputFile ? 0 : 2;
  } else {
    execute({ inputFile: path.resolve(inputFile), mappings, approved }).then(({ runDir, manifest }) => {
      console.log(`${manifest.finalStatus}: ${manifest.runId}\nEvidence: ${path.relative(ROOT, runDir)}`);
    }).catch((error) => { console.error(`${error.message}${error.runDir ? `\nEvidence: ${path.relative(ROOT, error.runDir)}` : ""}`); process.exitCode = 1; });
  }
}
