// StudyMate - Vanilla JS SPA

// DOM elements
const takePhotoBtn = document.getElementById("takePhotoBtn");
const uploadPhotoBtn = document.getElementById("uploadPhotoBtn");
const fileInput = document.getElementById("fileInput");
const progressArea = document.getElementById("progressArea");
const results = document.getElementById("results");
const detailToggle = document.getElementById("detailToggle");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
const typedQuestion = document.getElementById("typedQuestion");
const explainTypedBtn = document.getElementById("explainTypedBtn");
const clearTypedBtn = document.getElementById("clearTypedBtn");
const typeAnswerBtn = document.getElementById("typeAnswerBtn");
const typeInCard = document.getElementById("typeInCard");
const speakBtn = document.getElementById("speakBtn");
const stopSpeakBtn = document.getElementById("stopSpeakBtn");
const resultsToolbar = document.getElementById("resultsToolbar");
const closeResultsBtn = document.getElementById("closeResultsBtn");
const sketchToggleBtn = document.getElementById("sketchToggleBtn");
const sketchOverlay = document.getElementById("sketchOverlay");
const sketchCanvas = document.getElementById("sketchCanvas");
const sketchClearBtn = document.getElementById("sketchClearBtn");
const sketchCloseBtn = document.getElementById("sketchCloseBtn");
const fontPicker = document.getElementById("fontPicker");
const bgmToggleBtn = document.getElementById("bgmToggleBtn");
const bgmAudio = document.getElementById("bgmAudio");
const bgmIcon = document.getElementById("bgmIcon");
const bgmLabel = document.getElementById("bgmLabel");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeIcon = document.getElementById("themeIcon");
// Welcome modal elements
const welcomeModal = document.getElementById("welcomeModal");
const closeWelcomeModal = document.getElementById("closeWelcomeModal");
const xWelcomeModal = document.getElementById("xWelcomeModal");
const welcomeOkBtn = document.getElementById("welcomeOkBtn");
// Help modal elements
const helpBtn = document.getElementById("helpBtn");
const helpModal = document.getElementById("helpModal");
const closeHelpModal = document.getElementById("closeHelpModal");
const xHelpModal = document.getElementById("xHelpModal");
const helpOkBtn = document.getElementById("helpOkBtn");

// Camera modal elements
const cameraModal = document.getElementById("cameraModal");
const cameraVideo = document.getElementById("cameraVideo");
const cameraCanvas = document.getElementById("cameraCanvas");
const closeCameraModal = document.getElementById("closeCameraModal");
const xCameraModal = document.getElementById("xCameraModal");
const captureBtn = document.getElementById("captureBtn");

const GEMINI_API_KEY = "AIzaSyDLtC9Kx-RO7OqLlUSdYhWBPPQ6zByc3Hs";

const STORAGE_KEYS = {
  history: "hhai_history_v1",
  mode: "hhai_mode_detailed",
  sidebarHidden: "hhai_sidebar_hidden",
  fontClass: "hhai_font_class",
};

// Keep track of the last AI request so we can offer a Retry button on errors
let lastAiRequest = null; // { questionText: string, detailedMode: boolean }

function getOrCreateRetryButton() {
  try {
    let btn = document.getElementById("retryBtn");
    if (btn) return btn;
    btn = document.createElement("button");
    btn.id = "retryBtn";
    btn.className = "btn secondary small";
    btn.textContent = "Retry";
    btn.style.display = "none";
    btn.style.marginTop = "8px";
    if (progressArea && progressArea.parentElement) {
      progressArea.insertAdjacentElement("afterend", btn);
    } else {
      document.body.appendChild(btn);
    }
    btn.addEventListener("click", async () => {
      if (!lastAiRequest) return;
      btn.disabled = true;
      try {
        setProgress("Retrying...");
        const { questionText, detailedMode } = lastAiRequest;
        const aiText = await callGemini(questionText, detailedMode);
        const steps = splitIntoSteps(aiText);
        renderSteps(steps);
        setProgress("Done!", "done");
        if (resultsToolbar)
          resultsToolbar.classList.toggle("hidden", steps.length === 0);
        addToHistory(questionText, steps, detailedMode);
        hideRetryButton();
      } catch (err) {
        console.error(err);
        setProgress(getFriendlyErrorMessage(err, "ai"));
        showRetryButton();
      } finally {
        btn.disabled = false;
      }
    });
    return btn;
  } catch {
    return null;
  }
}

function showRetryButton() {
  const btn = getOrCreateRetryButton();
  if (btn) btn.style.display = "inline-block";
}

function hideRetryButton() {
  const btn = document.getElementById("retryBtn");
  if (btn) btn.style.display = "none";
}

