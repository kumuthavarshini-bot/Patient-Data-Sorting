const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const chat = require("../chat-core.js");

const knowledgeBase = JSON.parse(fs.readFileSync(path.join(__dirname, "../input/customer_data_cleaner_chatbot_approved_qa.json"), "utf8"));
const entries = chat.availableEntries(knowledgeBase.entries);

test("approved Q&A JSON has the expected metadata and entry structure", () => {
  assert.equal(chat.validateKnowledgeBase(knowledgeBase), true);
  assert.equal(knowledgeBase.entries.length, 20);
});

test("rejects duplicate Q&A IDs and normalized questions", () => {
  const duplicateId = structuredClone(knowledgeBase);
  const eligibleIndex = 0;
  const replaceIndex = 1;
  duplicateId.entries[replaceIndex] = structuredClone(duplicateId.entries[eligibleIndex]);
  assert.equal(chat.validateKnowledgeBase(duplicateId), false);

  const duplicateQuestion = structuredClone(knowledgeBase);
  duplicateQuestion.entries[1].question = `  ${duplicateQuestion.entries[0].question.toUpperCase()}? `;
  assert.equal(chat.validateKnowledgeBase(duplicateQuestion), false);
});

test("rejects Q&A entries with missing fields or invalid field types", () => {
  for (const mutate of [
    (entry) => { delete entry.answer; },
    (entry) => { entry.question = 42; },
    (entry) => { entry.keywords = [null]; }
  ]) {
    const malformed = structuredClone(knowledgeBase);
    mutate(malformed.entries[0]);
    assert.equal(chat.validateKnowledgeBase(malformed), false);
  }
});

test("rejects a structurally valid Q&A file when an eligible entry is missing", () => {
  const incomplete = structuredClone(knowledgeBase);
  incomplete.entries.pop();
  incomplete.metadata.entry_count -= 1;
  assert.equal(chat.validateKnowledgeBase(incomplete), false);
});

test("approved entries are available and status-held or rejected entries stay excluded", () => {
  assert.equal(entries.length, 20);
  assert.deepEqual(chat.reviewEntries(knowledgeBase.entries), []);
  const staged = [...knowledgeBase.entries,
    { ...knowledgeBase.entries[0], id: "held_synthetic", status: "held" },
    { ...knowledgeBase.entries[1], id: "rejected_synthetic", status: "rejected" },
    { ...knowledgeBase.entries[2], id: "review_synthetic", status: "under_review" },
    { ...knowledgeBase.entries[3], id: "pending_synthetic", status: "pending" }
  ];
  assert.equal(chat.availableEntries(staged).length, 20);
  assert.equal(chat.reviewEntries(staged).length, 4);
  const recommendations = chat.recommendedEntries(entries);
  assert.equal(recommendations.length, 4);
  assert.deepEqual(recommendations.map((entry) => entry.id), ["faq_002", "faq_004", "faq_005", "faq_013"]);
  for (const entry of entries) {
    const selected = chat.recommendationById(entry.id, entries);
    assert.equal(selected.question, entry.question);
    assert.equal(selected.answer, entry.answer);
  }
  assert.equal(chat.recommendationById("held-entry", entries), null);
  assert.equal(chat.matchQuestion("What are my account billing credentials?", entries), null);
});

test("recognizes location-count questions without fuzzy location parsing", () => {
  assert.equal(chat.locationQuestion("How many customers are from Newark?"), "Newark");
  assert.equal(chat.locationQuestion("How many records are in Secaucus?"), "Secaucus");
  assert.equal(chat.locationQuestion("How many customers from New York?"), "New York");
  assert.equal(chat.locationQuestion("Where is Newark?"), null);
});

test("formats missing, invalid, malformed-shape, and fetch Q&A errors", () => {
  assert.match(chat.formatKnowledgeBaseLoadError({ code: "MISSING_QA" }), /missing/);
  assert.match(chat.formatKnowledgeBaseLoadError({ code: "INVALID_QA_JSON" }), /invalid JSON/);
  assert.match(chat.formatKnowledgeBaseLoadError({ code: "INVALID_QA_SHAPE" }), /unexpected structure/);
  assert.match(chat.formatKnowledgeBaseLoadError({ code: "FILE_PROTOCOL" }), /local web server/);
  assert.match(chat.formatKnowledgeBaseLoadError({ code: "INVALID_QA_RESPONSE" }), /unexpected response/);
  assert.match(chat.formatKnowledgeBaseLoadError({ code: "HTTP_ERROR", status: 500 }), /500/);
  assert.match(chat.formatKnowledgeBaseLoadError(new TypeError("fetch failed")), /local web server/);
});

