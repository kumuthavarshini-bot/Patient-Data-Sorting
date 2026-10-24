const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const chat = require("../chat-core.js");

const knowledgeBase = JSON.parse(fs.readFileSync(path.join(__dirname, "../input/customer_data_cleaner_chatbot_approved_qa.json"), "utf8"));

class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.scrollHeight = 0;
  }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  async dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) await listener(event);
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelectorAll(selector) {
    if (selector === "button") return this.children.filter((child) => child.tagName === "button");
    return [];
  }
  getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }; }
  focus() {}
}

function makeChat(fetcher, protocol = "http:") {
  const ids = [
    "assistantLauncher", "assistantPanel", "assistantClose", "assistantMessages", "assistantSuggestions",
    "assistantStatus", "assistantReviewNote", "assistantForm", "assistantInput", "assistantSend",
    "assistantLocationTools", "assistantLocationColumn", "assistantLocationCount", "previewSection",
    "profileSection", "mappingSection", "resultsSection"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new MockElement()]));
  elements.assistantPanel.hidden = true;
  elements.assistantLocationTools.hidden = true;
  const document = {
    baseURI: "http://127.0.0.1:8000/demo.html",
    activeElement: null,
    getElementById: (id) => elements[id],
    createElement: (tag) => new MockElement(tag),
    createTextNode: (text) => ({ textContent: text }),
    querySelectorAll: () => [],
    addEventListener() {}
  };
  const window = {
    location: { protocol, assign(url) { window.assignedLocation = url; } },
    fetch: fetcher,
    addEventListener() {},
    CdcDemoData: null
  };
  class MutationObserver { observe() {} }
  const context = {
    document, window, CdcChatCore: chat, CdcCore: { countLocationRecords() { return { status: "no_dataset" }; } },
    MutationObserver, URL, setTimeout() { return 1; }, clearTimeout() {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../demo-chat.js"), "utf8"), context, { filename: "demo-chat.js" });
  return { elements, window };
}

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body; }
});
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("chat loads the approved resource and recommendation selection returns its exact approved answer", async () => {
  const calls = [];
  const { elements } = makeChat(async (url, options) => { calls.push({ url, options }); return response(knowledgeBase); });
  await tick();

  assert.deepEqual(calls, [{
    url: "http://127.0.0.1:8000/input/customer_data_cleaner_chatbot_approved_qa.json",
    options: { cache: "no-store" }
  }]);
  const eligible = chat.availableEntries(knowledgeBase.entries);
  const recommended = chat.recommendedEntries(eligible);
  assert.equal(elements.assistantSuggestions.children.length, recommended.length);
  assert.deepEqual(elements.assistantSuggestions.children.map((button) => button.textContent), recommended.map((entry) => entry.question));
  assert.equal(elements.assistantSuggestions.children.some((button) => chat.reviewEntries(knowledgeBase.entries).some((held) => held.question === button.textContent)), false);

  const selected = recommended[0];
  await elements.assistantSuggestions.children[0].dispatch("click");
  const submitted = elements.assistantMessages.children.slice(-2);
  assert.equal(submitted[0].children[1].textContent, selected.question);
  assert.equal(submitted[1].children[1].textContent, selected.answer);
  assert.equal(submitted[1].children[1].textContent, knowledgeBase.entries.find((entry) => entry.id === selected.id).answer);
});

test("failed Q&A load shows one recoverable error and Try again performs one real request", async () => {
  let calls = 0;
  let resolveRetry;
  const { elements } = makeChat(async () => {
    calls += 1;
    if (calls === 1) return response({ message: "missing" }, 404);
    return new Promise((resolve) => { resolveRetry = resolve; });
  });
  await tick();

  assert.equal(calls, 1);
  assert.equal(elements.assistantSuggestions.children.length, 2);
  assert.match(elements.assistantSuggestions.children[0].textContent, /missing/i);
  assert.equal(elements.assistantMessages.children.length, 0, "a load failure should not add repeated error messages to conversation history");
  const retry = elements.assistantSuggestions.children[1];
  assert.equal(retry.textContent, "Try again");
  assert.equal(retry.listeners.get("click").length, 1);

  const firstClick = retry.dispatch("click");
  await retry.dispatch("click");
  assert.equal(calls, 2, "repeated activation while loading must not duplicate the request");
  resolveRetry(response(knowledgeBase));
  await firstClick;
  await tick();

  assert.equal(elements.assistantSuggestions.children.length, chat.recommendedEntries(chat.availableEntries(knowledgeBase.entries)).length);
  assert.equal(elements.assistantSuggestions.children.some((child) => child.textContent === "Try again"), false);
  assert.match(elements.assistantStatus.textContent, /answers available/);
  assert.equal(elements.assistantMessages.children.length, 0);
});