function getFriendlyErrorMessage(err, context) {
  const raw = (err && (err.userMessage || err.message || String(err))) || "";
  const msg = raw.toLowerCase();
  if (/(^|\s)(500|502|503|504)(\s|$)/.test(raw)) {
    return "The AI service is temporarily unavailable. Please try again in a moment.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Network issue. Check your connection and try again.";
  }
  if (msg.includes("timeout")) {
    return "The request took too long. Please try again.";
  }
  if (msg.includes("429") || msg.includes("rate") || msg.includes("quota")) {
    return "The service is a bit busy right now. Please try again shortly.";
  }
  if (
    msg.includes("403") ||
    msg.includes("401") ||
    msg.includes("api key") ||
    msg.includes("permission")
  ) {
    return "The AI service isn't available for this request. Please try again later.";
  }
  if (context === "camera") {
    return "We couldn't access the camera. Please check permissions and try again.";
  }
  if (context === "ocr") {
    return "We couldn't read the text from the image. Try a clearer photo.";
  }
  return "Something went wrong. Please try again.";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, retries = 2, baseDelayMs = 600) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const status = res.status;
        if ((status >= 500 && status < 600) || status === 429) {
          if (attempt < retries) {
            await sleep(baseDelayMs * Math.pow(2, attempt));
            continue;
          }
        }
      }
      return res;
    } catch (err) {
      const msg = String((err && err.message) || err).toLowerCase();
      if (
        (msg.includes("network") ||
          msg.includes("failed to fetch") ||
          msg.includes("timeout")) &&
        attempt < retries
      ) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
}

function setProgress(message, state) {
  if (!progressArea) return;
  if (!message) {
    progressArea.classList.remove("loading", "done");
    progressArea.textContent = "";
    return;
  }
  const msg = String(message);
  const isDone = state === "done" || /\b(done|completed|success)\b/i.test(msg);
  const isLoading =
    state === "loading" ||
    /(\.{3}$)|\b(OCR:|Recognizing|Asking|Starting|Preparing)\b/i.test(msg);
  progressArea.classList.toggle("loading", !!isLoading && !isDone);
  progressArea.classList.toggle("done", !!isDone);
  progressArea.textContent = msg;
}

// No key storage; key is embedded above per request

function getModeDetailed() {
  try {
    return localStorage.getItem(STORAGE_KEYS.mode) === "1";
  } catch {
    return false;
  }
}

function setModeDetailed(val) {
  try {
    localStorage.setItem(STORAGE_KEYS.mode, val ? "1" : "0");
  } catch {}
}

function getSidebarHidden() {
  try {
    return localStorage.getItem(STORAGE_KEYS.sidebarHidden) === "1";
  } catch {
    return false;
  }
}
function setSidebarHidden(hidden) {
  try {
    localStorage.setItem(STORAGE_KEYS.sidebarHidden, hidden ? "1" : "0");
  } catch {}
}

async function getApiKeyInteractive() {
  return GEMINI_API_KEY;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(historyItems) {
  try {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(historyItems));
  } catch {}
}

function addToHistory(questionText, steps, mode) {
  const items = loadHistory();
  const entry = {
    id: Date.now(),
    questionText,
    steps,
    mode,
    ts: new Date().toISOString(),
  };
  const updated = [entry, ...items];
  saveHistory(updated);
  renderHistory();
}

function clearResults() {
  results.innerHTML = "";
  // Show welcome state when results are cleared
  const welcomeState = document.getElementById("welcomeState");
  if (welcomeState) {
    welcomeState.classList.remove("hidden");
  }
}

// Image preview helpers
function ensurePreviewCard() {
  const existing = document.getElementById("imagePreviewCard");
  if (existing) return existing;
  const content = document.querySelector(".content");
  if (!content) return null;
  const card = document.createElement("div");
  card.className = "card preview-card";
  card.id = "imagePreviewCard";
  const title = document.createElement("h3");
  title.className = "type-title";
  title.textContent = "Image Preview";
  const img = document.createElement("img");
  img.id = "imagePreviewImg";
  img.alt = "Selected image preview";
  card.appendChild(title);
  card.appendChild(img);
  const actionsSection = document.querySelector(".actions");
  if (actionsSection && actionsSection.parentElement === content) {
    content.insertBefore(card, actionsSection.nextSibling);
  } else {
    content.appendChild(card);
  }
  return card;
}

function showImagePreview(src) {
  const card = ensurePreviewCard();
  if (!card) return null;

  // Hide welcome state when showing image preview
  const welcomeState = document.getElementById("welcomeState");
  if (welcomeState) {
    welcomeState.classList.add("hidden");
  }

  const img = card.querySelector("img#imagePreviewImg");
  if (img) img.src = src;
  return img;
}

function clearImagePreview() {
  const card = document.getElementById("imagePreviewCard");
  if (card && card.parentElement) card.parentElement.removeChild(card);

  // Show welcome state when image preview is cleared
  const welcomeState = document.getElementById("welcomeState");
  if (welcomeState && results.innerHTML === "") {
    welcomeState.classList.remove("hidden");
  }
}