test("Q&A loader handles missing files, invalid JSON, invalid shapes, and fetch failures", async () => {
  await assert.rejects(chat.loadKnowledgeBase("input/missing.json", async () => ({ ok: false, status: 404 })), (error) => error.code === "MISSING_QA");
  await assert.rejects(chat.loadKnowledgeBase("input/bad.json", async () => ({ ok: true, json: async () => { throw new SyntaxError("bad JSON"); } })), (error) => error.code === "INVALID_QA_JSON");
  await assert.rejects(chat.loadKnowledgeBase("input/shape.json", async () => ({ ok: true, json: async () => ({ metadata: {}, entries: [] }) })), (error) => error.code === "INVALID_QA_SHAPE");
  await assert.rejects(chat.loadKnowledgeBase("input/response.json", async () => ({})), (error) => error.code === "INVALID_QA_RESPONSE");
  await assert.rejects(chat.loadKnowledgeBase("input/unavailable.json", async () => { throw new TypeError("offline"); }), (error) => error.code === "FETCH_ERROR");
  const loaded = await chat.loadKnowledgeBase("input/customer_data_cleaner_chatbot_approved_qa.json", async (url, options) => {
    assert.equal(url, "input/customer_data_cleaner_chatbot_approved_qa.json");
    assert.deepEqual(options, { cache: "no-store" });
    return { ok: true, json: async () => knowledgeBase };
  });
  assert.equal(loaded, knowledgeBase);
});

test("deterministically matches approved question wording and keywords", () => {
  assert.equal(chat.matchQuestion("How do I get started?", entries).id, "faq_002");
  assert.equal(chat.matchQuestion("What is the Profile Agent?", entries).id, "faq_004");
  assert.equal(chat.matchQuestion("What is the Mapping Agent?", entries).id, "faq_005");
  assert.equal(chat.matchQuestion("What does the validation gate mean?", entries).id, "faq_013");
  assert.equal(chat.matchQuestion("Can I upload a CSV or Excel file?", entries).id, "faq_018");
  assert.equal(chat.matchQuestion("profile agent", entries).id, "faq_004");
  assert.equal(chat.matchQuestion("tell me what happens at the validation gate", entries).id, "faq_013");
});

test("matches explicit approved aliases without editing approved Q&A content", () => {
  const withAlias = entries.map((entry) => entry.id === "faq_004" ? { ...entry, aliases: ["Explain the Profile Agent"] } : entry);
  assert.equal(chat.matchQuestion("explain the profile agent", withAlias).id, "faq_004");
  assert.equal(chat.matchQuestion("explain the mapping and profile agent", withAlias), null);
});

test("uses explicit workflow context only to resolve otherwise similar candidates", () => {
  const candidates = [
    { id: "validation", question: "How is validation handled?", answer: "approved answer", category: "validation", keywords: ["quality rules apply"] },
    { id: "mapping", question: "How is mapping handled?", answer: "approved answer", category: "mapping", keywords: ["quality rules apply"] }
  ];
  assert.equal(chat.matchQuestion("Explain quality rules", candidates, "validation").id, "validation");
  assert.equal(chat.matchQuestion("Explain quality rules", candidates), null);
});

test("returns no answer for ambiguous or unknown questions", () => {
  assert.equal(chat.matchQuestion("Can you clean my file now?", entries), null);
  assert.equal(chat.matchQuestion("", entries), null);
  assert.equal(chat.matchQuestion("What are the seven workflow phases?", entries).id, "faq_003");
});

test("uses the approved answer text without rewriting it", () => {
  const original = knowledgeBase.entries.find((entry) => entry.id === "faq_004").answer;
  const match = chat.matchQuestion("What is the Profile Agent?", entries);
  assert.equal(match.answer, original);
});
