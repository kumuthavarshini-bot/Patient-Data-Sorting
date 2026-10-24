const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execute, proposeMappings, validateHandoff } = require("../orchestration/orchestrator.js");

function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), "cdc-run-test-")); }

test("mapping agent suggests only a unique recognized Customer ID header", () => {
  assert.deepEqual(proposeMappings(["customer_id"])[0], { target: "customer_id", source: "customer_id", confidence: "high", candidates: ["customer_id"] });
  assert.equal(proposeMappings(["ID", "Customer ID"])[0].confidence, "ambiguous");
  assert.equal(proposeMappings(["Name"])[0].confidence, "missing");
});

test("handoff contract rejects wrong run or step", () => {
  assert.throws(() => validateHandoff({ runId: "r", stepId: "profile", findings: [] }, "other", "profile"), /Invalid handoff/);
});

test("orchestrator runs profile, mapping, normalization, validation and exception artifacts with reconciled counts", async () => {
  const root = tempDir();
  const fixture = path.resolve(__dirname, "fixtures/synthetic-customers.csv");
  const { runDir, manifest } = await execute({ inputFile: fixture, mappings: { customer_id: "Customer ID" }, approved: true, outputRoot: root, runId: "synthetic-run" });
  assert.equal(manifest.finalStatus, "READY_FOR_REVIEW");
  assert.deepEqual(manifest.counts, { input: 4, eligible: 1, invalid: 3, exceptions: 3 });
  assert.equal(manifest.phases.import, "BLOCKED");
  assert.equal(manifest.agentSkills.length, 5);
  assert.ok(fs.existsSync(path.join(runDir, "workflow-events.jsonl")));
  assert.ok(fs.existsSync(path.join(runDir, "artifacts/validated-records.csv")));
  const report = JSON.parse(fs.readFileSync(path.join(runDir, "validation/validation-report.json"), "utf8"));
  assert.equal(report.eligibleCount + report.invalidCount, report.inputCount);
  assert.equal(report.reconciled, true);
  assert.equal(fs.readFileSync(fixture, "utf8").includes("Sample Customer One"), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test("orchestrator pauses for explicit mapping approval and blocks dependent phases", async () => {
  const root = tempDir();
  const fixture = path.resolve(__dirname, "fixtures/synthetic-customers.csv");
  const { manifest } = await execute({ inputFile: fixture, mappings: { customer_id: "Customer ID" }, outputRoot: root, runId: "needs-approval" });
  assert.equal(manifest.finalStatus, "NEEDS_REVIEW");
  assert.equal(manifest.phases.normalization, "BLOCKED");
  assert.equal(manifest.phases.validation, "BLOCKED");
  fs.rmSync(root, { recursive: true, force: true });
});

test("malformed CSV fails and leaves a machine-readable failure summary", async () => {
  const root = tempDir();
  const fixture = path.join(root, "bad.csv");
  fs.writeFileSync(fixture, 'id,name\n1,"open');
  await assert.rejects(execute({ inputFile: fixture, mappings: { customer_id: "id" }, approved: true, outputRoot: path.join(root, "runs"), runId: "malformed" }), /not closed/i);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "runs/malformed/run-manifest.json"), "utf8"));
  assert.equal(manifest.finalStatus, "FAILED");
  fs.rmSync(root, { recursive: true, force: true });
});