function highlightKeyTerms(text) {
  // Simple highlighting for words like number names, operations, equals, fraction, etc.
  const patterns = [
    /\b(sum|add|plus|total|increase)\b/gi,
    /\b(subtract|minus|difference|decrease)\b/gi,
    /\b(multiply|times|product)\b/gi,
    /\b(divide|quotient|fraction)\b/gi,
    /\b(equal|equals|=)\b/gi,
    /\b(fraction|decimal|percent|percentage)\b/gi,
    /\b(variable|equation|unknown)\b/gi,
    /\b(step|tip|example)\b/gi,
    /\b(area|perimeter|angle|triangle|square|rectangle|circle)\b/gi,
    /\b(estimate|round|approximate)\b/gi,
  ];
  let output = text;
  patterns.forEach((re) => {
    output = output.replace(re, (m) => `<span class="highlight">${m}</span>`);
  });
  return output;
}

function renderSteps(steps) {
  clearResults();
  // Hide welcome state when showing results
  const welcomeState = document.getElementById("welcomeState");
  if (welcomeState) {
    welcomeState.classList.add("hidden");
  }

  steps.forEach((text, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    const index = document.createElement("div");
    index.className = "step-index";
    index.textContent = `Step ${idx + 1}`;
    const content = document.createElement("div");
    content.className = "content";
    content.innerHTML = highlightKeyTerms(text);
    card.appendChild(index);
    card.appendChild(content);
    results.appendChild(card);
  });
  if (resultsToolbar)
    resultsToolbar.classList.toggle("hidden", steps.length === 0);
}

// Text-to-Speech helpers
let ttsUtterance = null;
function speakText(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    ttsUtterance = new SpeechSynthesisUtterance(text);
    ttsUtterance.rate = 1.0;
    ttsUtterance.pitch = 1.0;
    window.speechSynthesis.speak(ttsUtterance);
  } catch {}
}
function stopSpeaking() {
  try {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch {}
}

// Read-aloud with per-step highlighting
function speakStepsWithHighlight() {
  if (!("speechSynthesis" in window)) return;
  const stepCards = Array.from(document.querySelectorAll("#results .card"));
  const stepTexts = stepCards
    .map((c) => c.querySelector(".content")?.textContent?.trim() || "")
    .filter(Boolean);
  if (!stepTexts.length) return;

  // Clear any previous
  window.speechSynthesis.cancel();
  stepCards.forEach((card) => card.classList.remove("reading"));

  let index = 0;
  const speakNext = () => {
    if (index >= stepTexts.length) {
      return;
    }
    const card = stepCards[index];
    const utter = new SpeechSynthesisUtterance(stepTexts[index]);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.onstart = () => {
      card.classList.add("reading");
    };
    utter.onend = () => {
      card.classList.remove("reading");
      index += 1;
      speakNext();
    };
    utter.onerror = () => {
      card.classList.remove("reading");
      index += 1;
      speakNext();
    };
    window.speechSynthesis.speak(utter);
  };
  speakNext();
}

function renderHistory() {
  const items = loadHistory();
  historyList.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "history-item mini";
    empty.textContent =
      "No history yet. Your explained questions will show here.";
    historyList.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const el = document.createElement("div");
    el.className = "history-item";
    // Title + View button row
    const head = document.createElement("div");
    head.className = "history-head";
    const h4 = document.createElement("h4");
    h4.textContent =
      item.questionText.slice(0, 120) +
      (item.questionText.length > 120 ? "…" : "");
    const meta = document.createElement("div");
    meta.className = "mini";
    const date = new Date(item.ts);
    meta.textContent = `${date.toLocaleString()} · ${
      item.mode ? "Detailed" : "Quick"
    } mode`;

    const viewBtn = document.createElement("button");
    viewBtn.className = "btn small";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", () => {
      renderSteps(item.steps);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // delete control
    const delBtn = document.createElement("button");
    delBtn.className = "btn small";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      const remaining = loadHistory().filter((h) => h.id !== item.id);
      saveHistory(remaining);
      renderHistory();
    });

    head.appendChild(h4);
    head.appendChild(viewBtn);
    head.appendChild(delBtn);
    el.appendChild(head);
    el.appendChild(meta);
    historyList.appendChild(el);
  });
}

async function ocrImageFromFile(file) {
  setProgress("Reading image...");
  const reader = new FileReader();
  const dataUrl = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
  setProgress("Recognizing text (OCR) ... this can take a few seconds");
  let data;
  try {
    ({ data } = await Tesseract.recognize(dataUrl, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          setProgress(`OCR: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    }));
  } catch (err) {
    throw new Error(getFriendlyErrorMessage(err, "ocr"));
  }
  const text = (data && data.text ? data.text : "").trim();
  return text;
}

async function ocrImageFromCanvas(canvas) {
  setProgress("Recognizing text (OCR) from camera...");
  const dataUrl = canvas.toDataURL("image/png");
  let data;
  try {
    ({ data } = await Tesseract.recognize(dataUrl, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          setProgress(`OCR: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    }));
  } catch (err) {
    throw new Error(getFriendlyErrorMessage(err, "ocr"));
  }
  const text = (data && data.text ? data.text : "").trim();
  return text;
}

