const questions = Array.isArray(window.SERIES3_QUESTIONS) ? window.SERIES3_QUESTIONS : [];

const state = {
  search: "",
  category: "all",
  answerState: "all",
  selectedId: null,
};

const elements = {
  stats: document.querySelector("#stats"),
  searchInput: document.querySelector("#search-input"),
  categoryFilter: document.querySelector("#category-filter"),
  answerFilter: document.querySelector("#answer-filter"),
  resultsCount: document.querySelector("#results-count"),
  resultsList: document.querySelector("#results-list"),
  detailPanel: document.querySelector("#detail-panel"),
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function titleCase(value) {
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatAnswerLine(question, label) {
  if (!label) return "Not answered";

  const answerText = question.choices.find((choice) => choice.label === label)?.text;
  return answerText ? `${label}. ${answerText}` : label;
}

function getCategories() {
  return [...new Set(questions.map((question) => question.category))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function getVisibleQuestions() {
  const term = state.search.trim().toLowerCase();

  return questions.filter((question) => {
    if (state.category !== "all" && question.category !== state.category) return false;

    if (state.answerState === "answered" && question.isUnanswered) return false;
    if (state.answerState === "unanswered" && !question.isUnanswered) return false;

    if (!term) return true;

    const haystack = [
      question.questionId,
      question.category,
      question.prompt,
      question.explanation,
      question.correctAnswer,
      question.yourAnswer,
      question.tags.join(" "),
      ...question.choices.map((choice) => choice.text),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });
}

function getDominantCategory(list) {
  if (!list.length) return "None";

  const counts = new Map();
  list.forEach((question) => {
    counts.set(question.category, (counts.get(question.category) || 0) + 1);
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function renderStats() {
  const visible = getVisibleQuestions();
  const unanswered = questions.filter((question) => question.isUnanswered).length;
  const categories = new Set(questions.map((question) => question.category)).size;
  const dominant = getDominantCategory(visible);

  const cards = [
    { label: "Wrong Questions", value: `${questions.length}` },
    { label: "Visible Results", value: `${visible.length}` },
    { label: "Categories", value: `${categories}` },
    { label: "Focus Topic", value: dominant },
    { label: "Unanswered Misses", value: `${unanswered}` },
  ];

  elements.stats.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <span class="stat-label">${escapeHtml(card.label)}</span>
          <span class="stat-value">${escapeHtml(card.value)}</span>
        </article>
      `
    )
    .join("");
}

function renderCategoryFilter() {
  const options = ['<option value="all">All categories</option>']
    .concat(
      getCategories().map(
        (category) =>
          `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
      )
    )
    .join("");

  elements.categoryFilter.innerHTML = options;
  elements.categoryFilter.value = state.category;
}

function getSnippet(question) {
  return question.promptLines[0] || question.prompt || "Question text unavailable";
}

function renderResults() {
  const visible = getVisibleQuestions();
  elements.resultsCount.textContent = `${visible.length} matching questions`;

  if (!visible.length) {
    elements.resultsList.innerHTML = `
      <div class="empty-state">
        <p>No questions match this filter set yet.</p>
      </div>
    `;
    elements.detailPanel.innerHTML = `
      <div class="detail-empty">
        <p>Adjust the filters or search terms to bring a question back into view.</p>
      </div>
    `;
    return;
  }

  if (!visible.some((question) => question.questionId === state.selectedId)) {
    state.selectedId = visible[0].questionId;
  }

  elements.resultsList.innerHTML = visible
    .map((question) => {
      const isActive = question.questionId === state.selectedId;

      return `
        <button class="question-card ${isActive ? "is-active" : ""}" data-question-id="${escapeHtml(
          question.questionId
        )}">
          <div class="question-topline">
            <span class="question-id">Q${escapeHtml(question.questionId)}</span>
            <span class="category-pill">${escapeHtml(question.category)}</span>
          </div>

          <p class="question-snippet">${escapeHtml(getSnippet(question))}</p>

          <div class="answer-strip">
            <span class="answer-pill correct">Right: ${escapeHtml(formatAnswerLine(question, question.correctAnswer))}</span>
            <span class="answer-pill ${question.isUnanswered ? "neutral" : "user"}">Selected: ${escapeHtml(formatAnswerLine(question, question.yourAnswer))}</span>
          </div>

          <p class="meta-row">${escapeHtml(titleCase(question.tags.join(" • ") || "review"))}</p>
        </button>
      `;
    })
    .join("");

  elements.resultsList.querySelectorAll("[data-question-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.questionId;
      renderResults();
      renderDetail();
      window.location.hash = state.selectedId;
    });
  });
}

function renderChoiceList(question) {
  if (!question.choices.length) {
    return `<p class="meta-row">This entry did not include standard A-D choices in the OCR output.</p>`;
  }

  return `
    <div class="choice-list">
      ${question.choices
        .map((choice) => {
          const classes = [
            "choice-item",
            choice.label === question.correctAnswer ? "is-correct" : "",
            choice.label === question.yourAnswer ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return `
            <div class="${classes}">
              <span class="choice-label">${escapeHtml(choice.label)}.</span>
              <span>${escapeHtml(choice.text)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAnswerCard(title, value, tone = "neutral") {
  return `
    <article class="answer-card answer-card-${tone}">
      <span class="answer-card-label">${escapeHtml(title)}</span>
      <strong class="answer-card-value">${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderPromptLines(lines) {
  return `
    <div class="prompt-lines">
      ${lines.map((line) => `<p class="prompt-line">${escapeHtml(line)}</p>`).join("")}
    </div>
  `;
}

function renderExplanation(lines) {
  if (!lines.length) return `<p class="meta-row">No explanation was captured by OCR.</p>`;

  return `
    <div class="explanation-text">
      <p>${escapeHtml(lines.join(" "))}</p>
    </div>
  `;
}

function renderDetail() {
  const question = questions.find((entry) => entry.questionId === state.selectedId);

  if (!question) {
    elements.detailPanel.innerHTML = `
      <div class="detail-empty">
        <p>Select a question to inspect the OCR text and screenshot.</p>
      </div>
    `;
    return;
  }

  elements.detailPanel.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="detail-kicker">${escapeHtml(question.examLabel)}</p>
        <h2 class="detail-title">Question ${escapeHtml(question.questionId)}</h2>
        <p class="detail-subtitle">${escapeHtml(question.category)}</p>
      </div>
      <div class="pill-row">
        <span class="answer-pill correct">Right answer: ${escapeHtml(question.correctAnswer || "—")}</span>
        <span class="answer-pill ${question.isUnanswered ? "neutral" : "user"}">Selected answer: ${escapeHtml(question.yourAnswer || "—")}</span>
      </div>
    </div>

    <div class="pill-row">
      ${question.tags
        .map((tag) => `<span class="tag-pill category-pill">${escapeHtml(tag)}</span>`)
        .join("")}
    </div>

    <div class="detail-block">
      <h3>Question</h3>
      ${renderPromptLines(question.promptLines)}
    </div>

    <div class="detail-block">
      <h3>Offered Answers</h3>
      ${renderChoiceList(question)}
    </div>

    <div class="detail-block">
      <h3>Answer Review</h3>
      <div class="answer-summary-grid">
        ${renderAnswerCard("Selected answer", formatAnswerLine(question, question.yourAnswer), question.isUnanswered ? "neutral" : "user")}
        ${renderAnswerCard("Right answer", formatAnswerLine(question, question.correctAnswer), "correct")}
      </div>
    </div>

    <div class="detail-block">
      <h3>Explanation</h3>
      ${renderExplanation(question.explanationLines)}
    </div>

    <div class="detail-block">
      <details open>
        <summary>Original screenshot</summary>
        <div class="screenshot-wrap">
          <img src="${escapeHtml(question.localImage)}" alt="Screenshot for question ${escapeHtml(
            question.questionId
          )}" loading="lazy" />
          <div class="link-row">
            <a class="image-link" href="${escapeHtml(question.localImage)}" target="_blank" rel="noreferrer">
              Open image directly
            </a>
          </div>
        </div>
      </details>
    </div>

    <div class="detail-block">
      <details>
        <summary>Raw OCR text</summary>
        <div class="ocr-wrap">
          <pre>${escapeHtml(question.ocrText)}</pre>
        </div>
      </details>
    </div>
  `;
}

function syncStateFromHash() {
  const hash = window.location.hash.replace(/^#/, "").trim();
  if (hash && questions.some((question) => question.questionId === hash)) {
    state.selectedId = hash;
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderStats();
    renderResults();
    renderDetail();
  });

  elements.categoryFilter.addEventListener("change", (event) => {
    state.category = event.target.value;
    renderStats();
    renderResults();
    renderDetail();
  });

  elements.answerFilter.addEventListener("change", (event) => {
    state.answerState = event.target.value;
    renderStats();
    renderResults();
    renderDetail();
  });

  window.addEventListener("hashchange", () => {
    syncStateFromHash();
    renderResults();
    renderDetail();
  });
}

function init() {
  if (!questions.length) {
    elements.resultsList.innerHTML = `
      <div class="empty-state">
        <p>No OCR data is available yet. Run the build scripts first.</p>
      </div>
    `;
    return;
  }

  renderCategoryFilter();
  syncStateFromHash();
  state.selectedId ||= questions[0].questionId;

  renderStats();
  renderResults();
  renderDetail();
  bindEvents();
}

init();
