(() => {
  "use strict";
  const QA_URL = new URL("./input/customer_data_cleaner_chatbot_approved_qa.json", document.baseURI).href;
  const AI_MATCH_URL = new URL("./api/match", document.baseURI).href;
  const $ = (id) => document.getElementById(id);
  const launcher = $("assistantLauncher"), panel = $("assistantPanel"), closeButton = $("assistantClose");
  const messages = $("assistantMessages"), suggestions = $("assistantSuggestions"), status = $("assistantStatus");
  const reviewNote = $("assistantReviewNote"), form = $("assistantForm"), input = $("assistantInput"), sendButton = $("assistantSend");
  const locationTools = $("assistantLocationTools"), locationColumn = $("assistantLocationColumn"), locationCountButton = $("assistantLocationCount");
  const diagnosticsEnabled = new URL(document.baseURI).searchParams.has("debugChat");
  let entries = [];
  let pendingLocation = "";
  let recommendationBusy = false;
  let loadingRecommendations = false;
  let chatBusy = false;

  function diagnose(event, details = {}) {
    if (diagnosticsEnabled) console.info(`[Ask DataCare] ${event} ${JSON.stringify(details)}`);
  }

  function addMessage(kind, text) {
    const bubble = document.createElement("div"); bubble.className = `assistant-message ${kind}`;
    const label = document.createElement("span"); label.className = "assistant-message-label"; label.textContent = kind === "user" ? "You" : "DataCare";
    bubble.append(label, document.createTextNode(text)); messages.appendChild(bubble); messages.scrollTop = messages.scrollHeight;
  }
  function showSuggestions() {
    suggestions.replaceChildren();
    CdcChatCore.recommendedEntries(entries).forEach((entry) => {
      const button = document.createElement("button"); button.className = "assistant-suggestion"; button.type = "button"; button.textContent = entry.question;
      button.addEventListener("click", () => submitRecommendation(entry)); suggestions.appendChild(button);
    });
    if (!entries.length) showSuggestionError("No approved recommendations are available.");
  }
  function showSuggestionError(message, canRetry = false, retryAction = loadApprovedQuestions) {
    suggestions.replaceChildren();
    const empty = document.createElement("p"); empty.className = "assistant-suggestions-empty"; empty.textContent = message; suggestions.appendChild(empty);
    if (canRetry) {
      const retry = document.createElement("button"); retry.className = "assistant-retry"; retry.type = "button"; retry.textContent = "Try again";
      retry.addEventListener("click", retryAction); suggestions.appendChild(retry);
    }
  }
  async function submitRecommendation(recommendation) {
    if (recommendationBusy) return;
    const approved = CdcChatCore.recommendationById(recommendation.id, entries);
    if (!approved) return;
    recommendationBusy = true;
    suggestions.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
      await submitQuestion(approved.question);
    } finally {
      recommendationBusy = false;
      suggestions.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    }
  }
  function answerLocationQuestion(location, selectedColumn = "") {
    const dataset = window.CdcDemoData ? window.CdcDemoData.getCurrentDataset() : null;
    const result = CdcCore.countLocationRecords(dataset, location, selectedColumn);
    locationTools.hidden = true;
    if (result.status === "no_dataset") {
      addMessage("bot", "Upload a CSV first. I can only count locations in the file currently loaded in this page.");
      return;
    }
    if (result.status === "missing_column" || result.status === "ambiguous_column") {
      pendingLocation = location;
      locationColumn.replaceChildren();
      const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Choose a column…"; locationColumn.appendChild(placeholder);
      result.headers.forEach((header) => {
        const option = document.createElement("option"); option.value = header; option.textContent = header; locationColumn.appendChild(option);
      });
      locationTools.hidden = false;
      addMessage("bot", result.status === "ambiguous_column"
        ? `I found more than one recognized location column (${result.candidates.join(", ")}). Select which column to count.`
        : "I couldn't identify a location column by its header. Select the column that contains the locations.");
      locationColumn.focus();
      return;
    }
    if (result.status === "invalid_column") {
      addMessage("bot", "That column is no longer available in the current file. Ask again to choose a column from the current upload.");
      return;
    }
    if (result.status !== "count") {
      addMessage("bot", "I couldn't count that location. Please enter a location name and try again.");
      return;
    }
    const count = result.count;
    addMessage("bot", count
      ? `I found ${count} record${count === 1 ? "" : "s"} for “${location}” in the “${result.column}” column of the currently uploaded CSV. Matching trims whitespace and ignores letter case.`
      : `I found 0 records for “${location}” in the “${result.column}” column of the currently uploaded CSV. Matching trims whitespace and ignores letter case.`);
  }
  const unmatchedFallback = "I couldn't confidently match that to the available approved guidance, so I won't guess. Try one of the suggested questions below.";

  async function submitQuestion(rawQuestion) {
    if (chatBusy) return;
    const question = String(rawQuestion || "").trim();
    if (!question) { status.textContent = "Enter a question or choose a suggestion."; diagnose("question-rejected", { reason: "empty" }); return; }
    addMessage("user", question);
    const location = CdcChatCore.locationQuestion(question);
    if (location) {
      diagnose("question-submitted", { kind: "location-count" });
      answerLocationQuestion(location);
      input.value = ""; input.focus();
      return;
    }
    if (!entries.length) { status.textContent = "Approved questions are not loaded. Use Try again in Recommendations; I won't guess an answer."; return; }
    let match;
    try {
      match = CdcChatCore.matchQuestion(question, entries);
    } catch (error) {
      diagnose("question-matching-failed", { name: error.name, stack: error.stack });
      addMessage("bot", "I couldn't process that question just now. Please try again.");
      status.textContent = "Question matching failed. Please try again.";
      input.value = ""; input.focus();
      return;
    }
    diagnose("question-matched", { matched: Boolean(match) });
    if (match) {
      addMessage("bot", match.answer);
      status.textContent = "Matched approved guidance.";
    } else {
      chatBusy = true;
      input.disabled = true;
      sendButton.disabled = true;
      status.textContent = "Checking whether this matches approved guidance…";
      try {
        const response = await window.fetch(AI_MATCH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question })
        });
        let result = {};
        try { result = await response.json(); } catch {}
        if (response.ok && result.matched === true && typeof result.answer === "string" && result.answer.trim()) {
          addMessage("bot", result.answer);
          status.textContent = "Matched approved guidance.";
          diagnose("ai-approved-faq-match", { matched: true });
        } else if (!response.ok && typeof result.error === "string") {
          addMessage("bot", result.error);
          status.textContent = "AI matching is unavailable; choose a suggested question or try again later.";
          diagnose("ai-matching-unavailable", { status: response.status });
        } else {
          addMessage("bot", unmatchedFallback);
          status.textContent = "No confident match. Choose a suggested question or rephrase.";
          diagnose("ai-approved-faq-match", { matched: false });
        }
      } catch {
        addMessage("bot", "AI matching is unavailable right now. I couldn't confidently match that question, so I won't guess. Try one of the approved suggestions below.");
        status.textContent = "AI matching is unavailable. Choose an approved suggestion or try again later.";
        diagnose("ai-matching-network-failure");
      } finally {
        chatBusy = false;
        input.disabled = false;
        sendButton.disabled = false;
      }
    }
    input.value = ""; input.focus();
  }
  function openAssistant() { panel.hidden = false; launcher.setAttribute("aria-expanded", "true"); input.focus(); }
  function closeAssistant() { panel.hidden = true; launcher.setAttribute("aria-expanded", "false"); launcher.focus(); }
  launcher.addEventListener("click", () => panel.hidden ? openAssistant() : closeAssistant());
  closeButton.addEventListener("click", closeAssistant);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) closeAssistant(); });
  form.addEventListener("submit", async (event) => { event.preventDefault(); await submitQuestion(input.value); });
  locationCountButton.addEventListener("click", () => {
    if (!pendingLocation) return;
    const selectedColumn = locationColumn.value;
    if (!selectedColumn) { status.textContent = "Choose a location column first."; locationColumn.focus(); return; }
    const location = pendingLocation; pendingLocation = "";
    answerLocationQuestion(location, selectedColumn);
  });
  window.addEventListener("cdc:dataset-changed", () => {
    pendingLocation = ""; locationColumn.replaceChildren(); locationTools.hidden = true;
  });

  function avoidControlOverlap() {
    if (panel.hidden === false || document.activeElement === launcher) { launcher.classList.remove("overlap-hidden"); return; }
    const button = launcher.getBoundingClientRect();
    const selectors = [".drop-zone", "#profileButton", "#cleanButton", ".results-tabs", ".table-wrap", ".download-row"];
    const overlaps = selectors.some((selector) => [...document.querySelectorAll(selector)].some((element) => {
      if (element.closest("[hidden]")) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.left < button.right && rect.right > button.left && rect.top < button.bottom && rect.bottom > button.top;
    }));
    launcher.classList.toggle("overlap-hidden", overlaps);
  }
  window.addEventListener("scroll", avoidControlOverlap, { passive: true });
  window.addEventListener("resize", avoidControlOverlap);
  const observer = new MutationObserver(avoidControlOverlap);
  ["previewSection", "profileSection", "mappingSection", "resultsSection"].forEach((id) => observer.observe($(id), { attributes: true, attributeFilter: ["hidden", "class"] }));

  async function loadApprovedQuestions() {
    if (loadingRecommendations) return;
    if (window.location.protocol === "file:") {
      const message = CdcChatCore.formatKnowledgeBaseLoadError({ code: "FILE_PROTOCOL" });
      status.textContent = message;
      showSuggestionError(message + " Open the Live Demo through the local server to load approved questions.", true, () => window.location.assign("http://localhost:8000/demo.html"));
      diagnose("initialization-blocked", { reason: "file-protocol" });
      return;
    }
    loadingRecommendations = true;
    suggestions.replaceChildren();
    const loading = document.createElement("p"); loading.className = "assistant-suggestions-empty"; loading.textContent = "Loading approved questions…"; suggestions.appendChild(loading);
    status.textContent = "Loading approved questions…";
    diagnose("initialization-started", { resource: QA_URL });
    let data;
    try {
      data = await CdcChatCore.loadKnowledgeBase(QA_URL, async (url, options) => {
        diagnose("resource-requested", { url });
        const response = await window.fetch(url, options);
        diagnose("resource-response", {
          status: response && response.status,
          ok: response && response.ok,
          contentType: response && response.headers && response.headers.get("content-type")
        });
        return response;
      });
    } catch (error) {
      diagnose("resource-load-failed", { code: error.code || "FETCH_ERROR", name: error.name, stack: error.stack });
      const reason = CdcChatCore.formatKnowledgeBaseLoadError(error);
      status.textContent = reason;
      showSuggestionError(reason + " You can retry after checking the local server and Q&A file.", true);
      input.disabled = false; sendButton.disabled = false;
      loadingRecommendations = false;
      return;
    }

    entries = CdcChatCore.availableEntries(data.entries);
    const reviewEntries = CdcChatCore.reviewEntries(data.entries);
    diagnose("resource-validated", { parsedEntries: data.entries.length, eligibleEntries: entries.length });
    input.disabled = false; sendButton.disabled = false;
    try {
      showSuggestions(); input.disabled = false; sendButton.disabled = false;
      status.textContent = `${entries.length} approved answers available. Conversation stays in this page session.`;
      reviewNote.textContent = reviewEntries.length
        ? "Some approved Q&A content is held pending product and BRD review. Held content is not used for answers or suggestions."
        : "";
      reviewNote.hidden = reviewEntries.length === 0;
      avoidControlOverlap();
      diagnose("recommendations-rendered", { count: entries.length });
    } catch (error) {
      diagnose("recommendation-render-failed", { name: error.name, stack: error.stack });
      status.textContent = "Approved Q&A loaded, but recommendations could not be rendered.";
      showSuggestionError("Approved Q&A loaded, but recommendations could not be rendered. Try again.", true, () => {
        try {
          showSuggestions();
          status.textContent = `${entries.length} approved answers available. Conversation stays in this page session.`;
          diagnose("recommendations-rendered", { count: entries.length, retry: true });
        } catch (retryError) {
          diagnose("recommendation-render-retry-failed", { name: retryError.name, stack: retryError.stack });
          status.textContent = "Recommendations still could not be rendered. Reload the Live Demo and try again.";
          showSuggestionError(status.textContent, false);
        }
      });
    }
    loadingRecommendations = false;
  }

  loadApprovedQuestions();
})();