function buildSystemPrompt(questionText) {
  return (
    "You are a friendly, patient homework tutor for kids aged 8–18." +
    " Your goal is to help them understand and solve problems on their own." +
    " The input question is: '" +
    questionText.replace(/\s+/g, " ").trim() +
    "'." +
    " Always break the solution into clear, numbered steps." +
    " Use very simple words and short sentences." +
    " Include a small, related example that is easier than the main problem." +
    " Give hints, not the final answer." +
    " If the question is hard (like algebra, fractions, geometry, or multi-step word problems)," +
    " start by explaining the main idea and then guide them through the method step-by-step." +
    " For math, show the formulas and explain each term in kid-friendly language." +
    " Encourage them at the end to try the last step themselves."
  );
}

async function callGemini(questionText, detailedMode) {
  setProgress("Asking AI for guidance...");
  const systemPrompt = buildSystemPrompt(questionText);
  const detailInstruction = detailedMode
    ? " Give a detailed walkthrough in 6–9 clear steps, with a short example and a quick tip. Keep sentences short and easy to read."
    : " Give a short walkthrough in 3–5 steps, keeping explanations simple and clear.";

  const userPrompt =
    "Mode: " + (detailedMode ? "Detailed" : "Quick") + ". " + detailInstruction;

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" +
    encodeURIComponent(GEMINI_API_KEY);

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: systemPrompt + "\n\n" + userPrompt }],
      },
    ],
    generationConfig: {
      temperature: detailedMode ? 0.55 : 0.4,
      maxOutputTokens: 500,
    },
  };

  let response;
  try {
    response = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      2,
      600
    );
  } catch (err) {
    throw new Error(getFriendlyErrorMessage(err, "ai"));
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      getFriendlyErrorMessage(
        new Error("" + response.status + " " + errText),
        "ai"
      )
    );
  }
  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => p.text || "")
    .join("\n")
    .trim();
  return text;
}

function splitIntoSteps(text) {
  // Try splitting by typical step markers: numbered list, newlines, etc.
  // Fallback to sentences if needed
  let parts = text
    .split(/\n\s*\n|\n\s*\d+\.|\n-\s+|\n•\s+|\n\s*Step\s*\d+:/gi)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  }
  // Cap at 12 steps
  return parts.slice(0, 12);
}

async function handleImageToHelp(fileOrCanvas) {
  try {
    hideRetryButton();
    setProgress("Starting...");
    clearResults();
    const isCanvas =
      typeof HTMLCanvasElement !== "undefined" &&
      fileOrCanvas instanceof HTMLCanvasElement;
    let text = isCanvas
      ? await ocrImageFromCanvas(fileOrCanvas)
      : await ocrImageFromFile(fileOrCanvas);

    if (!text) {
      setProgress("We couldn't find text in the image. Try a clearer photo.");
      return;
    }
    setProgress("Question detected. Preparing help...");
    const detailedMode = detailToggle.checked;

    const apiKey = await getApiKeyInteractive();
    if (!apiKey) {
      setProgress(
        "The AI service isn't available right now. Please try again later."
      );
      return;
    }

    const aiText = await callGemini(text, detailedMode, apiKey);
    const steps = splitIntoSteps(aiText);
    renderSteps(steps);
    setProgress("Done!", "done");

    addToHistory(text, steps, detailedMode);
  } catch (err) {
    console.error(err);
    setProgress(getFriendlyErrorMessage(err));
    try {
      if (typeof text === "string" && text.trim()) {
        lastAiRequest = {
          questionText: text.trim(),
          detailedMode: detailToggle.checked,
        };
        showRetryButton();
      }
    } catch {}
  }
}

async function handleTypedQuestion() {
  const text = (typedQuestion?.value || "").trim();
  if (!text) {
    setProgress("Please type a question first.");
    setTimeout(() => setProgress(""), 1200);
    return;
  }
  try {
    hideRetryButton();
    setProgress("Preparing help...");
    const detailedMode = detailToggle.checked;
    const aiText = await callGemini(text, detailedMode);
    const steps = splitIntoSteps(aiText);
    renderSteps(steps);
    setProgress("Done!", "done");
    if (resultsToolbar)
      resultsToolbar.classList.toggle("hidden", steps.length === 0);
    addToHistory(text, steps, detailedMode);
  } catch (err) {
    console.error(err);
    setProgress(getFriendlyErrorMessage(err, "ai"));
    lastAiRequest = { questionText: text, detailedMode: detailToggle.checked };
    showRetryButton();
  }
}

// Camera handling
let mediaStream = null;

async function openCamera() {
  try {
    cameraModal.classList.add("show");
    cameraModal.setAttribute("aria-hidden", "false");
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    cameraVideo.srcObject = mediaStream;
  } catch (err) {
    setProgress(getFriendlyErrorMessage(err, "camera"));
    closeCamera();
  }
}

function closeCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  cameraVideo.srcObject = null;
  cameraModal.classList.remove("show");
  cameraModal.setAttribute("aria-hidden", "true");
}

