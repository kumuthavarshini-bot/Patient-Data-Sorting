const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const workflow = require("../orchestration/ux-workflow.js");

test("UX evidence audit checks all ten stages without claiming research or usability execution", () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "cdc-ux-audit-"));
  const report = workflow.run({ output });
  assert.equal(report.stages.length, 10);
  assert.equal(report.status, "DOCUMENTATION_AUDIT_COMPLETE");
  assert.equal(report.researchConducted, false);
  assert.equal(report.usabilitySessionsConducted, false);
  assert.ok(report.stages.every((stage) => stage.status === "DOCUMENTED_DRAFT"));
  fs.rmSync(output, { recursive: true, force: true });
});
