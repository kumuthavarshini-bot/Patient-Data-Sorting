const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const chat = require("../chat-core.js");

const root = path.resolve(__dirname, "..");
const legacyDashboard = "customer_data_cleaner_orchestrator_interactive_patient_hero (1).html";

function localReferences(html) {
  return [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => !/^(?:[a-z]+:|\/\/|#)/i.test(url));
}

test("root entry is the six-section presentation with only the two primary page destinations", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const sections = ["cover-title", "problem-title", "architecture-title", "agents-title", "orchestration-title", "solution-title"];
  let prior = -1;
  sections.forEach((heading) => {
    const position = html.indexOf(`id="${heading}"`);
    assert.ok(position > prior, `Missing or out-of-order section heading ${heading}`);
    prior = position;
  });
  for (const text of [
    "Too much time is spent locating the right patient data.",
    "From messy data to trusted insight.",
    "Five specialised agents. One coherent workflow.",
    "A controlled handoff, not five separate bots.",
    "Less sorting. More understanding.",
    "Model output is a proposal. Validation rules and review gates determine what can safely proceed."
  ]) assert.ok(html.includes(text), `Presentation is missing PDF content: ${text}`);
  assert.equal((html.match(/<a\b[^>]*href="demo\.html"/g) || []).length, 2);
  assert.match(html, /href="index\.html"[^>]*aria-current="page"[^>]*>AI Orchestration/);
  assert.match(html, /href="demo\.html"[^>]*>Live Demo/);
  assert.doesNotMatch(html, /href="\.\/"/);
  assert.match(html, /not intended for patient or PHI data/);
});

test("demo navigation returns to root and all demo asset paths resolve", () => {
  const pages = ["index.html", "demo.html"];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    for (const reference of localReferences(html)) {
      const pathname = new URL(reference, pathToFileURL(path.join(root, page))).pathname;
      assert.ok(fs.existsSync(decodeURIComponent(pathname)), `${page} references missing local path ${reference}`);
    }
  }
  const demo = fs.readFileSync(path.join(root, "demo.html"), "utf8");
  assert.match(demo, /href="index\.html"[^>]*>AI Orchestration/);
  assert.match(demo, /href="index\.html"[^>]*>← Back to AI Orchestration/);
  assert.match(demo, /href="demo\.html"[^>]*aria-current="page"/);
  assert.doesNotMatch(demo, /href="\.\/"/);
});

test("obsolete dashboard and outcomes URLs redirect to the presentation", () => {
  for (const file of [legacyDashboard, "outcomes.html"]) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(html, /http-equiv="refresh" content="0;url=index\.html"/);
    assert.match(html, /window\.location\.replace\("index\.html"\)/);
  }
});

test("chatbot Q&A path exists and contains valid expected JSON", () => {
  const dataPath = path.join(root, "input/customer_data_cleaner_chatbot_approved_qa.json");
  const knowledgeBase = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  assert.equal(knowledgeBase.metadata.entry_count, knowledgeBase.entries.length);
  assert.equal(knowledgeBase.entries.length, 20);
  const chatScript = fs.readFileSync(path.join(root, "demo-chat.js"), "utf8");
  assert.match(chatScript, /new URL\("\.\/input\/customer_data_cleaner_chatbot_approved_qa\.json", document\.baseURI\)/);
});

test("static deployment contains the app pages, local spreadsheet parser and eligible Q&A", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cdc-vercel-build-"));
  const output = path.join(temporaryRoot, "dist");
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/build-static.js"), output], { cwd: root, stdio: "pipe" });
    const source = JSON.parse(fs.readFileSync(path.join(root, "input/customer_data_cleaner_chatbot_approved_qa.json"), "utf8"));
    const deployed = JSON.parse(fs.readFileSync(path.join(output, "input/customer_data_cleaner_chatbot_approved_qa.json"), "utf8"));
    const sourceEligible = chat.availableEntries(source.entries);
    const shipped = fs.readdirSync(output).sort();
    assert.deepEqual(shipped, ["chat-core.js", "customer_data_cleaner_orchestrator_interactive_patient_hero (1).html", "demo-chat.js", "demo-core.js", "demo.css", "demo.html", "demo.js", "index.html", "input", "outcomes.html", "spreadsheet-importer.js", "styles", "vendor"].sort());
    assert.ok(fs.existsSync(path.join(output, "index.html")));
    assert.ok(fs.existsSync(path.join(output, "demo.html")));
    assert.ok(fs.existsSync(path.join(output, "spreadsheet-importer.js")));
    assert.ok(fs.existsSync(path.join(output, "vendor/xlsx.full.min.js")));
    assert.ok(fs.existsSync(path.join(output, "vendor/LICENSE")));
    assert.match(fs.readFileSync(path.join(output, "index.html"), "utf8"), /href="demo\.html"/);
    assert.match(fs.readFileSync(path.join(output, "demo.html"), "utf8"), /href="index\.html"[^>]*>← Back to AI Orchestration/);
    assert.match(fs.readFileSync(path.join(output, "demo.html"), "utf8"), /spreadsheet-importer\.js/);
    assert.match(fs.readFileSync(path.join(output, "demo.js"), "utf8"), /vendor\/xlsx\.full\.min\.js/);
    assert.ok(fs.existsSync(path.join(output, legacyDashboard)));
    assert.match(fs.readFileSync(path.join(output, legacyDashboard), "utf8"), /location\.replace\("index\.html"\)/);
    assert.equal(chat.validateKnowledgeBase(deployed), true);
    assert.deepEqual(deployed.entries.map((entry) => entry.id), sourceEligible.map((entry) => entry.id));
    for (const entry of deployed.entries) {
      const original = source.entries.find((candidate) => candidate.id === entry.id);
      assert.equal(entry.question, original.question);
      assert.equal(entry.answer, original.answer);
    }
    assert.equal(fs.existsSync(path.join(output, "artifacts")), false);
    assert.equal(fs.existsSync(path.join(output, "docs")), false);
    assert.equal(fs.existsSync(path.join(output, ".env")), false);
    assert.equal(fs.existsSync(path.join(output, "input/customer_data_cleaner_BRD.md")), false);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("development server script builds the published directory and serves it from the app root", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.match(packageJson.scripts.dev, /npm run build/);
  assert.match(packageJson.scripts.dev, /node server\.js/);
  assert.match(fs.readFileSync(path.join(root, "server.js"), "utf8"), /path\.join\(ROOT, "dist"\)/);
  const ignoreRules = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.match(ignoreRules, /^\/\.env\s*$/m);
  assert.match(ignoreRules, /^!\/\.env\.example\s*$/m);
  assert.equal(fs.existsSync(path.join(root, ".env.example")), true);
  const instructions = fs.readFileSync(path.join(root, "docs/LOCAL_DEVELOPMENT.md"), "utf8");
  assert.match(instructions, /npm run dev/);
  assert.match(instructions, /http:\/\/127\.0\.0\.1:8000\//);
  assert.match(instructions, /http:\/\/127\.0\.0\.1:8000\/demo\.html/);
  assert.match(instructions, /[Dd]o not open the project folder or HTML files through Finder\/`file:\/\//);
});

test("static build does not publish backend code, environment files, or API credentials", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cdc-private-build-"));
  const output = path.join(temporaryRoot, "dist");
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/build-static.js"), output], { cwd: root, stdio: "pipe" });
    for (const privateFile of [".env", ".env.example", "server.js", "server-core.js"]) {
      assert.equal(fs.existsSync(path.join(output, privateFile)), false, `${privateFile} must stay server-side`);
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