function capturePhoto() {
  if (!cameraVideo.videoWidth) return;
  const w = cameraVideo.videoWidth;
  const h = cameraVideo.videoHeight;
  cameraCanvas.width = w;
  cameraCanvas.height = h;
  const ctx = cameraCanvas.getContext("2d");
  ctx.drawImage(cameraVideo, 0, 0, w, h);
  return cameraCanvas;
}

// Event listeners
uploadPhotoBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) {
    const objectUrl = URL.createObjectURL(file);
    const imgEl = showImagePreview(objectUrl);
    if (imgEl) {
      imgEl.onload = () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
      };
    }
    handleImageToHelp(file);
  }
  fileInput.value = "";
});

takePhotoBtn.addEventListener("click", () => {
  openCamera();
});

// Type Question button in header
const typeQuestionBtn = document.getElementById("typeQuestionBtn");
typeQuestionBtn?.addEventListener("click", () => {
  if (!typeInCard) return;
  const willShow = typeInCard.classList.contains("hidden");
  typeInCard.classList.toggle("hidden", !willShow);

  // Hide welcome state when showing type question
  const welcomeState = document.getElementById("welcomeState");
  if (welcomeState) {
    welcomeState.classList.toggle("hidden", willShow);
  }

  if (willShow) {
    typedQuestion?.focus();
    window.scrollTo({ top: typeInCard.offsetTop || 0, behavior: "smooth" });
  }
});

typeAnswerBtn?.addEventListener("click", () => {
  if (!typeInCard) return;
  const willShow = typeInCard.classList.contains("hidden");
  typeInCard.classList.toggle("hidden", !willShow);
  typeAnswerBtn.setAttribute("aria-expanded", String(willShow));
  if (willShow) {
    typedQuestion?.focus();
    window.scrollTo({ top: typeInCard.offsetTop || 0, behavior: "smooth" });
  }
});

closeCameraModal.addEventListener("click", closeCamera);
xCameraModal.addEventListener("click", closeCamera);

captureBtn.addEventListener("click", async () => {
  const canvas = capturePhoto();
  closeCamera();
  if (canvas) {
    try {
      const dataUrl = canvas.toDataURL("image/png");
      showImagePreview(dataUrl);
    } catch {}
    await handleImageToHelp(canvas);
  }
});

detailToggle.addEventListener("change", () => {
  setModeDetailed(detailToggle.checked);
});

clearHistoryBtn.addEventListener("click", () => {
  saveHistory([]);
  renderHistory();
});

explainTypedBtn.addEventListener("click", handleTypedQuestion);
clearTypedBtn.addEventListener("click", () => {
  if (typedQuestion) typedQuestion.value = "";
});
speakBtn.addEventListener("click", () => {
  speakStepsWithHighlight();
});
stopSpeakBtn.addEventListener("click", stopSpeaking);
closeResultsBtn?.addEventListener("click", () => {
  stopSpeaking();
  clearResults();
  setProgress("");
  if (resultsToolbar) resultsToolbar.classList.add("hidden");
  clearImagePreview();
  hideRetryButton();
});

// Init
(function init() {
  detailToggle.checked = getModeDetailed();
  renderHistory();
  if (resultsToolbar) resultsToolbar.classList.add("hidden");
})();

// Sidebar toggle
toggleSidebarBtn?.addEventListener("click", () => {
  const layout = document.querySelector(".layout");
  const historyPanel = document.querySelector(".history-panel");
  if (!layout || !historyPanel) return;

  const isCurrentlyHidden = historyPanel.classList.contains("hidden");

  if (isCurrentlyHidden) {
    // History is currently hidden, so show it
    historyPanel.classList.remove("hidden");
    layout.classList.remove("history-hidden");

    // Update button to show "Hide"
    const icon = toggleSidebarBtn.querySelector("i");
    const text = toggleSidebarBtn.querySelector("span");
    icon.className = "fa-solid fa-eye-slash icon";
    text.textContent = "Hide";

    setSidebarHidden(false);
  } else {
    // History is currently shown, so hide it
    historyPanel.classList.add("hidden");
    layout.classList.add("history-hidden");

    // Update button to show "Show"
    const icon = toggleSidebarBtn.querySelector("i");
    const text = toggleSidebarBtn.querySelector("span");
    icon.className = "fa-solid fa-eye icon";
    text.textContent = "Show";

    setSidebarHidden(true);
  }
});

