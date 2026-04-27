const state = {
  selectedId: null,
  meta: null,
  tenders: [],
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return response.json();
}

function createSourceChecklist(sources) {
  const container = document.getElementById("sourceChecklist");
  container.innerHTML = "";
  sources.forEach((source) => {
    const label = document.createElement("label");
    label.className = "checklist-item";
    label.innerHTML = `
      <input type="checkbox" value="${source}" checked />
      <span>${source}</span>
    `;
    container.appendChild(label);
  });
}

function populateSelect(selectId, values, withAll = true) {
  const select = document.getElementById(selectId);
  const current = select.value;
  select.innerHTML = withAll ? `<option value="">All</option>` : "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = current;
}

function renderStats(stats) {
  const grid = document.getElementById("statsGrid");
  const scoreBands = stats.score_bands || {};
  const reviews = stats.reviews || [];
  const qualified = reviews.find((item) => item.review_status === "qualified")?.count || 0;
  grid.innerHTML = `
    <div class="stat-card">
      <span class="label">High-fit notices</span>
      <strong>${scoreBands.high_fit || 0}</strong>
    </div>
    <div class="stat-card">
      <span class="label">Medium-fit notices</span>
      <strong>${scoreBands.medium_fit || 0}</strong>
    </div>
    <div class="stat-card">
      <span class="label">Total tracked</span>
      <strong>${scoreBands.total || 0}</strong>
    </div>
    <div class="stat-card">
      <span class="label">Qualified by team</span>
      <strong>${qualified}</strong>
    </div>
  `;
}

function badgeClass(label) {
  return ["high", "medium", "low", "discard"].includes(label) ? label : "low";
}

