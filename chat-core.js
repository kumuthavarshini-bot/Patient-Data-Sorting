(function (root) {
  "use strict";

  const MIN_MATCH_SCORE = 0.72;
  const MIN_SCORE_GAP = 0.16;
  const RECOMMENDATION_IDS = ["faq_002", "faq_004", "faq_005", "faq_013"];
  const STAGE_RECOMMENDATION_IDS = {
    check: ["faq_002", "faq_004", "faq_018", "faq_001"],
    fix: ["faq_006", "faq_010", "faq_012", "faq_009"],
    mapping: ["faq_005", "faq_011", "faq_016", "faq_002"],
    review: ["faq_007", "faq_013", "faq_014", "faq_016"],
    export: ["faq_015", "faq_001", "faq_020", "faq_014"]
  };
  const STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "behind", "by", "can", "could", "do", "does", "for", "from", "happens", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "please", "tell", "the", "to", "what", "when", "where", "which", "who", "why", "with", "would", "you", "your"]);

  function normalize(value) {
    return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }
  function tokens(value) { return normalize(value).split(" ").filter((token) => token && !STOP_WORDS.has(token)); }
  function validateKnowledgeBase(data) {
    if (!data || typeof data !== "object" || !data.metadata || data.metadata.status !== "approved_by_user" || !Array.isArray(data.entries)) return false;
    if (data.metadata.entry_count !== data.entries.length || data.entries.length !== 20) return false;
    const ids = new Set();
    const questions = new Set();
    for (const entry of data.entries) {
      if (!entry || typeof entry.id !== "string" || !entry.id.trim() || typeof entry.question !== "string" || !entry.question.trim() || typeof entry.answer !== "string" || !entry.answer.trim() || typeof entry.category !== "string" || !Array.isArray(entry.keywords) || !entry.keywords.every((keyword) => typeof keyword === "string")) return false;
      if (entry.status !== undefined && typeof entry.status !== "string") return false;
      if (entry.aliases !== undefined && (!Array.isArray(entry.aliases) || !entry.aliases.every((alias) => typeof alias === "string"))) return false;
      const question = normalize(entry.question);
      if (ids.has(entry.id) || questions.has(question)) return false;
      ids.add(entry.id);
      questions.add(question);
    }
    return ids.size === data.entries.length;
  }
  function isApproved(entry) { return !entry.status || entry.status === "approved" || entry.status === "approved_by_user"; }
  function availableEntries(entries) { return entries.filter(isApproved); }
  function reviewEntries(entries) { return entries.filter((entry) => !isApproved(entry)); }
  function recommendationById(id, entries) { return entries.find((entry) => entry.id === id) || null; }
  function recommendedEntries(entries, stage = "") {
    const approved = availableEntries(entries);
    const ids = STAGE_RECOMMENDATION_IDS[stage] || RECOMMENDATION_IDS;
    const selected = ids.map((id) => recommendationById(id, approved)).filter(Boolean);
    for (const entry of approved) if (selected.length < 4 && !selected.includes(entry)) selected.push(entry);
    return selected.slice(0, 4);
  }
  function locationQuestion(value) {
    const match = String(value || "").trim().match(/^how many\s+(?:customers?|customer records?|records?)\s+(?:are\s+)?(?:from|in)\s+(.+?)\s*[?!.]*$/i);
    return match ? match[1].trim().replace(/^["']|["']$/g, "").trim() : null;
  }
  function formatKnowledgeBaseLoadError(error) {
    if (error && error.code === "MISSING_QA") return "Approved Q&A file is missing. Check that input/customer_data_cleaner_chatbot_approved_qa.json is present.";
    if (error && error.code === "INVALID_QA_JSON") return "Approved Q&A file contains invalid JSON.";
    if (error && error.code === "INVALID_QA_SHAPE") return "Approved Q&A data has an unexpected structure.";
    if (error && error.code === "INVALID_QA_RESPONSE") return "Approved Q&A request returned an unexpected response.";
    if (error && error.code === "FILE_PROTOCOL") return "Approved Q&A requires a local web server. From the project folder run python3 -m http.server 8000, then open http://localhost:8000/demo.html.";
    if (error && error.code === "HTTP_ERROR") return `Approved Q&A request failed (HTTP ${error.status}).`;
    return "Could not fetch approved Q&A. Open the demo through the app's local web server and check that its files are available.";
  }
  async function loadKnowledgeBase(url, fetcher) {
    let response;
    try {
      response = await fetcher(url, { cache: "no-store" });
    } catch (_) {
      const error = new Error("Q&A fetch failed"); error.code = "FETCH_ERROR"; throw error;
    }
    if (!response || typeof response.ok !== "boolean") {
      const error = new Error("Invalid Q&A response"); error.code = "INVALID_QA_RESPONSE"; throw error;
    }
    if (!response.ok) {
      const error = new Error("Q&A request failed"); error.code = response.status === 404 ? "MISSING_QA" : "HTTP_ERROR"; error.status = response.status; throw error;
    }
    let data;
    try {
      data = await response.json();
    } catch (_) {
      const error = new Error("Invalid Q&A JSON"); error.code = "INVALID_QA_JSON"; throw error;
    }
    if (!validateKnowledgeBase(data)) {
      const error = new Error("Invalid Q&A shape"); error.code = "INVALID_QA_SHAPE"; throw error;
    }
    return data;
  }
  function matchQuestion(query, entries, context = "") {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return null;
    const exact = entries.find((entry) => normalize(entry.question) === normalizedQuery);
    if (exact) return exact;
    const exactAlias = entries.filter((entry) => Array.isArray(entry.aliases) && entry.aliases.some((alias) => normalize(alias) === normalizedQuery));
    if (exactAlias.length === 1) return exactAlias[0];
    if (exactAlias.length > 1) return null;
    const exactKeyword = entries.filter((entry) => entry.keywords.some((keyword) => normalize(keyword) === normalizedQuery));
    if (exactKeyword.length === 1) return exactKeyword[0];
    if (exactKeyword.length > 1) return null;
    const queryTokens = [...new Set(tokens(query))];
    const phraseMatches = entries.flatMap((entry) => {
      const phrases = [entry.question, ...(entry.aliases || []), ...entry.keywords].map(normalize).filter((phrase) => phrase.length >= 6);
      const phraseLength = Math.max(0, ...phrases.filter((phrase) => normalizedQuery.includes(phrase)).map((phrase) => phrase.length));
      return phraseLength ? [{ entry, phraseLength }] : [];
    }).sort((a, b) => b.phraseLength - a.phraseLength);
    if (phraseMatches.length) {
      if (phraseMatches[1] && phraseMatches[0].phraseLength === phraseMatches[1].phraseLength) return null;
      const strongest = phraseMatches[0];
      const strongestTokens = new Set(tokens(strongest.entry.question + " " + strongest.entry.keywords.join(" ")));
      const competingConcept = queryTokens.some((token) => !strongestTokens.has(token) && entries.some((entry) => entry.id !== strongest.entry.id && tokens(entry.question + " " + entry.keywords.join(" ")).includes(token)));
      return competingConcept ? null : strongest.entry;
    }
    if (queryTokens.length < 2) return null;
    const contextTokens = new Set(tokens(context));
    const scored = entries.map((entry) => {
      const questionTokens = new Set(tokens(entry.question));
      const keywordTokens = new Set(entry.keywords.flatMap(tokens));
      const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
      const aliasTokens = new Set(aliases.flatMap(tokens));
      const score = queryTokens.reduce((total, token) => total + (questionTokens.has(token) ? 1 : aliasTokens.has(token) ? 0.95 : keywordTokens.has(token) ? 0.8 : 0), 0) / queryTokens.length;
      const contextBoost = contextTokens.size
        ? [...contextTokens].filter((token) => questionTokens.has(token) || keywordTokens.has(token) || aliasTokens.has(token) || normalize(entry.category).split(" ").includes(token)).length / contextTokens.size * 0.2
        : 0;
      return { entry, score: score + contextBoost };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0], next = scored[1];
    if (!best || best.score < MIN_MATCH_SCORE || (next && best.score - next.score < MIN_SCORE_GAP)) return null;
    return best.entry;
  }
  const api = { RECOMMENDATION_IDS, STAGE_RECOMMENDATION_IDS, normalize, validateKnowledgeBase, availableEntries, reviewEntries, recommendationById, recommendedEntries, locationQuestion, formatKnowledgeBaseLoadError, loadKnowledgeBase, matchQuestion };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CdcChatCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