// Apply saved sidebar state after DOM ready
window.addEventListener("DOMContentLoaded", () => {
  const hidden = getSidebarHidden();
  const layout = document.querySelector(".layout");
  const historyPanel = document.querySelector(".history-panel");
  const toggleBtn = document.getElementById("toggleSidebarBtn");
  const headerHistoryBtn = document.getElementById("emergencyShowHistoryBtn");

  if (!layout || !historyPanel) {
    console.error("History panel or layout not found");
    return;
  }

  // Ensure history panel starts visible by default
  if (hidden === undefined || hidden === null) {
    // No saved state, default to visible
    historyPanel.classList.remove("hidden");
    layout.classList.remove("history-hidden");
    if (toggleBtn) {
      const icon = toggleBtn.querySelector("i");
      const text = toggleBtn.querySelector("span");
      if (icon && text) {
        icon.className = "fa-solid fa-eye-slash icon";
        text.textContent = "Hide";
      }
    }
    setSidebarHidden(false);
    return;
  }

  // Apply the saved state
  historyPanel.classList.toggle("hidden", hidden);
  layout.classList.toggle("history-hidden", hidden);

  // Update button text and icon based on saved state
  if (toggleBtn) {
    const icon = toggleBtn.querySelector("i");
    const text = toggleBtn.querySelector("span");

    if (icon && text) {
      if (hidden) {
        // History is hidden
        icon.className = "fa-solid fa-eye icon";
        text.textContent = "Show";
      } else {
        // History is shown (default state)
        icon.className = "fa-solid fa-eye-slash icon";
        text.textContent = "Hide";
      }
    }
  }

  // Ensure header history button is always visible and shows correct state
  if (headerHistoryBtn) {
    headerHistoryBtn.style.display = "flex";
    headerHistoryBtn.style.alignItems = "center";
    headerHistoryBtn.style.gap = "6px";
  }

  // Init BGM to muted by default on load (override any previous state)
  try {
    localStorage.setItem("hhai_bgm_enabled", "0");
  } catch {}
  bgmAudio.pause();
  bgmIcon?.classList.remove("fa-music");
  bgmIcon?.classList.add("fa-volume-xmark");
  bgmLabel && (bgmLabel.textContent = "Music");
  bgmToggleBtn?.classList.remove("bgm-playing");
  stopBgmFlow();
  // Initialize custom rounded font picker
  initCustomFontPicker();

  // Tip bubble removed as requested
});

// Help modal open/close
helpBtn?.addEventListener("click", () => {
  helpModal?.classList.add("show");
  helpModal?.setAttribute("aria-hidden", "false");
});
closeHelpModal?.addEventListener("click", () => {
  helpModal?.classList.remove("show");
  helpModal?.setAttribute("aria-hidden", "true");
});
xHelpModal?.addEventListener("click", () => {
  helpModal?.classList.remove("show");
  helpModal?.setAttribute("aria-hidden", "true");
});
helpOkBtn?.addEventListener("click", () => {
  helpModal?.classList.remove("show");
  helpModal?.setAttribute("aria-hidden", "true");
});

// Font switcher
fontPicker?.addEventListener("change", () => {
  const val = fontPicker.value || "font-patrick";
  const htmlEl = document.documentElement;
  htmlEl.classList.remove(
    "font-kalam",
    "font-patrick",
    "font-caveat",
    "font-gochi",
    "font-shantell",
    "font-inter"
  );
  htmlEl.classList.add(val);
  // Reflect selection on the <select> itself so the closed control shows sample font
  fontPicker.style.fontFamily = getComputedStyle(
    document.documentElement
  ).getPropertyValue("font-family");
  // Update custom trigger (if using custom dropdown)
  const customTrigger = document.querySelector(".font-select-custom .trigger");
  if (customTrigger && fontPicker.selectedIndex >= 0) {
    const opt = fontPicker.options[fontPicker.selectedIndex];
    customTrigger.textContent = opt.textContent;
    customTrigger.style.fontFamily = opt.style?.fontFamily || "";
  }
  try {
    localStorage.setItem(STORAGE_KEYS.fontClass, val);
  } catch {}
});

// Apply saved font on load (or current dropdown value as default)
(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.fontClass);
    const toApply = saved || fontPicker?.value || "font-kalam";
    const htmlEl = document.documentElement;
    htmlEl.classList.remove(
      "font-kalam",
      "font-patrick",
      "font-caveat",
      "font-gochi",
      "font-shantell",
      "font-inter"
    );
    htmlEl.classList.add(toApply);
    if (fontPicker) fontPicker.value = toApply;
    if (fontPicker) {
      fontPicker.style.fontFamily = getComputedStyle(
        document.documentElement
      ).getPropertyValue("font-family");
    }
  } catch {}
})();

