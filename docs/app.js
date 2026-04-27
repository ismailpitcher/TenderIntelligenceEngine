const REVIEW_KEY = "tie-static-review-state-v1";

const state = {
  snapshot: null,
  filtered: [],
  selectedId: null,
  reviews: {},
};

function loadReviews() {
  try {
    state.reviews = JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}");
  } catch (_error) {
    state.reviews = {};
  }
}

function saveReviews() {
  localStorage.setItem(REVIEW_KEY, JSON.stringify(state.reviews));
}

function getReviewFor(item) {
  return state.reviews[item.external_id] || {
    review_status: item.review_status || "new",
    review_notes: item.review_notes || "",
  };
}

async function fetchSnapshot() {
  const response = await fetch("./data/snapshot.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load snapshot.json");
  }
  return response.json();
}

function populateSelect(selectId, values) {
  const select = document.getElementById(selectId);
  select.innerHTML = `<option value="">All</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function badgeClass(label) {
  return ["high", "medium", "low", "discard"].includes(label) ? label : "low";
}

function renderStats() {
  const grid = document.getElementById("statsGrid");
  const items = state.filtered;
  const qualified = items.filter((item) => getReviewFor(item).review_status === "qualified").length;
  const watch = items.filter((item) => getReviewFor(item).review_status === "watch").length;
  const highFit = items.filter((item) => Number(item.fit_score) >= 75).length;
  const gridCards = [
    ["Filtered notices", items.length],
    ["High-fit in view", highFit],
    ["Qualified in view", qualified],
    ["Watchlist in view", watch],
  ];

  grid.innerHTML = gridCards
    .map(
      ([label, value]) => `
        <div class="stat-card">
          <span class="label">${label}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join("");
}

function currentFilters() {
  return {
    q: document.getElementById("searchQuery").value.trim().toLowerCase(),
    source: document.getElementById("sourceFilter").value,
    country: document.getElementById("countryFilter").value,
    reviewStatus: document.getElementById("reviewFilter").value,
    fitMin: Number(document.getElementById("fitMin").value),
  };
}

function applyFilters() {
  const filters = currentFilters();
  const items = state.snapshot.tenders.filter((item) => {
    const review = getReviewFor(item);
    const haystack = `${item.title} ${item.description} ${item.raw_text} ${item.buyer_name} ${item.country}`.toLowerCase();
    if (filters.q && !haystack.includes(filters.q)) return false;
    if (filters.source && item.source !== filters.source) return false;
    if (filters.country && item.country !== filters.country) return false;
    if (filters.reviewStatus && review.review_status !== filters.reviewStatus) return false;
    if (Number(item.fit_score) < filters.fitMin) return false;
    return true;
  });

  state.filtered = items;
  if (!items.some((item) => item.external_id === state.selectedId)) {
    state.selectedId = items[0]?.external_id || null;
  }
  renderStats();
  renderResults();
  renderDetail();
}

