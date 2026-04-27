const state = {
  data: null,
  snapshot: null,
  view: "real",
  selectedAccountId: null,
  selectedTenderId: null,
  accountFilters: {
    search: "",
    industry: "",
    stage: "",
    minScore: 0,
  },
  signalFilters: {
    search: "",
    signalType: "",
    category: "",
    confidence: 0,
  },
  tenderFilters: {
    search: "",
    source: "",
    country: "",
    minScore: 0,
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleString();
}

function formatRelative(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function formatRevenue(value) {
  if (value == null) return "Unknown";
  return value >= 1 ? `$${value.toFixed(1)}B` : `$${Math.round(value * 1000)}M`;
}

function scoreClass(score) {
  if (score >= 80) return "score-top";
  if (score >= 60) return "score-high";
  if (score >= 40) return "score-mid";
  return "";
}

function badgeClass(type, value) {
  return `badge ${type}-${String(value).toLowerCase().replaceAll("_", "-").replaceAll(" ", "-")}`;
}

function downloadText(filename, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const stringValue = String(value ?? "");
          return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
        })
        .join(","),
    )
    .join("\n");
}

function renderTokens(items) {
  if (!items || !items.length) {
    return `<div class="subtle">None</div>`;
  }
  return `<div class="tokens">${items.map((item) => `<span class="token">${escapeHtml(item)}</span>`).join("")}</div>`;
}

function flattenMatchedTerms(matchedTerms) {
  if (!matchedTerms) return [];
  return Object.values(matchedTerms).flat().filter(Boolean);
}

async function loadRadar() {
  const response = await fetch("./data/radar.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load radar.json");
  }
  return response.json();
}

async function loadSnapshot() {
  const response = await fetch("./data/snapshot.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load snapshot.json");
  }
  return response.json();
}

async function loadDatasets() {
  const [radar, snapshot] = await Promise.all([loadRadar(), loadSnapshot()]);
  return { radar, snapshot };
}

function filteredAccounts() {
  return state.data.accounts.filter((account) => {
    const haystack = `${account.name} ${account.country} ${account.owner || ""} ${account.notes || ""} ${account.signals
      .map((signal) => `${signal.title} ${signal.description}`)
      .join(" ")}`.toLowerCase();
    if (state.accountFilters.search && !haystack.includes(state.accountFilters.search.toLowerCase())) return false;
    if (state.accountFilters.industry && account.industry !== state.accountFilters.industry) return false;
    if (state.accountFilters.stage && account.stage !== state.accountFilters.stage) return false;
    if (account.score < state.accountFilters.minScore) return false;
    return true;
  });
}

function filteredSignals() {
  return state.data.signals.filter((signal) => {
    const haystack = `${signal.accountName} ${signal.title} ${signal.description}`.toLowerCase();
    if (state.signalFilters.search && !haystack.includes(state.signalFilters.search.toLowerCase())) return false;
    if (state.signalFilters.signalType && signal.signalType !== state.signalFilters.signalType) return false;
    if (state.signalFilters.category && signal.category !== state.signalFilters.category) return false;
    if (signal.confidence < state.signalFilters.confidence) return false;
    return true;
  });
}

function filteredTenders() {
  return state.snapshot.tenders.filter((tender) => {
    const haystack = `${tender.title} ${tender.description || ""} ${tender.raw_text || ""} ${tender.buyer_name || ""} ${tender.country || ""}`.toLowerCase();
    if (state.tenderFilters.search && !haystack.includes(state.tenderFilters.search.toLowerCase())) return false;
    if (state.tenderFilters.source && tender.source !== state.tenderFilters.source) return false;
    if (state.tenderFilters.country && tender.country !== state.tenderFilters.country) return false;
    if (Number(tender.fit_score) < state.tenderFilters.minScore) return false;
    return true;
  });
}