// Build a custom, rounded dropdown for the font picker so the menu has rounded corners and per-option fonts
function initCustomFontPicker() {
  if (!fontPicker) return;
  const wrapper = document.createElement("div");
  wrapper.className = "font-select-custom";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const selected =
    fontPicker.options[fontPicker.selectedIndex] || fontPicker.options[0];
  if (selected) {
    trigger.textContent = selected.textContent;
    trigger.style.fontFamily = selected.style?.fontFamily || "";
  }
  const menu = document.createElement("ul");
  menu.className = "menu";
  menu.setAttribute("role", "listbox");
  Array.from(fontPicker.options).forEach((opt) => {
    const li = document.createElement("li");
    li.textContent = opt.textContent;
    li.dataset.value = opt.value;
    li.style.fontFamily = opt.style?.fontFamily || "";
    li.setAttribute("role", "option");
    if (opt.selected) li.setAttribute("aria-selected", "true");
    li.addEventListener("click", () => {
      wrapper.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      fontPicker.value = opt.value;
      fontPicker.dispatchEvent(new Event("change", { bubbles: true }));
      Array.from(menu.children).forEach((n) =>
        n.removeAttribute("aria-selected")
      );
      li.setAttribute("aria-selected", "true");
    });
    menu.appendChild(li);
  });
  trigger.addEventListener("click", () => {
    const willOpen = !wrapper.classList.contains("open");
    document
      .querySelectorAll(".font-select-custom.open")
      .forEach((el) => el.classList.remove("open"));
    wrapper.classList.toggle("open", willOpen);
    trigger.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) {
      menu.style.minWidth = Math.max(wrapper.offsetWidth, 180) + "px";
    }
  });
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      wrapper.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    }
  });
  fontPicker.insertAdjacentElement("afterend", wrapper);
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);
  fontPicker.style.display = "none";
}

// Background music controls
const BGM_KEY = "hhai_bgm_enabled";

// Visual flow layer for music animation
let bgmFlowIntervalId = null;
function getOrCreateBgmFlowLayer() {
  let layer = document.querySelector(".bgm-flow-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "bgm-flow-layer";
    document.body.appendChild(layer);
  }
  return layer;
}

function spawnBgmParticle() {
  if (!bgmToggleBtn) return;
  // Limit total active particles to avoid clutter
  const existing = document.querySelectorAll(".bgm-particle").length;
  if (existing >= 6) return;
  const rect = bgmToggleBtn.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const layer = getOrCreateBgmFlowLayer();
  const particle = document.createElement("div");
  particle.className = "bgm-particle";
  particle.style.left = startX + "px";
  particle.style.top = startY + "px";

  // Localized drift just around the icon area, biased slightly upward
  const dx = Math.random() * 80 - 40; // -40px to +40px
  const dy = -(60 + Math.random() * 80); // -60px to -140px
  particle.style.setProperty("--dx", dx + "px");
  particle.style.setProperty("--dy", dy + "px");

  particle.addEventListener("animationend", () => {
    particle.remove();
  });
  layer.appendChild(particle);
}

function startBgmFlow() {
  if (bgmFlowIntervalId) return;
  getOrCreateBgmFlowLayer();
  // Gentle start
  spawnBgmParticle();
  bgmFlowIntervalId = window.setInterval(() => {
    // Emit a single particle occasionally
    if (Math.random() < 0.65) {
      spawnBgmParticle();
    }
  }, 1800);
}

function stopBgmFlow() {
  if (bgmFlowIntervalId) {
    clearInterval(bgmFlowIntervalId);
    bgmFlowIntervalId = null;
  }
}
function setBgmEnabled(enabled) {
  try {
    localStorage.setItem(BGM_KEY, enabled ? "1" : "0");
  } catch {}
  if (!bgmAudio) return;
  // Reflect playing state on the toggle button for styling (e.g., show GIF)
  bgmToggleBtn?.classList.toggle("bgm-playing", enabled);
  if (enabled) {
    bgmAudio.volume = 0.35;
    bgmAudio.play().catch(() => {});
    bgmIcon?.classList.remove("fa-volume-xmark");
    bgmIcon?.classList.add("fa-music");
    bgmLabel && (bgmLabel.textContent = "Music");
    startBgmFlow();
  } else {
    bgmAudio.pause();
    bgmIcon?.classList.remove("fa-music");
    bgmIcon?.classList.add("fa-volume-xmark");
    bgmLabel && (bgmLabel.textContent = "Music");
    stopBgmFlow();
  }
}

bgmToggleBtn?.addEventListener("click", () => {
  const current = localStorage.getItem(BGM_KEY) === "1";
  setBgmEnabled(!current);
});

// Minimal coach bubble helper
function showCoachBubble() {
  try {
    if (!coachOverlay || !detailToggle) return;
    const host = detailToggle.closest(".mode-toggle");
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const bubble = document.createElement("div");
    bubble.className = "coach-bubble";
    bubble.style.left = Math.max(16, rect.left) + "px";
    bubble.style.top = rect.bottom + 8 + window.scrollY + "px";
    bubble.innerHTML =
      "<div><strong>Tip</strong>: Use this switch to choose Quick or Detailed help.</div>";
    const actions = document.createElement("div");
    actions.className = "coach-actions";
    const btn = document.createElement("button");
    btn.className = "btn small";
    btn.textContent = "Got it";
    btn.addEventListener("click", () => {
      coachOverlay.innerHTML = "";
      coachOverlay.setAttribute("aria-hidden", "true");
    });
    actions.appendChild(btn);
    bubble.appendChild(actions);
    coachOverlay.innerHTML = "";
    coachOverlay.appendChild(bubble);
    coachOverlay.setAttribute("aria-hidden", "false");
    // Auto dismiss after 6s
    setTimeout(() => {
      coachOverlay.innerHTML = "";
      coachOverlay.setAttribute("aria-hidden", "true");
    }, 6000);
  } catch {}
}

