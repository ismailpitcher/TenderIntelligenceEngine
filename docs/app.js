"use strict";

(function () {
  const snapshotUrl = "./data/snapshot.json";
  const viewRoot = document.getElementById("viewRoot");
  const tabbar = document.getElementById("tabbar");
  const heroMetrics = document.getElementById("heroMetrics");
  const generatedAt = document.getElementById("generatedAt");
  const sourceSummary = document.getElementById("sourceSummary");
  const downloadReportButton = document.getElementById("downloadReportButton");
  const downloadAccountsButton = document.getElementById("downloadAccountsButton");
  const downloadNoticesButton = document.getElementById("downloadNoticesButton");

  const sourceLabels = {
    ted: "TED",
    boamp: "BOAMP",
    contracts_finder: "Contracts Finder",
    find_tender: "Find a Tender",
  };

  const state = {
    snapshot: null,
    accounts: [],
    view: "overview",
    selectedAccountId: null,
    selectedTenderId: null,
    accountFilters: {
      search: "",
      country: "all",
      source: "all",
      minScore: 0,
    },
    noticeFilters: {
      search: "",
      country: "all",
      source: "all",
      minScore: 0,
    },
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sourceLabel(source) {
    return sourceLabels[source] ?? String(source ?? "Unknown source")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatDate(value) {
    if (!value) {
      return "Unknown";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function formatDateTime(value) {
    if (!value) {
      return "Unknown";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function formatRelative(value) {
    if (!value) {
      return "Unknown";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    const diffMs = date.getTime() - Date.now();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (Math.abs(diffDays) < 1) {
      return "today";
    }
    if (Math.abs(diffDays) === 1) {
      return diffDays > 0 ? "in 1 day" : "1 day ago";
    }
    return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-GB").format(Number(value) || 0);
  }

  function formatScore(value) {
    const score = Number(value) || 0;
    return Math.round(score);
  }

  function scoreClass(score) {
    if (score >= 80) {
      return "score-top";
    }
    if (score >= 50) {
      return "score-high";
    }
    if (score >= 25) {
      return "score-mid";
    }
    return "";
  }

  function scoreTone(score) {
    if (score >= 80) {
      return "High fit";
    }
    if (score >= 50) {
      return "Medium fit";
    }
    if (score >= 20) {
      return "Low fit";
    }
    return "Weak fit";
  }

  function noticeUrl(tender) {
    return tender.source_url || tender.document_url || "";
  }

  function unique(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function flattenMatchedTerms(matchedTerms) {
    if (!matchedTerms || typeof matchedTerms !== "object") {
      return [];
    }
    return Object.values(matchedTerms)
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .filter(Boolean);
  }

  function excerptTender(tender) {
    const raw = tender.description || tender.raw_text || "";
    if (!raw) {
      return "No excerpt available from the source notice.";
    }
    const cleaned = raw.replace(/\s+/g, " ").trim();
    return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned;
  }

  function deadlineState(tender) {
    if (!tender.deadline_date) {
      return { label: "No deadline published", className: "stage-early-signal" };
    }
    const deadline = new Date(tender.deadline_date);
    if (Number.isNaN(deadline.getTime())) {
      return { label: "Deadline date unavailable", className: "stage-early-signal" };
    }
    const diffDays = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { label: "Deadline passed", className: "stage-post-decision" };
    }
    if (diffDays <= 7) {
      return { label: `Deadline ${formatRelative(tender.deadline_date)}`, className: "stage-active-rfp" };
    }
    return { label: `Deadline ${formatRelative(tender.deadline_date)}`, className: "stage-active-evaluation" };
  }

  function byNewestDate(left, right, field) {
    const leftDate = new Date(left[field] || 0).getTime();
    const rightDate = new Date(right[field] || 0).getTime();
    return rightDate - leftDate;
  }

  function tenderSort(left, right) {
    return (
      (Number(right.fit_score) || 0) - (Number(left.fit_score) || 0) ||
      byNewestDate(left, right, "publication_date") ||
      String(left.title || "").localeCompare(String(right.title || ""))
    );
  }

  function buildAccounts(tenders) {
    const grouped = new Map();

    tenders.forEach((tender) => {
      const buyerName = tender.buyer_name || "Unknown buyer";
      const country = tender.country || "Unknown";
      const key = `${buyerName}::${country}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: slugify(key),
          name: buyerName,
          country,
          notices: [],
        });
      }
      grouped.get(key).notices.push(tender);
    });

    return Array.from(grouped.values())
      .map((account) => {
        const notices = account.notices.sort(tenderSort);
        const sources = unique(notices.map((item) => sourceLabel(item.source)));
        const fitScores = notices.map((item) => Number(item.fit_score) || 0);
        const publicationDates = notices
          .map((item) => item.publication_date)
          .filter(Boolean)
          .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());
        const topReasons = unique(notices.flatMap((item) => item.positive_reasons || [])).slice(0, 6);
        const negativeReasons = unique(notices.flatMap((item) => item.negative_reasons || [])).slice(0, 4);
        const matchedTerms = unique(notices.flatMap((item) => flattenMatchedTerms(item.matched_terms))).slice(0, 12);

        return {
          ...account,
          sources,
          noticeCount: notices.length,
          maxFitScore: Math.max(...fitScores, 0),
          avgFitScore: fitScores.length ? fitScores.reduce((sum, value) => sum + value, 0) / fitScores.length : 0,
          latestPublication: publicationDates[0] || null,
          openNoticeCount: notices.filter((item) => {
            if (!item.deadline_date) {
              return false;
            }
            const deadline = new Date(item.deadline_date).getTime();
            return !Number.isNaN(deadline) && deadline >= Date.now();
          }).length,
          topReasons,
          negativeReasons,
          matchedTerms,
          notices,
        };
      })
      .sort(
        (left, right) =>
          right.maxFitScore - left.maxFitScore ||
          right.noticeCount - left.noticeCount ||
          new Date(right.latestPublication || 0).getTime() - new Date(left.latestPublication || 0).getTime()
      );
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function renderTokens(values) {
    if (!values || !values.length) {
      return '<div class="subtle">No matched terms were extracted for this item.</div>';
    }
    return `<div class="tokens">${values.map((value) => `<span class="token">${escapeHtml(value)}</span>`).join("")}</div>`;
  }

  function renderScoreBar(score) {
    const rounded = formatScore(score);
    return `
      <div class="scorebar">
        <div class="scorebar-head">
          <span>${scoreTone(rounded)}</span>
          <strong>${rounded}/100</strong>
        </div>
        <div class="scorebar-track">
          <div class="scorebar-fill ${scoreClass(rounded)}" style="width:${Math.max(0, Math.min(100, rounded))}%"></div>
        </div>
      </div>
    `;
  }

  function realAccounts() {
    return state.accounts;
  }

  function notices() {
    return (state.snapshot?.tenders ?? []).slice().sort(tenderSort);
  }

  function filteredAccounts() {
    const { search, country, source, minScore } = state.accountFilters;
    const query = search.trim().toLowerCase();

    return realAccounts().filter((account) => {
      const matchesSearch =
        !query ||
        account.name.toLowerCase().includes(query) ||
        account.notices.some((notice) => (notice.title || "").toLowerCase().includes(query));
      const matchesCountry = country === "all" || account.country === country;
      const matchesSource = source === "all" || account.sources.includes(sourceLabel(source));
      const matchesScore = account.maxFitScore >= Number(minScore || 0);
      return matchesSearch && matchesCountry && matchesSource && matchesScore;
    });
  }

  function filteredNotices() {
    const { search, country, source, minScore } = state.noticeFilters;
    const query = search.trim().toLowerCase();

    return notices().filter((notice) => {
      const matchesSearch =
        !query ||
        String(notice.title || "").toLowerCase().includes(query) ||
        String(notice.buyer_name || "").toLowerCase().includes(query) ||
        String(notice.description || "").toLowerCase().includes(query);
      const matchesCountry = country === "all" || notice.country === country;
      const matchesSource = source === "all" || notice.source === source;
      const matchesScore = (Number(notice.fit_score) || 0) >= Number(minScore || 0);
      return matchesSearch && matchesCountry && matchesSource && matchesScore;
    });
  }

  function sourceRunSummaries() {
    const recentRuns = state.snapshot?.stats?.recent_runs ?? [];
    const recentBySource = new Map();

    recentRuns.forEach((run) => {
      if (!recentBySource.has(run.source)) {
        recentBySource.set(run.source, run);
      }
    });

    return (state.snapshot?.meta?.sources ?? []).map((source) => {
      const latestRun = recentBySource.get(source);
      return {
        source,
        label: sourceLabel(source),
        latestRun,
        noticeCount: state.snapshot?.stats?.sources?.[source] ?? 0,
      };
    });
  }

  function defaultSelections() {
    const accounts = filteredAccounts();
    if (!accounts.some((account) => account.id === state.selectedAccountId)) {
      state.selectedAccountId = accounts[0]?.id ?? null;
    }

    const noticesList = filteredNotices();
    if (!noticesList.some((notice) => String(notice.id) === String(state.selectedTenderId))) {
      state.selectedTenderId = noticesList[0]?.id ?? null;
    }
  }

  function getSelectedAccount() {
    return realAccounts().find((account) => account.id === state.selectedAccountId) ?? null;
  }

  function getSelectedNotice() {
    return notices().find((notice) => String(notice.id) === String(state.selectedTenderId)) ?? null;
  }

  function heroMetricsHtml() {
    const snapshot = state.snapshot;
    if (!snapshot) {
      return "";
    }
    const totalNotices = snapshot.total ?? 0;
    const totalAccounts = realAccounts().length;
    const totalSources = (snapshot.meta?.sources ?? []).length;
    const openDeadlines = notices().filter((notice) => {
      if (!notice.deadline_date) {
        return false;
      }
      const deadline = new Date(notice.deadline_date).getTime();
      return !Number.isNaN(deadline) && deadline >= Date.now();
    }).length;

    return [
      ["Real notices", totalNotices],
      ["Buyer accounts", totalAccounts],
      ["Open deadlines", openDeadlines],
      ["Official sources", totalSources],
    ]
      .map(
        ([label, value]) => `
          <div class="hero-metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(formatNumber(value))}</strong>
          </div>
        `
      )
      .join("");
  }

  function overviewHtml() {
    const snapshot = state.snapshot;
    const scoreBands = snapshot?.stats?.score_bands ?? {};
    const sourceHealth = sourceRunSummaries();
    const topAccounts = realAccounts().slice(0, 8);
    const recentNotices = notices().slice(0, 8);

    return `
      <section class="grid-4">
        <article class="metric-card">
          <span class="label">Real notices tracked</span>
          <strong>${escapeHtml(formatNumber(snapshot?.total ?? 0))}</strong>
          <p>Official public procurement notices currently stored in the latest snapshot.</p>
        </article>
        <article class="metric-card">
          <span class="label">Buyer accounts derived</span>
          <strong>${escapeHtml(formatNumber(realAccounts().length))}</strong>
          <p>Each account is a real buyer organization grouped from one or more public notices.</p>
        </article>
        <article class="metric-card">
          <span class="label">Countries represented</span>
          <strong>${escapeHtml(formatNumber((snapshot?.meta?.countries ?? []).length))}</strong>
          <p>Coverage in the current export across approved official procurement sources.</p>
        </article>
        <article class="metric-card">
          <span class="label">Signals with some fit</span>
          <strong>${escapeHtml(formatNumber(notices().filter((notice) => (Number(notice.fit_score) || 0) > 0).length))}</strong>
          <p>Real notices where the Pitcher-fit layer found at least one matching reason.</p>
        </article>
      </section>

      <section class="two-col">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h3>Top buyer accounts</h3>
              <p>These are real organizations behind the public notices, ranked by the strongest detected fit score.</p>
            </div>
            <button class="mini-button" type="button" data-action="jump-view" data-view="accounts">Open accounts</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Country</th>
                  <th>Best fit</th>
                  <th>Notices</th>
                </tr>
              </thead>
              <tbody>
                ${topAccounts
                  .map(
                    (account) => `
                      <tr>
                        <td>
                          <button class="mini-button" type="button" data-action="select-account" data-account-id="${escapeHtml(account.id)}">${escapeHtml(account.name)}</button>
                          <div class="subtle">${escapeHtml(account.sources.join(" • "))}</div>
                        </td>
                        <td>${escapeHtml(account.country)}</td>
                        <td>${renderScoreBar(account.maxFitScore)}</td>
                        <td>${escapeHtml(String(account.noticeCount))}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h3>Source health</h3>
              <p>Latest status from each official source connector in the public snapshot pipeline.</p>
            </div>
            <button class="mini-button" type="button" data-action="jump-view" data-view="sources">Open sources</button>
          </div>
          <div class="list-stack">
            ${sourceHealth
              .map((item) => {
                const status = item.latestRun?.status ?? "unknown";
                const badgeClass = status === "success" ? "provider-active" : "provider-disabled";
                return `
                  <div class="provider-card">
                    <div class="badge-row">
                      <span class="badge ${badgeClass}">${escapeHtml(status)}</span>
                      <span class="badge keyword">${escapeHtml(item.label)}</span>
                    </div>
                    <h4>${escapeHtml(item.label)}</h4>
                    <p class="subtle">${escapeHtml(formatNumber(item.noticeCount))} notices in the current snapshot.</p>
                    <p class="subtle">Latest run: ${escapeHtml(formatDateTime(item.latestRun?.finished_at || item.latestRun?.started_at))}</p>
                  </div>
                `;
              })
              .join("")}
          </div>
        </article>
      </section>

      <section class="two-col">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h3>Recent real notices</h3>
              <p>Newest official notices in the snapshot. The reasons below are scoring output, not source-authored claims.</p>
            </div>
            <button class="mini-button" type="button" data-action="jump-view" data-view="notices">Open notices</button>
          </div>
          <div class="timeline">
            ${recentNotices
              .map((notice) => `
                <div class="timeline-item">
                  <div class="badge-row">
                    <span class="badge signal-public-tender">${escapeHtml(sourceLabel(notice.source))}</span>
                    <span class="badge ${escapeHtml(deadlineState(notice).className)}">${escapeHtml(deadlineState(notice).label)}</span>
                  </div>
                  <h4>${escapeHtml(notice.title || "Untitled notice")}</h4>
                  <div class="meta-inline">
                    <span>${escapeHtml(notice.buyer_name || "Unknown buyer")}</span>
                    <span>${escapeHtml(notice.country || "Unknown country")}</span>
                    <span>Published ${escapeHtml(formatDate(notice.publication_date))}</span>
                  </div>
                  <p>${escapeHtml(excerptTender(notice))}</p>
                  ${renderTokens(unique([...(notice.positive_reasons || []), ...flattenMatchedTerms(notice.matched_terms)]).slice(0, 6))}
                  <div class="field-row" style="margin-top:12px;">
                    <button class="mini-button" type="button" data-action="select-notice" data-notice-id="${escapeHtml(String(notice.id))}">Inspect notice</button>
                    ${noticeUrl(notice) ? `<a class="pill-link" href="${escapeHtml(noticeUrl(notice))}" target="_blank" rel="noreferrer">Open evidence</a>` : ""}
                  </div>
                </div>
              `)
              .join("")}
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h3>Match landscape</h3>
              <p>Current distribution from the explainable fit-scoring layer over the real official-notice dataset.</p>
            </div>
          </div>
          <div class="list-stack">
            <div class="explanation-card">
              <h4>High fit</h4>
              <p>${escapeHtml(formatNumber(scoreBands.high_fit ?? 0))} notices reached the current high-fit threshold.</p>
            </div>
            <div class="explanation-card">
              <h4>Medium fit</h4>
              <p>${escapeHtml(formatNumber(scoreBands.medium_fit ?? 0))} notices landed in the medium-fit band.</p>
            </div>
            <div class="explanation-card">
              <h4>Low fit</h4>
              <p>${escapeHtml(formatNumber(scoreBands.low_fit ?? 0))} notices currently have only weak or partial Pitcher-fit evidence.</p>
            </div>
            <div class="explanation-card">
              <h4>Reality check</h4>
              <p>The dataset is fully real, but the Pitcher-fit layer is intentionally cautious. Low scores mean weak fit, not fake data.</p>
            </div>
          </div>
        </article>
      </section>
    `;
  }

  function accountFiltersHtml() {
    const countries = state.snapshot?.meta?.countries ?? [];
    const sources = state.snapshot?.meta?.sources ?? [];

    return `
      <div class="panel">
        <div class="panel-header">
          <div>
            <h3>Real buyer account filters</h3>
            <p>Accounts are built from official notices only. Search buyer names or notice titles.</p>
          </div>
        </div>
        <div class="filter-grid">
          <div class="field">
            <label for="accountSearch">Search</label>
            <input id="accountSearch" data-filter="account-search" type="text" value="${escapeHtml(state.accountFilters.search)}" placeholder="buyer or notice title" />
          </div>
          <div class="field">
            <label for="accountCountry">Country</label>
            <select id="accountCountry" data-filter="account-country">
              <option value="all">All</option>
              ${countries.map((country) => `<option value="${escapeHtml(country)}"${state.accountFilters.country === country ? " selected" : ""}>${escapeHtml(country)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="accountSource">Source</label>
            <select id="accountSource" data-filter="account-source">
              <option value="all">All</option>
              ${sources.map((source) => `<option value="${escapeHtml(source)}"${state.accountFilters.source === source ? " selected" : ""}>${escapeHtml(sourceLabel(source))}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="accountMinScore">Minimum fit score</label>
            <select id="accountMinScore" data-filter="account-min-score">
              ${[0, 5, 10, 15, 20, 30, 40, 50].map((value) => `<option value="${value}"${Number(state.accountFilters.minScore) === value ? " selected" : ""}>${value}+</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  function accountsHtml() {
    const accounts = filteredAccounts();
    const selectedAccount = getSelectedAccount();

    return `
      ${accountFiltersHtml()}
      <section class="accounts-layout">
        <article class="list-card">
          <div class="panel-header">
            <div>
              <h3>Buyer accounts</h3>
              <p>${escapeHtml(formatNumber(accounts.length))} shown / ${escapeHtml(formatNumber(realAccounts().length))} total real buyer organizations.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Best fit</th>
                  <th>Notices</th>
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                ${accounts.length
                  ? accounts
                      .map(
                        (account) => `
                          <tr>
                            <td>
                              <button class="mini-button" type="button" data-action="select-account" data-account-id="${escapeHtml(account.id)}">${escapeHtml(account.name)}</button>
                              <div class="subtle">${escapeHtml(account.country)} • ${escapeHtml(account.sources.join(" • "))}</div>
                            </td>
                            <td>${renderScoreBar(account.maxFitScore)}</td>
                            <td>${escapeHtml(String(account.noticeCount))}</td>
                            <td>${escapeHtml(formatDate(account.latestPublication))}</td>
                          </tr>
                        `
                      )
                      .join("")
                  : `<tr><td colspan="4"><div class="empty-state">No buyer accounts match the current filters.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </article>

        <article class="detail-card">
          ${
            !selectedAccount
              ? '<div class="empty-state">Select a real buyer account to see the public notices attached to it.</div>'
              : `
                <div class="badge-row">
                  <span class="badge keyword">${escapeHtml(selectedAccount.country)}</span>
                  <span class="badge keyword">${escapeHtml(formatNumber(selectedAccount.noticeCount))} notices</span>
                  <span class="badge keyword">${escapeHtml(formatNumber(selectedAccount.openNoticeCount))} open deadlines</span>
                </div>
                <h4 style="margin-top:14px;">${escapeHtml(selectedAccount.name)}</h4>
                <p>This account is derived from real buyer names on official public notices. It does not imply a confirmed private evaluation beyond those notices.</p>
                ${renderScoreBar(selectedAccount.maxFitScore)}
                <div class="panel-header" style="margin-top:18px;">
                  <div>
                    <h5>Why this buyer appears</h5>
                    <p>Aggregated from the positive reasons and matched terms on the real notices linked to this buyer.</p>
                  </div>
                </div>
                ${renderTokens(selectedAccount.topReasons)}
                ${renderTokens(selectedAccount.matchedTerms)}
                ${
                  selectedAccount.negativeReasons.length
                    ? `
                      <div class="panel-header" style="margin-top:18px;">
                        <div>
                          <h5>Negative or limiting reasons</h5>
                        </div>
                      </div>
                      ${renderTokens(selectedAccount.negativeReasons)}
                    `
                    : ""
                }
                <div class="panel-header" style="margin-top:18px;">
                  <div>
                    <h5>Detected signals for this account</h5>
                    <p>Each signal below is a real official notice tied to this buyer organization.</p>
                  </div>
                </div>
                <div class="timeline">
                  ${selectedAccount.notices
                    .map((notice) => `
                      <div class="timeline-item">
                        <div class="badge-row">
                          <span class="badge signal-public-tender">${escapeHtml(sourceLabel(notice.source))}</span>
                          <span class="badge ${escapeHtml(deadlineState(notice).className)}">${escapeHtml(deadlineState(notice).label)}</span>
                        </div>
                        <h4>${escapeHtml(notice.title || "Untitled notice")}</h4>
                        <div class="meta-inline">
                          <span>${escapeHtml(notice.notice_type || "Notice")}</span>
                          <span>Published ${escapeHtml(formatDate(notice.publication_date))}</span>
                          <span>${escapeHtml(scoreTone(notice.fit_score))}</span>
                        </div>
                        <p>${escapeHtml(excerptTender(notice))}</p>
                        ${renderTokens(unique([...(notice.positive_reasons || []), ...flattenMatchedTerms(notice.matched_terms)]).slice(0, 8))}
                        <div class="field-row" style="margin-top:12px;">
                          <button class="mini-button" type="button" data-action="select-notice" data-notice-id="${escapeHtml(String(notice.id))}">Inspect notice</button>
                          ${noticeUrl(notice) ? `<a class="pill-link" href="${escapeHtml(noticeUrl(notice))}" target="_blank" rel="noreferrer">Open evidence</a>` : ""}
                        </div>
                      </div>
                    `)
                    .join("")}
                </div>
              `
          }
        </article>
      </section>
    `;
  }

  function noticeFiltersHtml() {
    const countries = state.snapshot?.meta?.countries ?? [];
    const sources = state.snapshot?.meta?.sources ?? [];

    return `
      <div class="panel">
        <div class="panel-header">
          <div>
            <h3>Notice filters</h3>
            <p>Inspect real official notices directly and keep the scoring rationale separate from the source text.</p>
          </div>
        </div>
        <div class="filter-grid">
          <div class="field">
            <label for="noticeSearch">Search</label>
            <input id="noticeSearch" data-filter="notice-search" type="text" value="${escapeHtml(state.noticeFilters.search)}" placeholder="title, buyer, keyword" />
          </div>
          <div class="field">
            <label for="noticeCountry">Country</label>
            <select id="noticeCountry" data-filter="notice-country">
              <option value="all">All</option>
              ${countries.map((country) => `<option value="${escapeHtml(country)}"${state.noticeFilters.country === country ? " selected" : ""}>${escapeHtml(country)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="noticeSource">Source</label>
            <select id="noticeSource" data-filter="notice-source">
              <option value="all">All</option>
              ${sources.map((source) => `<option value="${escapeHtml(source)}"${state.noticeFilters.source === source ? " selected" : ""}>${escapeHtml(sourceLabel(source))}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="noticeMinScore">Minimum fit score</label>
            <select id="noticeMinScore" data-filter="notice-min-score">
              ${[0, 5, 10, 15, 20, 30, 40, 50].map((value) => `<option value="${value}"${Number(state.noticeFilters.minScore) === value ? " selected" : ""}>${value}+</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  function noticeDetailHtml(notice) {
    if (!notice) {
      return '<div class="empty-state">Select a real notice to inspect its evidence and scoring rationale.</div>';
    }

    const deadline = deadlineState(notice);
    const matchedTerms = unique(flattenMatchedTerms(notice.matched_terms));
    const cpvCodes = Array.isArray(notice.cpv_codes) ? notice.cpv_codes : [];
    const breakdown = notice.breakdown && typeof notice.breakdown === "object" ? Object.entries(notice.breakdown) : [];

    return `
      <div class="badge-row">
        <span class="badge signal-public-tender">${escapeHtml(sourceLabel(notice.source))}</span>
        <span class="badge ${escapeHtml(deadline.className)}">${escapeHtml(deadline.label)}</span>
        <span class="badge keyword">${escapeHtml(notice.country || "Unknown country")}</span>
      </div>
      <h4 style="margin-top:14px;">${escapeHtml(notice.title || "Untitled notice")}</h4>
      <p>Buyer: <strong>${escapeHtml(notice.buyer_name || "Unknown buyer")}</strong></p>
      <div class="meta-inline">
        <span>Notice type: ${escapeHtml(notice.notice_type || "Notice")}</span>
        <span>Published: ${escapeHtml(formatDate(notice.publication_date))}</span>
        <span>Deadline: ${escapeHtml(formatDate(notice.deadline_date))}</span>
      </div>
      <div style="margin-top:14px;">${renderScoreBar(notice.fit_score)}</div>
      <div class="field-row" style="margin-top:14px;">
        ${noticeUrl(notice) ? `<a class="pill-link" href="${escapeHtml(noticeUrl(notice))}" target="_blank" rel="noreferrer">Open evidence</a>` : ""}
        ${notice.document_url && notice.document_url !== notice.source_url ? `<a class="pill-link" href="${escapeHtml(notice.document_url)}" target="_blank" rel="noreferrer">Open document</a>` : ""}
      </div>

      <div class="panel-header" style="margin-top:18px;">
        <div>
          <h5>Evidence excerpt</h5>
          <p>This text is taken from the real notice body or description when available.</p>
        </div>
      </div>
      <p>${escapeHtml(excerptTender(notice))}</p>

      <div class="panel-header" style="margin-top:18px;">
        <div>
          <h5>Positive reasons</h5>
        </div>
      </div>
      ${renderTokens(notice.positive_reasons || [])}

      <div class="panel-header" style="margin-top:18px;">
        <div>
          <h5>Matched terms</h5>
        </div>
      </div>
      ${renderTokens(matchedTerms)}

      ${
        notice.negative_reasons?.length
          ? `
            <div class="panel-header" style="margin-top:18px;">
              <div>
                <h5>Negative reasons</h5>
              </div>
            </div>
            ${renderTokens(notice.negative_reasons)}
          `
          : ""
      }

      ${
        cpvCodes.length
          ? `
            <div class="panel-header" style="margin-top:18px;">
              <div>
                <h5>CPV codes</h5>
              </div>
            </div>
            ${renderTokens(cpvCodes)}
          `
          : ""
      }

      ${
        breakdown.length
          ? `
            <div class="panel-header" style="margin-top:18px;">
              <div>
                <h5>Score breakdown</h5>
                <p>The explanation below is generated by the scoring layer and is not a source-authored conclusion.</p>
              </div>
            </div>
            <div class="list-stack">
              ${breakdown
                .map(
                  ([key, value]) => `
                    <div class="explanation-card">
                      <h4>${escapeHtml(key.replace(/_/g, " "))}</h4>
                      <p>${escapeHtml(String(value))} points</p>
                    </div>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
    `;
  }

  function noticesHtml() {
    const noticeList = filteredNotices();
    const selectedNotice = getSelectedNotice();

    return `
      ${noticeFiltersHtml()}
      <section class="signals-layout">
        <article class="list-card">
          <div class="panel-header">
            <div>
              <h3>Real official notices</h3>
              <p>${escapeHtml(formatNumber(noticeList.length))} shown / ${escapeHtml(formatNumber(notices().length))} total notices in this snapshot.</p>
            </div>
          </div>
          <div class="timeline">
            ${noticeList.length
              ? noticeList
                  .map((notice) => `
                    <div class="timeline-item">
                      <div class="badge-row">
                        <span class="badge signal-public-tender">${escapeHtml(sourceLabel(notice.source))}</span>
                        <span class="badge ${escapeHtml(deadlineState(notice).className)}">${escapeHtml(deadlineState(notice).label)}</span>
                      </div>
                      <h4>${escapeHtml(notice.title || "Untitled notice")}</h4>
                      <div class="meta-inline">
                        <span>${escapeHtml(notice.buyer_name || "Unknown buyer")}</span>
                        <span>${escapeHtml(notice.country || "Unknown country")}</span>
                        <span>${escapeHtml(formatDate(notice.publication_date))}</span>
                      </div>
                      <p>${escapeHtml(excerptTender(notice))}</p>
                      <div class="field-row">
                        <button class="mini-button" type="button" data-action="select-notice" data-notice-id="${escapeHtml(String(notice.id))}">Inspect</button>
                        <button class="mini-button" type="button" data-action="select-account-by-notice" data-account-name="${escapeHtml(notice.buyer_name || "Unknown buyer")}" data-account-country="${escapeHtml(notice.country || "Unknown")}">Open account</button>
                      </div>
                    </div>
                  `)
                  .join("")
              : '<div class="empty-state">No real notices match the current filters.</div>'}
          </div>
        </article>

        <article class="detail-card">
          ${noticeDetailHtml(selectedNotice)}
        </article>
      </section>
    `;
  }

  function sourcesHtml() {
    const sourceHealth = sourceRunSummaries();
    const taxonomy = state.snapshot?.meta?.taxonomy ?? {};
    const countries = state.snapshot?.meta?.countries ?? [];

    return `
      <section class="settings-layout">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h3>Official source runs</h3>
              <p>Most recent connector runs for the approved public-source ingestion pipeline.</p>
            </div>
          </div>
          <div class="list-stack">
            ${sourceHealth
              .map((item) => {
                const run = item.latestRun;
                const status = run?.status ?? "unknown";
                const badgeClass = status === "success" ? "provider-active" : "provider-disabled";
                return `
                  <div class="provider-card">
                    <div class="badge-row">
                      <span class="badge ${badgeClass}">${escapeHtml(status)}</span>
                      <span class="badge keyword">${escapeHtml(item.label)}</span>
                    </div>
                    <h4>${escapeHtml(item.label)}</h4>
                    <p class="subtle">${escapeHtml(formatNumber(item.noticeCount))} notices in current snapshot</p>
                    <p class="subtle">Started: ${escapeHtml(formatDateTime(run?.started_at))}</p>
                    <p class="subtle">Finished: ${escapeHtml(formatDateTime(run?.finished_at))}</p>
                    <p class="subtle">Fetched: ${escapeHtml(formatNumber(run?.fetched_count ?? 0))} • Inserted: ${escapeHtml(formatNumber(run?.inserted_count ?? 0))} • Updated: ${escapeHtml(formatNumber(run?.updated_count ?? 0))}</p>
                    ${run?.error_message ? `<pre>${escapeHtml(run.error_message)}</pre>` : ""}
                  </div>
                `;
              })
              .join("")}
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <h3>Current taxonomy and coverage</h3>
              <p>The keyword groups below power the fit scoring on top of the real official-notice dataset.</p>
            </div>
          </div>
          <div class="settings-group">
            <div class="explanation-card">
              <h4>Countries in snapshot</h4>
              ${renderTokens(countries)}
            </div>
            ${Object.entries(taxonomy)
              .map(
                ([key, values]) => `
                  <div class="explanation-card">
                    <h4>${escapeHtml(key.replace(/_/g, " "))}</h4>
                    ${renderTokens(Array.isArray(values) ? values : [])}
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      </section>
    `;
  }

  function render() {
    if (!state.snapshot) {
      return;
    }

    defaultSelections();
    heroMetrics.innerHTML = heroMetricsHtml();
    generatedAt.textContent = formatDateTime(state.snapshot.generated_at);
    sourceSummary.textContent = (state.snapshot.meta?.sources ?? []).map(sourceLabel).join(", ") || "Unavailable";

    tabbar.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.view === state.view);
    });

    if (state.view === "accounts") {
      viewRoot.innerHTML = accountsHtml();
      return;
    }
    if (state.view === "notices") {
      viewRoot.innerHTML = noticesHtml();
      return;
    }
    if (state.view === "sources") {
      viewRoot.innerHTML = sourcesHtml();
      return;
    }
    viewRoot.innerHTML = overviewHtml();
  }

  function downloadText(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function noticesCsv(rows) {
    const headers = [
      "buyer_name",
      "country",
      "source",
      "title",
      "notice_type",
      "publication_date",
      "deadline_date",
      "fit_score",
      "positive_reasons",
      "negative_reasons",
      "matched_terms",
      "source_url",
    ];
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            let value = row[header];
            if (header === "source") {
              value = sourceLabel(row.source);
            }
            if (header === "positive_reasons" || header === "negative_reasons") {
              value = (value || []).join(" | ");
            }
            if (header === "matched_terms") {
              value = flattenMatchedTerms(row.matched_terms).join(" | ");
            }
            const output = String(value ?? "").replace(/"/g, '""');
            return `"${output}"`;
          })
          .join(",")
      ),
    ];
    return lines.join("\n");
  }

  function accountsCsv(rows) {
    const headers = ["account_name", "country", "sources", "notice_count", "max_fit_score", "avg_fit_score", "latest_publication", "top_reasons"];
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.name,
          row.country,
          row.sources.join(" | "),
          row.noticeCount,
          formatScore(row.maxFitScore),
          Math.round(row.avgFitScore * 10) / 10,
          row.latestPublication,
          row.topReasons.join(" | "),
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    return lines.join("\n");
  }

  function reportMarkdown() {
    const snapshot = state.snapshot;
    const topAccounts = realAccounts().slice(0, 10);
    const topNotices = notices().slice(0, 10);

    return [
      "# Pitcher Signal Radar",
      "",
      "Real public procurement summary generated from official sources only.",
      "",
      `- Generated: ${formatDateTime(snapshot.generated_at)}`,
      `- Notices: ${snapshot.total ?? 0}`,
      `- Buyer accounts: ${realAccounts().length}`,
      `- Countries: ${(snapshot.meta?.countries ?? []).length}`,
      `- Sources: ${(snapshot.meta?.sources ?? []).map(sourceLabel).join(", ")}`,
      "",
      "## Top buyer accounts",
      ...topAccounts.map((account) => `- ${account.name} (${account.country}) — ${account.noticeCount} notices, best fit ${formatScore(account.maxFitScore)}/100`),
      "",
      "## Top recent notices",
      ...topNotices.map((notice) => `- ${notice.title} — ${notice.buyer_name || "Unknown buyer"} — ${sourceLabel(notice.source)} — fit ${formatScore(notice.fit_score)}/100 — ${noticeUrl(notice) || "No public URL"}`),
      "",
      "## Source health",
      ...sourceRunSummaries().map((item) => `- ${item.label}: ${item.latestRun?.status ?? "unknown"} (${item.noticeCount} notices in snapshot)`),
      "",
      "## Notes",
      "- Accounts are derived from buyer names on public notices.",
      "- Fit reasons are scoring output layered on top of the original notices.",
      "- This report intentionally avoids mock data.",
      "",
    ].join("\n");
  }

  function bindEvents() {
    tabbar.addEventListener("click", (event) => {
      const target = event.target.closest(".tab");
      if (!target) {
        return;
      }
      state.view = target.dataset.view || "overview";
      render();
    });

    viewRoot.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      if (action === "jump-view") {
        state.view = button.dataset.view || "overview";
        render();
        return;
      }

      if (action === "select-account") {
        state.selectedAccountId = button.dataset.accountId || null;
        state.view = "accounts";
        render();
        return;
      }

      if (action === "select-notice") {
        state.selectedTenderId = button.dataset.noticeId || null;
        state.view = "notices";
        render();
        return;
      }

      if (action === "select-account-by-notice") {
        const accountName = button.dataset.accountName || "Unknown buyer";
        const accountCountry = button.dataset.accountCountry || "Unknown";
        state.selectedAccountId = slugify(`${accountName}::${accountCountry}`);
        state.view = "accounts";
        render();
      }
    });

    viewRoot.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const key = target.dataset.filter;
      if (key === "account-search") {
        state.accountFilters.search = target.value || "";
        render();
      }
      if (key === "notice-search") {
        state.noticeFilters.search = target.value || "";
        render();
      }
    });

    viewRoot.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const key = target.dataset.filter;
      const value = target.value || "";
      if (key === "account-country") {
        state.accountFilters.country = value;
      }
      if (key === "account-source") {
        state.accountFilters.source = value;
      }
      if (key === "account-min-score") {
        state.accountFilters.minScore = Number(value || 0);
      }
      if (key === "notice-country") {
        state.noticeFilters.country = value;
      }
      if (key === "notice-source") {
        state.noticeFilters.source = value;
      }
      if (key === "notice-min-score") {
        state.noticeFilters.minScore = Number(value || 0);
      }
      render();
    });

    downloadReportButton.addEventListener("click", () => {
      downloadText("pitcher-signal-radar-report.md", reportMarkdown(), "text/markdown;charset=utf-8");
    });

    downloadAccountsButton.addEventListener("click", () => {
      downloadText("pitcher-signal-radar-accounts.csv", accountsCsv(filteredAccounts()), "text/csv;charset=utf-8");
    });

    downloadNoticesButton.addEventListener("click", () => {
      downloadText("pitcher-signal-radar-notices.csv", noticesCsv(filteredNotices()), "text/csv;charset=utf-8");
    });
  }

  async function init() {
    bindEvents();
    try {
      const response = await fetch(snapshotUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Snapshot request failed with ${response.status}`);
      }
      state.snapshot = await response.json();
      state.accounts = buildAccounts(state.snapshot.tenders || []);
      render();
    } catch (error) {
      console.error(error);
      viewRoot.innerHTML = `
        <div class="loading-card">
          Failed to load the official snapshot. Check GitHub Pages deployment and the snapshot artifact.
        </div>
      `;
      generatedAt.textContent = "Unavailable";
    }
  }

  init();
})();