function selectedAccount(accounts = filteredAccounts()) {
  return accounts.find((account) => account.id === state.selectedAccountId) || accounts[0] || null;
}

function selectedTender(tenders = filteredTenders()) {
  return tenders.find((tender) => String(tender.id) === String(state.selectedTenderId)) || tenders[0] || null;
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
  renderView();
}

function renderHero() {
  const heroMetrics = document.getElementById("heroMetrics");
  const uniqueSources = state.snapshot?.meta?.sources?.length || new Set(state.snapshot?.tenders.map((item) => item.source) || []).size;
  const uniqueCountries = state.snapshot?.meta?.countries?.length || new Set(state.snapshot?.tenders.map((item) => item.country) || []).size;
  const highFit = (state.snapshot?.tenders || []).filter((item) => Number(item.fit_score) >= 60).length;

  heroMetrics.innerHTML = [
    ["Real notices", state.snapshot?.total || 0],
    ["High-fit real", highFit],
    ["Sources", uniqueSources],
    ["Countries", uniqueCountries],
  ]
    .map(
      ([label, value]) => `
        <div class="hero-metric">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderRealTenders() {
  const tenders = filteredTenders();
  const selected = selectedTender(tenders);
  const sources = state.snapshot.meta?.sources || [...new Set(state.snapshot.tenders.map((item) => item.source))];
  const countries = state.snapshot.meta?.countries || [...new Set(state.snapshot.tenders.map((item) => item.country).filter(Boolean))];
  const highFit = tenders.filter((item) => Number(item.fit_score) >= 60).length;

  return `
    <div class="grid-4">
      ${[
        ["Real public notices", state.snapshot.total, "Official public procurement notices synced from live sources."],
        ["Filtered notices", tenders.length, "Current results after applying the real-data filters."],
        ["High-fit in view", highFit, "Pitcher-fit scoring is derived, but the notices themselves are real."],
        ["Official source coverage", sources.length, "Distinct public sources in the current real snapshot."],
      ]
        .map(
          ([label, value, hint]) => `
            <div class="metric-card">
              <div class="label">${escapeHtml(label)}</div>
              <strong>${escapeHtml(value)}</strong>
              <p>${escapeHtml(hint)}</p>
            </div>
          `,
        )
        .join("")}
    </div>

    <section class="panel" style="margin-top:18px;">
      <div class="panel-header">
        <div>
          <h3>Real tender filters</h3>
          <p>Everything in this tab comes from official public procurement sources. The fit score and reasons are derived by the scoring engine.</p>
        </div>
        <a class="pill-link" href="https://github.com/ismailpitcher/TenderIntelligenceEngine/actions" target="_blank" rel="noreferrer">Refresh workflow</a>
      </div>
      <div class="filter-grid">
        <div class="field">
          <label for="tenderSearch">Search</label>
          <input id="tenderSearch" type="text" value="${escapeHtml(state.tenderFilters.search)}" placeholder="sales enablement, CRM, platform" />
        </div>
        <div class="field">
          <label for="tenderSource">Source</label>
          <select id="tenderSource">
            <option value="">All</option>
            ${sources.map((source) => `<option value="${escapeHtml(source)}" ${state.tenderFilters.source === source ? "selected" : ""}>${escapeHtml(source)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="tenderCountry">Country</label>
          <select id="tenderCountry">
            <option value="">All</option>
            ${countries.map((country) => `<option value="${escapeHtml(country)}" ${state.tenderFilters.country === country ? "selected" : ""}>${escapeHtml(country)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="tenderScore">Minimum fit score</label>
          <input id="tenderScore" type="number" min="0" max="100" value="${escapeHtml(state.tenderFilters.minScore)}" />
        </div>
      </div>
    </section>

    <div class="two-col">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Real tender list</h3>
            <p>${tenders.length} notice(s) in view across ${countries.length} country entries.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Notice</th>
                <th>Source</th>
                <th>Score</th>
                <th>Buyer</th>
                <th>Published</th>
              </tr>
            </thead>
            <tbody>
              ${
                tenders.length
                  ? tenders
                      .map(
                        (tender) => `
                          <tr>
                            <td>
                              <a class="signal-link" href="#" data-tender-id="${escapeHtml(tender.id)}">${escapeHtml(tender.title)}</a>
                              <div class="subtle">${escapeHtml(tender.country || "Unknown country")} • ${escapeHtml(tender.notice_type || "Unknown type")}</div>
                            </td>
                            <td><span class="token">${escapeHtml(tender.source)}</span></td>
                            <td>
                              <div class="scorebar">
                                <div class="scorebar-head"><span>Fit</span><span>${escapeHtml(tender.fit_score)}</span></div>
                                <div class="scorebar-track"><div class="scorebar-fill ${scoreClass(Number(tender.fit_score))}" style="width:${Math.max(0, Math.min(100, Number(tender.fit_score)))}%"></div></div>
                              </div>
                            </td>
                            <td>${escapeHtml(tender.buyer_name || "Unknown buyer")}</td>
                            <td>${escapeHtml(formatRelative(tender.publication_date))}</td>
                          </tr>
                        `,
                      )
                      .join("")
                  : `<tr><td colspan="5"><div class="empty-state">No real notices match the current filters.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        ${
          selected
            ? `
              <div class="panel-header">
                <div>
                  <h3>${escapeHtml(selected.title)}</h3>
                  <p>${escapeHtml(selected.buyer_name || "Unknown buyer")} • ${escapeHtml(selected.country || "Unknown country")}</p>
                </div>
                <div class="badge-row">
                  <a class="pill-link" href="${escapeHtml(selected.source_url)}" target="_blank" rel="noreferrer">Open notice</a>
                  ${
                    selected.document_url && selected.document_url !== selected.source_url
                      ? `<a class="pill-link" href="${escapeHtml(selected.document_url)}" target="_blank" rel="noreferrer">Open document</a>`
                      : ""
                  }
                </div>
              </div>

              <div class="detail-card">
                <div class="badge-row">
                  <span class="token">${escapeHtml(selected.source)}</span>
                  <span class="token">${escapeHtml(selected.score_label || "unlabeled")}</span>
                  <span class="token">${escapeHtml(selected.country || "Unknown country")}</span>
                </div>
                <p>${escapeHtml(selected.description || "No description available.")}</p>
              </div>

              <div class="detail-card">
                <h4>Notice metadata</h4>
                <div class="meta-inline">
                  <span>Published: ${escapeHtml(selected.publication_date || "n/a")}</span>
                  <span>Deadline: ${escapeHtml(selected.deadline_date || "n/a")}</span>
                  <span>Type: ${escapeHtml(selected.notice_type || "n/a")}</span>
                </div>
                <div style="margin-top:12px;">
                  ${renderTokens((selected.cpv_codes || []).map(String))}
                </div>
              </div>

              <div class="detail-card">
                <h4>Why the scoring engine matched it</h4>
                <p class="subtle">The notice is real. The reasons below are derived scoring explanations, not source-authored facts.</p>
                ${renderTokens(selected.positive_reasons || [])}
              </div>

              <div class="detail-card">
                <h4>Negative reasons</h4>
                ${renderTokens(selected.negative_reasons || [])}
              </div>

              <div class="detail-card">
                <h4>Matched terms</h4>
                ${renderTokens(flattenMatchedTerms(selected.matched_terms))}
              </div>
            `
            : `<div class="empty-state">No real tender selected.</div>`
        }
      </section>
    </div>
  `;
}

function renderAccounts() {
  const accounts = filteredAccounts();
  const account = selectedAccount(accounts);
  const industries = [...new Set(state.data.accounts.map((item) => item.industry))];
  const stages = [...new Set(state.data.accounts.map((item) => item.stage))];

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Demo accounts</h3>
          <p>This tab is seeded product-demo data for the account-based workflow. It is not live private-market signal data.</p>
        </div>
        <button id="accountsCsvButton" class="pill-link" type="button">Export demo CSV</button>
      </div>
      <div class="filter-grid">
        <div class="field">
          <label for="accountSearch">Search</label>
          <input id="accountSearch" type="text" value="${escapeHtml(state.accountFilters.search)}" placeholder="Novo, CRM, omnichannel" />
        </div>
        <div class="field">
          <label for="accountIndustry">Industry</label>
          <select id="accountIndustry">
            <option value="">All</option>
            ${industries.map((industry) => `<option value="${escapeHtml(industry)}" ${state.accountFilters.industry === industry ? "selected" : ""}>${escapeHtml(state.data.accounts.find((item) => item.industry === industry)?.industryLabel || industry)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="accountStage">Stage</label>
          <select id="accountStage">
            <option value="">All</option>
            ${stages.map((stage) => `<option value="${escapeHtml(stage)}" ${state.accountFilters.stage === stage ? "selected" : ""}>${escapeHtml(state.data.accounts.find((item) => item.stage === stage)?.stageLabel || stage)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="accountScore">Minimum score</label>
          <input id="accountScore" type="number" min="0" max="100" value="${escapeHtml(state.accountFilters.minScore)}" />
        </div>
      </div>
    </section>

    <div class="accounts-layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Filtered demo account list</h3>
            <p>${accounts.length} account(s) in view.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Stage</th>
                <th>Score</th>
                <th>Confidence</th>
                <th>Top category</th>
              </tr>
            </thead>
            <tbody>
              ${accounts
                .map(
                  (item) => `
                    <tr>
                      <td>
                        <a class="account-link" href="#" data-account-id="${escapeHtml(item.id)}">${escapeHtml(item.name)}</a>
                        <div class="subtle">${escapeHtml(item.country)} • ${escapeHtml(item.owner || "Unassigned")}</div>
                      </td>
                      <td><span class="${badgeClass("stage", item.stage)}">${escapeHtml(item.stageLabel)}</span></td>
                      <td>
                        <div class="scorebar">
                          <div class="scorebar-head"><span>Score</span><span>${escapeHtml(item.score)}</span></div>
                          <div class="scorebar-track"><div class="scorebar-fill ${scoreClass(item.score)}" style="width:${item.score}%"></div></div>
                        </div>
                      </td>
                      <td><span class="${badgeClass("conf", item.confidence >= 80 ? "high" : item.confidence >= 60 ? "med" : "low")}">${item.confidence}%</span></td>
                      <td>${escapeHtml(item.topCategories[0]?.label || "General enablement")}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        ${
          account
            ? `
              <div class="panel-header">
                <div>
                  <h3>${escapeHtml(account.name)}</h3>
                  <p>${escapeHtml(account.notes || "No notes")}</p>
                </div>
                <button class="pill-link" type="button" id="accountMarkdownButton">Download markdown</button>
              </div>
              <div class="detail-card">
                <div class="badge-row">
                  <span class="${badgeClass("stage", account.stage)}">${escapeHtml(account.stageLabel)}</span>
                  <span class="${badgeClass("conf", account.confidence >= 80 ? "high" : account.confidence >= 60 ? "med" : "low")}">${account.confidence}% confidence</span>
                </div>
                <div class="subtle">${escapeHtml(account.industryLabel)} • ${escapeHtml(account.country)} • ${escapeHtml(formatRevenue(account.revenue))}</div>
                <div class="tokens">
                  ${account.topCategories.map((category) => `<span class="token">${escapeHtml(category.label)}</span>`).join("")}
                </div>
              </div>

              <div class="detail-card">
                <h4>Recommended outreach angle</h4>
                <p>${escapeHtml(account.outreach.angle)}</p>
              </div>

              <div class="detail-card">
                <h4>Suggested email</h4>
                <pre>${escapeHtml(account.outreach.email)}</pre>
              </div>

              <div class="detail-card">
                <h4>Suggested LinkedIn message</h4>
                <pre>${escapeHtml(account.outreach.linkedin)}</pre>
              </div>

              <div class="detail-card">
                <h4>Top stakeholders</h4>
                <div class="settings-group">
                  ${account.stakeholders
                    .map(
                      (stakeholder) => `
                        <div class="stakeholder-card">
                          <h4>${escapeHtml(stakeholder.name)}</h4>
                          <div class="subtle">${escapeHtml(stakeholder.title)} • ${escapeHtml(stakeholder.function)}</div>
                          <p>${escapeHtml(stakeholder.suggestedMessageAngle)}</p>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              </div>

              <div class="detail-card">
                <h4>Detected signals for this account</h4>
                <div class="timeline">
                  ${account.signals
                    .map(
                      (signal) => `
                        <article class="timeline-item">
                          <div class="badge-row">
                            <span class="${badgeClass("signal", signal.signalType)}">${escapeHtml(signal.signalTypeLabel)}</span>
                            <span class="${badgeClass("conf", signal.confidence >= 80 ? "high" : signal.confidence >= 60 ? "med" : "low")}">${signal.confidence}% confidence</span>
                            <span class="token">${escapeHtml(signal.categoryLabel)}</span>
                          </div>
                          <h4>${escapeHtml(signal.title)}</h4>
                          <div class="meta-inline">
                            <span>${escapeHtml(formatRelative(signal.publishedAt || signal.detectedAt))}</span>
                            <span>${escapeHtml(signal.sourceName)}</span>
                          </div>
                          <p>${escapeHtml(signal.evidenceSnippet)}</p>
                          <p><strong>Recommended action:</strong> ${escapeHtml(signal.recommendedAction)}</p>
                          <a class="pill-link" href="${escapeHtml(signal.sourceUrl)}" target="_blank" rel="noreferrer">Open evidence</a>
                        </article>
                      `,
                    )
                    .join("")}
                </div>
              </div>

              <div class="detail-card">
                <h4>Why this account scored this way</h4>
                <div class="settings-group">
                  ${account.scoringExplanation
                    .map(
                      (line) => `
                        <div class="explanation-card">
                          <h4>${escapeHtml(line.label)}</h4>
                          <div class="subtle">${line.value >= 0 ? "+" : ""}${escapeHtml(line.value)}</div>
                          <p>${escapeHtml(line.reason)}</p>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              </div>
            `
            : `<div class="empty-state">No accounts match the current filters.</div>`
        }
      </section>
    </div>
  `;
}

function renderSignals() {
  const signals = filteredSignals();
  const selected = signals[0] || null;
  const signalTypes = [...new Set(state.data.signals.map((item) => item.signalType))];
  const categories = [...new Set(state.data.signals.map((item) => item.category))];

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Demo signal feed</h3>
          <p>This tab is seeded demo signal data for the account-based product concept, not live private-market monitoring.</p>
        </div>
      </div>
      <div class="filter-grid">
        <div class="field">
          <label for="signalSearch">Search</label>
          <input id="signalSearch" type="text" value="${escapeHtml(state.signalFilters.search)}" placeholder="RFP, Salesforce, Seismic" />
        </div>
        <div class="field">
          <label for="signalType">Signal type</label>
          <select id="signalType">
            <option value="">All</option>
            ${signalTypes.map((type) => `<option value="${escapeHtml(type)}" ${state.signalFilters.signalType === type ? "selected" : ""}>${escapeHtml(state.data.signals.find((item) => item.signalType === type)?.signalTypeLabel || type)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="signalCategory">Category</label>
          <select id="signalCategory">
            <option value="">All</option>
            ${categories.map((category) => `<option value="${escapeHtml(category)}" ${state.signalFilters.category === category ? "selected" : ""}>${escapeHtml(state.data.signals.find((item) => item.category === category)?.categoryLabel || category)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="signalConfidence">Minimum confidence</label>
          <input id="signalConfidence" type="number" min="0" max="100" value="${escapeHtml(state.signalFilters.confidence)}" />
        </div>
      </div>
    </section>

    <div class="signals-layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Filtered demo signals</h3>
            <p>${signals.length} signal(s) in view.</p>
          </div>
        </div>
        <div class="timeline">
          ${
            signals.length
              ? signals
                  .map(
                    (signal) => `
                      <article class="timeline-item">
                        <div class="badge-row">
                          <span class="${badgeClass("signal", signal.signalType)}">${escapeHtml(signal.signalTypeLabel)}</span>
                          <span class="${badgeClass("conf", signal.confidence >= 80 ? "high" : signal.confidence >= 60 ? "med" : "low")}">${signal.confidence}% confidence</span>
                        </div>
                        <h4>${escapeHtml(signal.title)}</h4>
                        <div class="meta-inline">
                          <span>${escapeHtml(signal.accountName)}</span>
                          <span>${escapeHtml(signal.categoryLabel)}</span>
                          <span>${escapeHtml(formatRelative(signal.publishedAt || signal.detectedAt))}</span>
                        </div>
                        <p>${escapeHtml(signal.evidenceSnippet)}</p>
                      </article>
                    `,
                  )
                  .join("")
              : `<div class="empty-state">No signals match the current filters.</div>`
          }
        </div>
      </section>

      <section class="panel">
        ${
          selected
            ? `
              <div class="panel-header">
                <div>
                  <h3>${escapeHtml(selected.title)}</h3>
                  <p>${escapeHtml(selected.accountName)} • ${escapeHtml(formatDate(selected.publishedAt || selected.detectedAt))}</p>
                </div>
                <div class="badge-row">
                  <a class="pill-link" href="#" data-account-id="${escapeHtml(selected.accountId)}">Open account</a>
                  <a class="pill-link" href="${escapeHtml(selected.sourceUrl)}" target="_blank" rel="noreferrer">Open evidence</a>
                </div>
              </div>
              <div class="detail-card">
                <div class="badge-row">
                  <span class="${badgeClass("signal", selected.signalType)}">${escapeHtml(selected.signalTypeLabel)}</span>
                  <span class="${badgeClass("conf", selected.confidence >= 80 ? "high" : selected.confidence >= 60 ? "med" : "low")}">${selected.confidence}% confidence</span>
                  <span class="token">${escapeHtml(selected.categoryLabel)}</span>
                </div>
                <p>${escapeHtml(selected.description)}</p>
              </div>
              <div class="detail-card">
                <h4>Evidence snippet</h4>
                <p>${escapeHtml(selected.evidenceSnippet)}</p>
              </div>
              <div class="detail-card">
                <h4>Recommended next step</h4>
                <p>${escapeHtml(selected.recommendedAction)}</p>
              </div>
            `
            : `<div class="empty-state">No detail available.</div>`
        }
      </section>
    </div>
  `;
}

function renderSettings() {
  const settings = state.data.settings;
  const groupedKeywords = settings.keywords.reduce((acc, keyword) => {
    if (!acc[keyword.groupName]) acc[keyword.groupName] = [];
    acc[keyword.groupName].push(keyword);
    return acc;
  }, {});

  return `
    <div class="settings-layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Demo scoring weights</h3>
            <p>These settings belong to the seeded account-intelligence demo, not the real public tender feed.</p>
          </div>
        </div>
        <div class="settings-group">
          ${settings.scoringWeights
            .map(
              (weight) => `
                <div class="explanation-card">
                  <h4>${escapeHtml(weight.label)}</h4>
                  <div class="subtle">${escapeHtml(weight.value)}</div>
                  <p>${escapeHtml(weight.description)}</p>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Demo provider registry</h3>
            <p>Mock today, replaceable with approved real sources later.</p>
          </div>
        </div>
        <div class="settings-group">
          ${settings.providerConfigs
            .map(
              (provider) => `
                <div class="provider-card">
                  <div class="badge-row">
                    <span class="${badgeClass("provider", provider.status)}">${escapeHtml(provider.statusLabel)}</span>
                  </div>
                  <h4>${escapeHtml(provider.name)}</h4>
                  <p>${escapeHtml(provider.description)}</p>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Demo keyword taxonomy</h3>
            <p>Seeded search terms grouped by commercial meaning.</p>
          </div>
        </div>
        <div class="settings-group">
          ${Object.entries(groupedKeywords)
            .map(
              ([groupName, items]) => `
                <div class="detail-card">
                  <h4>${escapeHtml(groupName)}</h4>
                  <div class="tokens">
                    ${items.map((item) => `<span class="token">${escapeHtml(item.term)}</span>`).join("")}
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Demo target profile and competitors</h3>
            <p>ICP settings and competitive context used by the seeded demo workflow.</p>
          </div>
        </div>
        <div class="detail-card">
          <h4>Target profile</h4>
          <div class="tokens">
            ${settings.targetSettings.map((item) => `<span class="token">${escapeHtml(item.label)}</span>`).join("")}
          </div>
        </div>
        <div class="detail-card">
          <h4>Competitors</h4>
          <div class="tokens">
            ${settings.competitors.map((item) => `<span class="token">${escapeHtml(item.name)}</span>`).join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderView() {
  const root = document.getElementById("viewRoot");
  if (!state.data || !state.snapshot) {
    root.innerHTML = `<div class="loading-card">Loading real and demo data...</div>`;
    return;
  }

  if (!state.selectedAccountId && state.data.accounts.length) {
    state.selectedAccountId = state.data.accounts[0].id;
  }
  if (!state.selectedTenderId && state.snapshot.tenders.length) {
    state.selectedTenderId = String(state.snapshot.tenders[0].id);
  }

  const views = {
    real: renderRealTenders(),
    accounts: renderAccounts(),
    signals: renderSignals(),
    settings: renderSettings(),
  };

  root.innerHTML = views[state.view];
  attachViewEvents();
}

function attachViewEvents() {
  document.querySelectorAll("[data-nav]").forEach((node) => {
    node.addEventListener("click", () => setView(node.dataset.nav));
  });

  document.querySelectorAll("[data-account-id]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      state.selectedAccountId = node.dataset.accountId;
      setView("accounts");
    });
  });

  document.querySelectorAll("[data-tender-id]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      state.selectedTenderId = node.dataset.tenderId;
      setView("real");
    });
  });

  const tenderSearch = document.getElementById("tenderSearch");
  const tenderSource = document.getElementById("tenderSource");
  const tenderCountry = document.getElementById("tenderCountry");
  const tenderScore = document.getElementById("tenderScore");

  if (tenderSearch) {
    tenderSearch.addEventListener("input", (event) => {
      state.tenderFilters.search = event.target.value;
      renderView();
    });
  }
  if (tenderSource) {
    tenderSource.addEventListener("change", (event) => {
      state.tenderFilters.source = event.target.value;
      renderView();
    });
  }
  if (tenderCountry) {
    tenderCountry.addEventListener("change", (event) => {
      state.tenderFilters.country = event.target.value;
      renderView();
    });
  }
  if (tenderScore) {
    tenderScore.addEventListener("input", (event) => {
      state.tenderFilters.minScore = Number(event.target.value || 0);
      renderView();
    });
  }

  const accountSearch = document.getElementById("accountSearch");
  const accountIndustry = document.getElementById("accountIndustry");
  const accountStage = document.getElementById("accountStage");
  const accountScore = document.getElementById("accountScore");
  const accountsCsvButton = document.getElementById("accountsCsvButton");
  const accountMarkdownButton = document.getElementById("accountMarkdownButton");

  if (accountSearch) {
    accountSearch.addEventListener("input", (event) => {
      state.accountFilters.search = event.target.value;
      renderView();
    });
  }
  if (accountIndustry) {
    accountIndustry.addEventListener("change", (event) => {
      state.accountFilters.industry = event.target.value;
      renderView();
    });
  }
  if (accountStage) {
    accountStage.addEventListener("change", (event) => {
      state.accountFilters.stage = event.target.value;
      renderView();
    });
  }
  if (accountScore) {
    accountScore.addEventListener("input", (event) => {
      state.accountFilters.minScore = Number(event.target.value || 0);
      renderView();
    });
  }
  if (accountsCsvButton) {
    accountsCsvButton.addEventListener("click", () => {
      const rows = [
        ["Account Name", "Industry", "Country", "Stage", "Score", "Confidence", "Owner"],
        ...filteredAccounts().map((account) => [
          account.name,
          account.industryLabel,
          account.country,
          account.stageLabel,
          account.score,
          `${account.confidence}%`,
          account.owner || "",
        ]),
      ];
      downloadText("pitcher-demo-accounts.csv", toCsv(rows), "text/csv;charset=utf-8");
    });
  }
  if (accountMarkdownButton) {
    accountMarkdownButton.addEventListener("click", () => {
      const account = selectedAccount();
      if (account) {
        downloadText(`${account.name.toLowerCase().replace(/\s+/g, "-")}.md`, account.exports.markdown, "text/markdown;charset=utf-8");
      }
    });
  }

  const signalSearch = document.getElementById("signalSearch");
  const signalType = document.getElementById("signalType");
  const signalCategory = document.getElementById("signalCategory");
  const signalConfidence = document.getElementById("signalConfidence");

  if (signalSearch) {
    signalSearch.addEventListener("input", (event) => {
      state.signalFilters.search = event.target.value;
      renderView();
    });
  }
  if (signalType) {
    signalType.addEventListener("change", (event) => {
      state.signalFilters.signalType = event.target.value;
      renderView();
    });
  }
  if (signalCategory) {
    signalCategory.addEventListener("change", (event) => {
      state.signalFilters.category = event.target.value;
      renderView();
    });
  }
  if (signalConfidence) {
    signalConfidence.addEventListener("input", (event) => {
      state.signalFilters.confidence = Number(event.target.value || 0);
      renderView();
    });
  }
}

function attachStaticEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  document.getElementById("downloadReportButton").addEventListener("click", () => {
    if (!state.data) return;
    downloadText("pitcher-demo-report.md", state.data.fullReportMarkdown, "text/markdown;charset=utf-8");
  });

  document.getElementById("downloadAccountsButton").addEventListener("click", () => {
    if (!state.snapshot) return;
    const rows = [
      ["Source", "Title", "Buyer", "Country", "Publication Date", "Deadline", "Fit Score", "Score Label", "Source URL"],
      ...state.snapshot.tenders.map((tender) => [
        tender.source,
        tender.title,
        tender.buyer_name || "",
        tender.country || "",
        tender.publication_date || "",
        tender.deadline_date || "",
        tender.fit_score,
        tender.score_label || "",
        tender.source_url || "",
      ]),
    ];
    downloadText("pitcher-real-tenders.csv", toCsv(rows), "text/csv;charset=utf-8");
  });
}

async function boot() {
  attachStaticEvents();
  try {
    const { radar, snapshot } = await loadDatasets();
    state.data = radar;
    state.snapshot = snapshot;
    document.getElementById("generatedAt").textContent = formatDate(snapshot.generated_at);
    renderHero();
    renderView();
  } catch (error) {
    console.error(error);
    document.getElementById("viewRoot").innerHTML = `<div class="empty-state">Could not load the exported real or demo datasets.</div>`;
  }
}

boot();