// Theme toggle (persisted)
const THEME_KEY = "hhai_theme_dark";
function applyThemeFromStorage() {
  const isDark = localStorage.getItem(THEME_KEY) === "1";
  document.documentElement.classList.toggle("dark", isDark);
  if (themeIcon) {
    themeIcon.classList.toggle("fa-moon", !isDark);
    themeIcon.classList.toggle("fa-sun", isDark);
  }
  // Update theme toggle label to reflect current theme
  const themeLabelEl = themeToggleBtn
    ? themeToggleBtn.querySelector(".label")
    : null;
  if (themeLabelEl) {
    themeLabelEl.textContent = isDark ? "Dark" : "Light";
  }
}
applyThemeFromStorage();

themeToggleBtn?.addEventListener("click", () => {
  const isDark = !(localStorage.getItem(THEME_KEY) === "1");
  try {
    localStorage.setItem(THEME_KEY, isDark ? "1" : "0");
  } catch {}
  applyThemeFromStorage();
});

// Sketch overlay logic
let sketchCtx = null;
let isDrawing = false;
let lastX = 0,
  lastY = 0;

function resizeSketchCanvas() {
  if (!sketchCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  sketchCanvas.width = Math.floor(sketchCanvas.clientWidth * dpr);
  sketchCanvas.height = Math.floor(sketchCanvas.clientHeight * dpr);
  sketchCtx = sketchCanvas.getContext("2d");
  sketchCtx.scale(dpr, dpr);
  sketchCtx.lineJoin = "round";
  sketchCtx.lineCap = "round";
  sketchCtx.lineWidth = 4;
  sketchCtx.strokeStyle = "#ef4444";
}

function startDraw(e) {
  isDrawing = true;
  const rect = sketchCanvas.getBoundingClientRect();
  lastX = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  lastY = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
}
function draw(e) {
  if (!isDrawing) return;
  const rect = sketchCanvas.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  sketchCtx.beginPath();
  sketchCtx.moveTo(lastX, lastY);
  sketchCtx.lineTo(x, y);
  sketchCtx.stroke();
  lastX = x;
  lastY = y;
}
function endDraw() {
  isDrawing = false;
}

sketchToggleBtn?.addEventListener("click", () => {
  if (!sketchOverlay) return;
  const willShow = !sketchOverlay.classList.contains("show");
  sketchOverlay.classList.toggle("show", willShow);
  sketchOverlay.setAttribute("aria-hidden", String(!willShow));
  if (willShow) {
    resizeSketchCanvas();
  }
});

sketchClearBtn?.addEventListener("click", () => {
  if (sketchCtx && sketchCanvas) {
    sketchCtx.clearRect(0, 0, sketchCanvas.width, sketchCanvas.height);
  }
});
sketchCloseBtn?.addEventListener("click", () => {
  sketchOverlay?.classList.remove("show");
  sketchOverlay?.setAttribute("aria-hidden", "true");
});

window.addEventListener("resize", () => {
  if (sketchOverlay?.classList.contains("show")) resizeSketchCanvas();
});

// Pointer events for drawing
sketchCanvas?.addEventListener("mousedown", startDraw);
sketchCanvas?.addEventListener("touchstart", startDraw, { passive: true });
sketchCanvas?.addEventListener("mousemove", draw);
sketchCanvas?.addEventListener("touchmove", draw, { passive: true });
["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((ev) =>
  sketchCanvas?.addEventListener(ev, endDraw)
);

// Emergency show history button (now in header - always visible)
document
  .getElementById("emergencyShowHistoryBtn")
  ?.addEventListener("click", () => {
    const layout = document.querySelector(".layout");
    const historyPanel = document.querySelector(".history-panel");
    const toggleBtn = document.getElementById("toggleSidebarBtn");

    if (!layout || !historyPanel) return;

    const isCurrentlyHidden = historyPanel.classList.contains("hidden");

    if (isCurrentlyHidden) {
      // History is currently hidden, so show it
      historyPanel.classList.remove("hidden");
      layout.classList.remove("history-hidden");

      // Update the toggle button state in history panel
      if (toggleBtn) {
        const icon = toggleBtn.querySelector("i");
        const text = toggleBtn.querySelector("span");
        if (icon && text) {
          icon.className = "fa-solid fa-eye-slash icon";
          text.textContent = "Hide";
        }
      }

      // Save the state
      setSidebarHidden(false);
    } else {
      // History is currently shown, so hide it
      historyPanel.classList.add("hidden");
      layout.classList.add("history-hidden");

      // Update the toggle button state in history panel
      if (toggleBtn) {
        const icon = toggleBtn.querySelector("i");
        const text = toggleBtn.querySelector("span");
        if (icon && text) {
          icon.className = "fa-solid fa-eye icon";
          text.textContent = "Show";
        }
      }

      // Save the state
      setSidebarHidden(true);
    }
  });