function renderResults(items, total) {
  state.tenders = items;
  const list = document.getElementById("resultsList");
  const meta = document.getElementById("resultsMeta");
  meta.textContent = `${items.length} shown / ${total} total`;

  if (!items.length) {
    const fitMin = document.getElementById("fitMin").value;
    const hint =
      total > 0
        ? `No notices match the current filters. Try lowering the minimum fit score from ${fitMin} or clearing the search box.`
        : "No notices match the current filters yet.";
    list.innerHTML = `<div class="result-card"><div class="muted">${hint}</div></div>`;
    document.getElementById("detailPane").innerHTML = `No detail to show.`;
    return;
  }

  if (!items.some((item) => item.id === state.selectedId)) {
    state.selectedId = items[0].id;
  }

  list.innerHTML = items
    .map((item) => {
      const active = item.id === state.selectedId ? "active" : "";
      return `
        <article class="result-card ${active}" data-id="${item.id}">
          <div class="result-topline">
            <span class="badge ${badgeClass(item.score_label)}">${item.fit_score} ${item.score_label}</span>
            <span class="badge review">${item.review_status}</span>
            <span class="mono-text">${item.source}</span>
          </div>
          <h4 class="result-title">${item.title}</h4>
          <div class="muted">${item.buyer_name || "Unknown buyer"} · ${item.country || "Unknown country"}</div>
          <div class="badge-row">
            <span class="mono-text">Published: ${item.publication_date || "n/a"}</span>
            <span class="mono-text">Deadline: ${item.deadline_date || "n/a"}</span>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".result-card[data-id]").forEach((node) => {
    node.addEventListener("click", () => loadTenderDetail(node.dataset.id));
  });

  loadTenderDetail(state.selectedId);
}

function renderTokens(items, negative = false) {
  if (!items || !items.length) {
    return `<span class="muted">None</span>`;
  }
  return `<div class="list-inline">${items
    .map((item) => `<span class="token ${negative ? "negative" : ""}">${item}</span>`)
    .join("")}</div>`;
}

function renderDetail(item) {
  const matched = item.matched_terms || {};
  const breakdown = item.breakdown || {};
  const detailPane = document.getElementById("detailPane");
  detailPane.classList.remove("empty-state");
  detailPane.innerHTML = `
    <div class="detail-grid">
      <div class="detail-header">
        <div class="badge-row">
          <span class="badge ${badgeClass(item.score_label)}">${item.fit_score} ${item.score_label}</span>
          <span class="badge review">${item.review_status}</span>
          <span class="mono-text">${item.source}</span>
        </div>
        <h4>${item.title}</h4>
        <div class="muted">${item.buyer_name || "Unknown buyer"} · ${item.country || "Unknown country"}</div>
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
          <div><dt>Notice type</dt><dd>${item.notice_type || "n/a"}</dd></div>
          <div><dt>CPV codes</dt><dd>${(item.cpv_codes || []).join(", ") || "n/a"}</dd></div>
        </div>
      </div>

      <div class="detail-card review-actions">
        <h5>Review</h5>
        <div class="button-row">
          <button class="mini-button" data-review="new">New</button>
          <button class="mini-button" data-review="qualified">Qualified</button>
          <button class="mini-button" data-review="watch">Watch</button>
          <button class="mini-button" data-review="rejected">Rejected</button>
        </div>
        <textarea id="reviewNotes" placeholder="Add SDR notes, buyer context, or routing advice...">${item.review_notes || ""}</textarea>
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

  detailPane.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", async () => {
      const notes = document.getElementById("reviewNotes").value;
      await fetchJson(`/api/tenders/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_status: button.dataset.review,
          review_notes: notes,
        }),
      });
      await refreshData();
      await loadTenderDetail(item.id);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function loadTenderDetail(id) {
  state.selectedId = Number(id);
  const item = await fetchJson(`/api/tenders/${id}`);
  renderDetail(item);
  document.querySelectorAll(".result-card[data-id]").forEach((node) => {
    node.classList.toggle("active", Number(node.dataset.id) === Number(id));
  });
}

function currentFilterQuery() {
  const params = new URLSearchParams();
  const q = document.getElementById("searchQuery").value.trim();
  const source = document.getElementById("sourceFilter").value;
  const country = document.getElementById("countryFilter").value;
  const review = document.getElementById("reviewFilter").value;
  const fitMin = document.getElementById("fitMin").value;

  if (q) params.set("q", q);
  if (source) params.set("source", source);
  if (country) params.set("country", country);
  if (review) params.set("review_status", review);
  params.set("fit_min", fitMin);
  params.set("limit", "50");
  return params;
}

async function refreshData() {
  const stats = await fetchJson("/api/stats");
  renderStats(stats);

  const params = currentFilterQuery();
  const data = await fetchJson(`/api/tenders?${params.toString()}`);
  renderResults(data.items, data.total);
  document.getElementById("exportLink").href = `/api/export.csv?${params.toString()}`;
}

async function runSync() {
  const sourceCheckboxes = [...document.querySelectorAll("#sourceChecklist input:checked")];
  const payload = {
    days_back: Number(document.getElementById("daysBack").value),
    limit_per_source: Number(document.getElementById("limitPerSource").value),
    sources: sourceCheckboxes.map((node) => node.value),
  };
  const status = document.getElementById("syncStatus");
  status.textContent = "Sync running...";
  try {
    const result = await fetchJson("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const message = result.runs
      .map((run) => `${run.source}: ${run.status} (${run.inserted_count} new / ${run.updated_count} updated)`)
      .join(" | ");
    status.textContent = message;
    await initializeMeta();
    await refreshData();
  } catch (error) {
    status.textContent = `Sync failed: ${error.message}`;
  }
}

async function runRescore() {
  const status = document.getElementById("syncStatus");
  status.textContent = "Re-scoring...";
  try {
    const result = await fetchJson("/api/rescore", { method: "POST" });
    status.textContent = `Re-scored ${result.rescored} notices.`;
    await refreshData();
  } catch (error) {
    status.textContent = `Re-score failed: ${error.message}`;
  }
}

async function initializeMeta() {
  state.meta = await fetchJson("/api/meta");
  createSourceChecklist(state.meta.sources);
  populateSelect("sourceFilter", state.meta.sources);
  populateSelect("countryFilter", state.meta.countries);
  document.getElementById("daysBack").value = state.meta.defaults.days_back;
  document.getElementById("limitPerSource").value = state.meta.defaults.limit_per_source;
}

function wireUi() {
  document.getElementById("applyFiltersButton").addEventListener("click", refreshData);
  document.getElementById("syncButton").addEventListener("click", runSync);
  document.getElementById("rescoreButton").addEventListener("click", runRescore);
  document.getElementById("fitMin").addEventListener("input", (event) => {
    document.getElementById("fitMinValue").textContent = event.target.value;
  });
}

async function boot() {
  wireUi();
  await initializeMeta();
  await refreshData();
}

boot();
