"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const chatCore = require("./chat-core.js");
const serverCore = require("./server-core.js");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const QA_PATH = path.join(ROOT, "input", "customer_data_cleaner_chatbot_approved_qa.json");
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png",
  ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};
const MAX_BODY_BYTES = 4096;

function loadConfig() {
  serverCore.loadEnvFile(path.join(ROOT, ".env"));
  return {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "",
    enabled: serverCore.parseBoolean(process.env.ENABLE_AI_MATCHING, false)
  };
}

function loadEligibleFaq() {
  const knowledgeBase = JSON.parse(fs.readFileSync(QA_PATH, "utf8"));
  if (!chatCore.validateKnowledgeBase(knowledgeBase)) throw new Error("Approved Q&A failed validation.");
  return chatCore.availableEntries(knowledgeBase.entries);
}

function sendJson(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    let settled = false;
    request.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        reject(Object.assign(new Error("Request too large"), { status: 413 }));
        request.resume();
        return;
      }
      body += chunk.toString("utf8");
    });
    request.on("end", () => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error("Invalid request"), { status: 400 })); }
    });
    request.on("error", (error) => { if (!settled) { settled = true; reject(error); } });
  });
}

function createAppServer({ config = loadConfig(), fetchImpl = fetch, faqEntries = loadEligibleFaq() } = {}) {
  return http.createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "same-origin");
    let url;
    try { url = new URL(request.url, "http://localhost"); }
    catch { sendJson(response, 400, { error: "Invalid request URL." }); return; }

    if (url.pathname === "/api/status" && request.method === "GET") {
      sendJson(response, 200, { aiMatchingEnabled: config.enabled && Boolean(config.apiKey) && serverCore.isModelId(config.model) });
      return;
    }
    if (url.pathname === "/api/match") {
      if (request.method !== "POST") { sendJson(response, 405, { error: "Use POST for FAQ matching." }); return; }
      if (request.headers.origin) {
        try {
          if (new URL(request.headers.origin).host !== request.headers.host) { sendJson(response, 403, { error: "Cross-origin requests are not accepted." }); return; }
        } catch { sendJson(response, 403, { error: "Cross-origin requests are not accepted." }); return; }
      }
      let payload;
      try { payload = await readJsonBody(request); }
      catch (error) { sendJson(response, error.status || 400, { error: error.status === 413 ? "Question is too long. Please shorten it." : "Request body must be valid JSON." }); return; }
      const question = typeof payload?.question === "string" ? payload.question.trim() : "";
      if (!question || question.length > 1000) { sendJson(response, 400, { error: "Enter a question of 1,000 characters or fewer." }); return; }
      if (!config.enabled) { sendJson(response, 200, { enabled: false, matched: false }); return; }
      try {
        const result = await serverCore.matchApprovedFaq({ question, entries: faqEntries, config, fetchImpl });
        if (!result.matched) { sendJson(response, 200, { enabled: true, matched: false }); return; }
        sendJson(response, 200, { enabled: true, matched: true, question: result.entry.question, answer: result.entry.answer });
      } catch (error) {
        const safe = serverCore.safeMatchError(error);
        sendJson(response, safe.status, { error: safe.message });
      }
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") { sendJson(response, 405, { error: "Method not allowed." }); return; }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { sendJson(response, 400, { error: "Invalid asset path." }); return; }
    if (pathname === "/") pathname = "/index.html";
    const filePath = path.resolve(DIST, `.${pathname}`);
    if (filePath !== DIST && !filePath.startsWith(`${DIST}${path.sep}`)) { sendJson(response, 403, { error: "Asset path is not allowed." }); return; }
    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) { sendJson(response, 404, { error: "File not found." }); return; }
      response.writeHead(200, {
        "Content-Type": CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Content-Length": stat.size,
        "X-Content-Type-Options": "nosniff"
      });
      if (request.method === "HEAD") { response.end(); return; }
      fs.createReadStream(filePath).pipe(response);
    });
  });
}

if (require.main === module) {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.error("Build output is missing. Run npm run build first.");
    process.exit(1);
  }
  const config = loadConfig();
  const server = createAppServer({ config });
  const port = Number(process.env.PORT || 8000);
  const host = process.env.HOST || "127.0.0.1";
  server.listen(port, host, () => {
    console.log(`Customer Data Cleaner available at http://${host}:${port}/`);
    console.log(`AI matching ${config.enabled && config.apiKey && serverCore.isModelId(config.model) ? "enabled" : "disabled or not configured"}.`);
  });
}

module.exports = { createAppServer, loadConfig, loadEligibleFaq };