test("question form handles approved matches and unmatched questions without exposing held entries", async () => {
  const { elements } = makeChat(async () => response(knowledgeBase));
  await tick();
  const approved = chat.availableEntries(knowledgeBase.entries)[0];

  elements.assistantInput.value = approved.question;
  let prevented = false;
  await elements.assistantForm.dispatch("submit", { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(elements.assistantMessages.children.at(-1).children[1].textContent, approved.answer);

  elements.assistantInput.value = "Can you clean my file now?";
  await elements.assistantForm.dispatch("submit", { preventDefault() {} });
  assert.match(elements.assistantMessages.children.at(-1).children[1].textContent, /won't guess/);
  assert.equal(elements.assistantMessages.children.some((bubble) =>
    chat.reviewEntries(knowledgeBase.entries).some((entry) => entry.answer === bubble.children[1]?.textContent)), false);
});

test("AI matching can only select an approved FAQ and the UI displays its unchanged approved answer", async () => {
  const approved = chat.availableEntries(knowledgeBase.entries)[0];
  const requested = [];
  const { elements } = makeChat(async (url, options) => {
    requested.push({ url, options });
    if (url.endsWith("/api/match")) return response({ enabled: true, matched: true, question: approved.question, answer: approved.answer });
    return response(knowledgeBase);
  });
  await tick();
  const submittedQuestion = "Please restate the guidance that covers anomaly detection for fields.";
  elements.assistantInput.value = submittedQuestion;
  await elements.assistantForm.dispatch("submit", { preventDefault() {} });
  assert.equal(requested.some((item) => item.url.endsWith("/api/match")), true);
  const messages = elements.assistantMessages.children.slice(-2);
  assert.equal(messages[0].children[1].textContent, submittedQuestion);
  assert.equal(messages[1].children[1].textContent, approved.answer);
});

test("closing and reopening keeps the current session and does not reload Q&A", async () => {
  let calls = 0;
  const { elements } = makeChat(async () => { calls += 1; return response(knowledgeBase); });
  await tick();
  const messageCount = elements.assistantMessages.children.length;
  await elements.assistantLauncher.dispatch("click");
  assert.equal(elements.assistantPanel.hidden, false);
  await elements.assistantClose.dispatch("click");
  assert.equal(elements.assistantPanel.hidden, true);
  await elements.assistantLauncher.dispatch("click");
  assert.equal(elements.assistantPanel.hidden, false);
  assert.equal(elements.assistantMessages.children.length, messageCount);
  assert.equal(calls, 1);
});

test("recommendation render failure is reported separately and can retry rendering loaded entries", async () => {
  const { elements } = makeChat(async () => response(knowledgeBase));
  const appendChild = elements.assistantSuggestions.appendChild.bind(elements.assistantSuggestions);
  elements.assistantSuggestions.appendChild = (node) => {
    if (node.className === "assistant-suggestion") throw new Error("synthetic render failure");
    return appendChild(node);
  };
  await tick();

  assert.match(elements.assistantStatus.textContent, /Q&A loaded, but recommendations could not be rendered/i);
  assert.doesNotMatch(elements.assistantStatus.textContent, /could not fetch/i);
  assert.equal(elements.assistantSuggestions.children.length, 2);

  elements.assistantSuggestions.appendChild = appendChild;
  await elements.assistantSuggestions.children[1].dispatch("click");
  assert.equal(elements.assistantSuggestions.children.length, chat.recommendedEntries(chat.availableEntries(knowledgeBase.entries)).length);
  assert.match(elements.assistantStatus.textContent, /answers available/i);
});

test("demo page loads each chatbot module exactly once and in dependency order", () => {
  const html = fs.readFileSync(path.join(__dirname, "../demo.html"), "utf8");
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"\s+defer><\/script>/g)].map((match) => match[1]);
  assert.deepEqual(scripts, ["demo-core.js", "spreadsheet-importer.js", "demo.js", "chat-core.js", "demo-chat.js"]);
  assert.equal(scripts.filter((src) => src === "demo-chat.js").length, 1);
});

test("file protocol explains the local-server requirement and offers the HTTP demo URL", async () => {
  let requests = 0;
  const { elements, window } = makeChat(async () => { requests += 1; return response(knowledgeBase); }, "file:");
  await tick();

  assert.equal(requests, 0);
  assert.match(elements.assistantStatus.textContent, /local web server/i);
  assert.equal(elements.assistantSuggestions.children[1].textContent, "Try again");
  await elements.assistantSuggestions.children[1].dispatch("click");
  assert.equal(window.assignedLocation, "http://localhost:8000/demo.html");
});
