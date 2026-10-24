"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ROOT = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "ux-workflow.config.json"), "utf8"));
function run({ output = path.join(ROOT, "runs", `ux-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomBytes(3).toString("hex")}`) } = {}) {
  fs.mkdirSync(output, { recursive: true });
  const stages = config.stages.map((stage) => {
    const missing = stage.outputs.filter((file) => !fs.existsSync(path.join(ROOT, file)));
    return { id: stage.id, execution: stage.execution, status: missing.length ? "BLOCKED" : "DOCUMENTED_DRAFT", outputs: stage.outputs, missing };
  });
  const report = { workflowId: config.id, version: config.version, generatedAt: new Date().toISOString(), status: stages.some((s) => s.status === "BLOCKED") ? "BLOCKED" : "DOCUMENTATION_AUDIT_COMPLETE", researchConducted: false, usabilitySessionsConducted: false, stages };
  fs.writeFileSync(path.join(output, "ux-workflow-manifest.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(output, "ux-workflow-summary.md"), `# UX evidence workflow audit\n\nStatus: ${report.status}. This checks local artifact presence; it does not conduct research or usability testing.\n\n${stages.map((s) => `- ${s.id}: ${s.status} (${s.outputs.length - s.missing.length}/${s.outputs.length} files present)`).join("\n")}\n`);
  return report;
}
module.exports = { run };
if (require.main === module) {
  const result = run();
  console.log(`${result.status}: ${result.stages.length} UX evidence stages checked; researchConducted=false; usabilitySessionsConducted=false`);
}
