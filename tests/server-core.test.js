const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const chat = require("../chat-core.js");
const server = require("../server-core.js");

const knowledgeBase = JSON.parse(fs.readFileSync(path.join(__dirname, "../input/customer_data_cleaner_chatbot_approved_qa.json"), "utf8"));
const eligible = chat.availableEntries(knowledgeBase.entries);

test("environment boolean parsing treats false-like strings as disabled", () => {
  for (const value of ["false", " FALSE ", "0", "no", "off", "", undefined]) assert.equal(server.parseBoolean(value), false);
  for (const value of ["true", "TRUE", "1", "yes", "on"]) assert.equal(server.parseBoolean(value), true);
});

test("local env loader preserves existing process configuration and parses quoted values", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cdc-env-test-"));
  const file = path.join(directory, ".env");
  fs.writeFileSync(file, "OPENAI_MODEL='gpt-4.1-mini'\nENABLE_AI_MATCHING=false\n");
  const target = { ENABLE_AI_MATCHING: "true" };
  server.loadEnvFile(file, target);
  assert.equal(target.OPENAI_MODEL, "gpt-4.1-mini");
  assert.equal(target.ENABLE_AI_MATCHING, "true");
  fs.rmSync(directory, { recursive: true, force: true });
});

test("model identifiers reject a display name with spaces", () => {
  assert.equal(server.isModelId("customer data app"), false);
  assert.equal(server.isModelId("gpt-4.1-mini"), true);
});

test("AI request contains only eligible FAQ candidates and returns the local approved answer", async () => {
  const chosen = eligible[0];
  let request;
  const result = await server.matchApprovedFaq({
    question: "Explain the purpose of this approved guidance.",
    entries: eligible,
    config: { enabled: true, apiKey: "test-secret-never-logged", model: "gpt-4.1-mini" },
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return { ok: true, async json() { return { output_text: JSON.stringify({ faq_id: chosen.id }) }; } };
    }
  });
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.options.headers.Authorization, "Bearer test-secret-never-logged");
  assert.equal(request.body.store, false);
  assert.equal(request.body.model, "gpt-4.1-mini");
  assert.equal(request.body.text.format.type, "json_schema");
  const submitted = JSON.parse(request.body.input);
  assert.equal(submitted.question, "Explain the purpose of this approved guidance.");
  assert.deepEqual(submitted.approvedFaqCandidates.map((entry) => entry.id), eligible.map((entry) => entry.id));
  assert.equal(submitted.approvedFaqCandidates.some((entry) => Object.hasOwn(entry, "answer")), false);
  assert.deepEqual(result, { enabled: true, matched: true, entry: chosen });
});

test("AI cannot return an unknown FAQ id or invent a match", async () => {
  const result = await server.matchApprovedFaq({
    question: "Unrelated request",
    entries: eligible,
    config: { enabled: true, apiKey: "unused-in-output", model: "gpt-4.1-mini" },
    fetchImpl: async () => ({ ok: true, async json() { return { output_text: JSON.stringify({ faq_id: null }) }; } })
  });
  assert.deepEqual(result, { enabled: true, matched: false });
  await assert.rejects(server.matchApprovedFaq({
    question: "Unrelated request", entries: eligible,
    config: { enabled: true, apiKey: "x", model: "gpt-4.1-mini" },
    fetchImpl: async () => ({ ok: true, async json() { return { output_text: JSON.stringify({ faq_id: "invented" }) }; } })
  }), { code: "INVALID_API_RESPONSE" });
});

test("API authentication, model, quota, timeout, and network failures map to safe messages", async () => {
  for (const [upstreamStatus, expectedCode] of [[401, "API_AUTH"], [403, "MODEL_ACCESS"], [404, "MODEL_NOT_FOUND"], [429, "QUOTA_OR_RATE_LIMIT"]]) {
    await assert.rejects(server.matchApprovedFaq({
      question: "test", entries: eligible,
      config: { enabled: true, apiKey: "never-print", model: "gpt-4.1-mini" },
      fetchImpl: async () => ({ ok: false, status: upstreamStatus })
    }), (error) => error.code === expectedCode && !error.message.includes("never-print"));
  }
  await assert.rejects(server.matchApprovedFaq({ question: "test", entries: eligible, config: { enabled: true, apiKey: "x", model: "gpt-4.1-mini" }, fetchImpl: async () => { const error = new Error("private details"); error.name = "TimeoutError"; throw error; } }), { code: "API_TIMEOUT" });
  await assert.rejects(server.matchApprovedFaq({ question: "test", entries: eligible, config: { enabled: true, apiKey: "x", model: "gpt-4.1-mini" }, fetchImpl: async () => { throw new Error("private details"); } }), { code: "NETWORK_ERROR" });
  assert.doesNotMatch(server.safeMatchError(Object.assign(new Error("private details"), { code: "API_TIMEOUT" })).message, /private details/);
});
