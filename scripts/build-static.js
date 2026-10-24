"use strict";

const fs = require("node:fs");
const path = require("node:path");
const chat = require("../chat-core.js");

const projectRoot = path.resolve(__dirname, "..");
const outputDirectory = path.resolve(process.argv[2] || path.join(projectRoot, "dist"));
if (outputDirectory === projectRoot || projectRoot.startsWith(`${outputDirectory}${path.sep}`)) {
  throw new Error("Refusing to remove the project root or one of its parent directories as build output.");
}
const publicFiles = [
  "index.html",
  "demo.html",
  "demo.css",
  "styles/design-tokens.css",
  "demo-core.js",
  "spreadsheet-importer.js",
  "demo.js",
  "chat-core.js",
  "demo-chat.js",
  "vendor/xlsx.full.min.js",
  "vendor/LICENSE",
  "outcomes.html",
  "customer_data_cleaner_orchestrator_interactive_patient_hero (1).html"
];

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });
for (const file of publicFiles) {
  const destination = path.join(outputDirectory, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(projectRoot, file), destination);
}

const sourcePath = path.join(projectRoot, "input/customer_data_cleaner_chatbot_approved_qa.json");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (!chat.validateKnowledgeBase(source)) throw new Error("The source approved Q&A file failed validation; static output was not generated.");
const eligibleEntries = chat.availableEntries(source.entries);
const publicKnowledgeBase = { ...source, metadata: { ...source.metadata, entry_count: eligibleEntries.length }, entries: eligibleEntries };
if (!chat.validateKnowledgeBase(publicKnowledgeBase)) throw new Error("The public approved Q&A subset failed validation; static output was not generated.");
const publicQaPath = path.join(outputDirectory, "input/customer_data_cleaner_chatbot_approved_qa.json");
fs.mkdirSync(path.dirname(publicQaPath), { recursive: true });
fs.writeFileSync(publicQaPath, `${JSON.stringify(publicKnowledgeBase, null, 2)}\n`);

console.log(`Static site built at ${outputDirectory} (${publicFiles.length} page/asset files; ${eligibleEntries.length} eligible Q&A entries).`);