function renderResults() {
  const list = document.getElementById("resultsList");
  const meta = document.getElementById("resultsMeta");
  meta.textContent = `${state.filtered.length} shown / ${state.snapshot.total} total`;

  if (!state.filtered.length) {
    list.innerHTML = `<div class="result-card"><div class="muted">No notices match the current filters.</div></div>`;
    return;
  }

  list.innerHTML = state.filtered
    .map((item) => {
      const review = getReviewFor(item);
      const active = item.external_id === state.selectedId ? "active" : "";
      return `
        <article class="result-card ${active}" data-id="${item.external_id}">
          <div class="result-topline">
            <span class="badge ${badgeClass(item.score_label)}">${item.fit_score} ${item.score_label}</span>
            <span class="badge review">${review.review_status}</span>
            <span class="mono-text">${item.source}</span>
          </div>
          <h4 class="result-title">${escapeHtml(item.title)}</h4>
          <div class="muted">${escapeHtml(item.buyer_name || "Unknown buyer")} · ${escapeHtml(item.country || "Unknown country")}</div>
          <div class="badge-row">
            <span class="mono-text">Published: ${item.publication_date || "n/a"}</span>
            <span class="mono-text">Deadline: ${item.deadline_date || "n/a"}</span>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".result-card[data-id]").forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedId = node.dataset.id;
      renderResults();
      renderDetail();
    });
  });
}

function renderTokens(items, negative = false) {
  if (!items || !items.length) {
    return `<span class="muted">None</span>`;
  }
  return `<div class="list-inline">${items
    .map((item) => `<span class="token ${negative ? "negative" : ""}">${escapeHtml(item)}</span>`)
    .join("")}</div>`;
}

function renderDetail() {
  const item = state.filtered.find((entry) => entry.external_id === state.selectedId);
  const pane = document.getElementById("detailPane");
  if (!item) {
    pane.className = "detail-pane empty-state";
    pane.innerHTML = "Select a notice to inspect it and save local review state.";
    return;
  }

  const review = getReviewFor(item);
  const matched = item.matched_terms || {};
  const breakdown = item.breakdown || {};

  pane.className = "detail-pane";
  pane.innerHTML = `
    <div class="detail-grid">
      <div class="detail-header">
        <div class="badge-row">
          <span class="badge ${badgeClass(item.score_label)}">${item.fit_score} ${item.score_label}</span>
          <span class="badge review">${review.review_status}</span>
          <span class="mono-text">${item.source}</span>
        </div>
        <h4>${escapeHtml(item.title)}</h4>
        <div class="muted">${escapeHtml(item.buyer_name || "Unknown buyer")} · ${escapeHtml(item.country || "Unknown country")}</div>
      </div>

      <div class="detail-card">
        <h5>Why it matched</h5>
        <div class="kv-grid">
          <div><dt>Industry</dt><dd>${breakdown.industry || 0}</dd></div>
          <div><dt>Workflow</dt><dd>${breakdown.commercial_workflows || 0}</dd></div>
          <div><dt>Buyer team</dt><dd>${breakdown.buyer_teams || 0}</dd></div>
          <div><dt>Integration</dt><dd>${breakdown.integrations || 0}</dd></div>
          <div><dt>Scale</dt><dd>${breakdown.scale_signals || 0}</dd></div>
          <div><dt>Penalty</dt><dd>${(breakdown.negative_terms || 0) + (breakdown.physical_goods || 0) + (breakdown.cpv_negative || 0)}</dd></div>
        </div>
      </div>

      <div class="detail-card">
        <h5>Positive signals</h5>
        ${renderTokens([...(matched.industry || []), ...(matched.commercial_workflows || []), ...(matched.buyer_teams || []), ...(matched.integrations || []), ...(matched.scale_signals || [])])}
      </div>

      <div class="detail-card">
        <h5>Negative signals</h5>
        ${renderTokens([...(matched.negative_terms || []), ...(matched.physical_goods || []), ...(matched.negative_cpv_prefixes || [])], true)}
      </div>

      <div class="detail-card">
        <h5>Metadata</h5>
        <div class="kv-grid">
          <div><dt>Publication date</dt><dd>${item.publication_date || "n/a"}</dd></div>
          <div><dt>Deadline</dt><dd>${item.deadline_date || "n/a"}</dd></div>
          <div><dt>Notice type</dt><dd>${escapeHtml(item.notice_type || "n/a")}</dd></div>
          <div><dt>CPV codes</dt><dd>${(item.cpv_codes || []).join(", ") || "n/a"}</dd></div>
        </div>
      </div>

      <div class="detail-card review-actions">
        <h5>Local review</h5>
        <div class="button-row">
          <button class="mini-button" data-review="new">New</button>
          <button class="mini-button" data-review="qualified">Qualified</button>
          <button class="mini-button" data-review="watch">Watch</button>
          <button class="mini-button" data-review="rejected">Rejected</button>
        </div>
        <textarea id="reviewNotes" placeholder="Stored locally in this browser only.">${escapeHtml(review.review_notes || "")}</textarea>
      </div>

      <div class="detail-card">
        <h5>Notice text</h5>
        <div class="preformatted">${escapeHtml(item.raw_text || item.description || "No extracted text available.")}</div>
      </div>

      <div class="detail-card">
        <h5>Source links</h5>
        <div class="list-inline">
          <a href="${item.source_url}" target="_blank" rel="noreferrer">Open notice</a>
          ${item.document_url ? `<a href="${item.document_url}" target="_blank" rel="noreferrer">Open source document</a>` : ""}
        </div>
      </div>
    </div>
  `;

  pane.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", () => {
      const notes = document.getElementById("reviewNotes").value;
      state.reviews[item.external_id] = {
        review_status: button.dataset.review,
        review_notes: notes,
      };
      saveReviews();
      applyFilters();
    });
  });
}

function exportCurrentView() {
  const headers = [
    "external_id",
    "source",
    "title",
    "buyer_name",
    "country",
    "publication_date",
    "deadline_date",
    "fit_score",
    "score_label",
    "review_status",
    "review_notes",
    "source_url",
  ];

  const rows = state.filtered.map((item) => {
    const review = getReviewFor(item);
    return [
      item.external_id,
      item.source,
      item.title,
      item.buyer_name,
      item.country,
      item.publication_date,
      item.deadline_date,
      item.fit_score,
      item.score_label,
      review.review_status,
      review.review_notes || "",
      item.source_url,
    ];
  });

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "tender-intelligence-static-export.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function wireUi() {
  document.getElementById("applyFiltersButton").addEventListener("click", applyFilters);
  document.getElementById("fitMin").addEventListener("input", (event) => {
    document.getElementById("fitMinValue").textContent = event.target.value;
  });
  document.getElementById("exportCsvButton").addEventListener("click", exportCurrentView);
}

async function boot() {
  wireUi();
  loadReviews();
  state.snapshot = await fetchSnapshot();
  populateSelect("sourceFilter", state.snapshot.meta.sources || []);
  populateSelect("countryFilter", state.snapshot.meta.countries || []);
  document.getElementById("generatedAt").textContent = state.snapshot.generated_at;
  applyFilters();
}

boot().catch((error) => {
  document.getElementById("resultsList").innerHTML = `<div class="result-card"><div class="muted">${escapeHtml(error.message)}</div></div>`;
});

