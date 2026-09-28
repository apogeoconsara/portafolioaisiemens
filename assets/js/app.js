// ---------- Global state ----------
let currentHeaders = [];
let currentRows = [];
let currentSource = "";
let currentReport = null;
let activeView = "pipeline";
let chatHistory = [];

// ---------- i18n application ----------
function applyI18n() {
  document.documentElement.lang = CURRENT_LANG;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });
  document.getElementById("chatInput").placeholder = t("assistant.placeholder");
  renderTopbar();
}

function renderTopbar() {
  document.getElementById("viewTitle").textContent = t(`${activeView}.title`);
  document.getElementById("viewDesc").textContent = t(`${activeView}.desc`);
}

// ---------- View switching ----------
function switchView(view) {
  activeView = view;
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach(s => s.classList.toggle("active", s.dataset.view === view));
  renderTopbar();
}

document.getElementById("nav").addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-item");
  if (btn) switchView(btn.dataset.view);
});

// ---------- Language toggle ----------
document.getElementById("langToggle").addEventListener("click", (e) => {
  const btn = e.target.closest(".lang-btn");
  if (!btn) return;
  setLang(btn.dataset.lang);
  document.querySelectorAll(".lang-btn").forEach(b => b.classList.toggle("active", b.dataset.lang === CURRENT_LANG));
  applyI18n();
  renderChatSuggestions();
  if (document.getElementById("chatLog").children.length <= 1) {
    document.getElementById("chatLog").innerHTML = "";
    appendMessage(t("assistant.greeting"), "bot");
  }
  if (currentReport) {
    renderDashboard(currentReport);
    renderQualityChecks(lastQualityChecks || []);
    renderRuleBasedInsights(currentReport);
  }
});

// ---------- Pipeline: quality checks ----------
let lastQualityChecks = [];
function renderQualityChecks(checks) {
  const list = document.getElementById("qualityList");
  list.innerHTML = checks.map(c => `
    <li class="${c.passed ? "pass" : "fail"}">
      <span class="check-icon">${c.passed ? "✓" : "✕"}</span>
      <span>${t(c.key, c.vars)}</span>
    </li>
  `).join("");
}

// ---------- Pipeline: automation log ----------
function renderLogLine(text) {
  const log = document.getElementById("automationLog");
  if (log.querySelector(".muted")) log.innerHTML = "";
  const line = document.createElement("div");
  line.className = "log-line";
  const time = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="log-time">${time}</span><span>${text}</span>`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function setStepState(step, state) {
  const el = document.querySelector(`.step[data-step="${step}"]`);
  if (!el) return;
  el.classList.remove("active", "done");
  if (state) el.classList.add(state);
}

function resetSteps() {
  document.querySelectorAll(".step").forEach(el => el.classList.remove("active", "done"));
}

async function runPipelineAnimation(headers, rows, source, animated) {
  const delay = animated ? 450 : 0;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const t0 = performance.now();

  resetSteps();
  setStepState("extract", "active");
  if (animated) await wait(delay);
  renderLogLine(t("pipeline.log.extract", { rows: rows.length, source }));
  setStepState("extract", "done");

  setStepState("validate", "active");
  if (animated) await wait(delay);
  const checks = runQualityChecks(headers, rows);
  lastQualityChecks = checks;
  renderQualityChecks(checks);
  const failed = checks.filter(c => !c.passed).length;
  renderLogLine(failed === 0
    ? t("pipeline.log.validate.ok", { n: REQUIRED_COLUMNS.length })
    : t("pipeline.log.validate.fail", { n: failed }));
  setStepState("validate", "done");

  setStepState("transform", "active");
  if (animated) await wait(delay);
  const report = computeReport(rows);
  currentReport = report;
  renderLogLine(t("pipeline.log.transform", { cc: report.kpis.costCenterCount }));
  setStepState("transform", "done");

  setStepState("load", "active");
  if (animated) await wait(delay);
  renderDashboard(report);
  renderRuleBasedInsights(report);
  document.getElementById("sqlInput").value = SQL_DEFAULT_QUERY;
  runSqlQuery();
  renderLogLine(t("pipeline.log.load"));
  setStepState("load", "done");

  const ms = Math.round(performance.now() - t0);
  renderLogLine(t("pipeline.log.done", { ms: animated ? ms : "<1" }));

  document.getElementById("pipelineStatus").textContent = t("pipeline.status.loaded", { rows: rows.length, source });
}

function loadDataset(text, source, animated) {
  const { headers, rows } = parseCSV(text);
  currentHeaders = headers;
  currentRows = rows;
  currentSource = source;
  runPipelineAnimation(headers, rows, source, animated);
}

document.getElementById("loadSampleBtn").addEventListener("click", () => {
  fetch("assets/data/sample_finance_data.csv")
    .then(r => r.text())
    .then(text => loadDataset(text, "sample_finance_data.csv", true));
});

document.getElementById("csvInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadDataset(reader.result, file.name, true);
  reader.readAsText(file);
});

document.getElementById("runPipelineBtn").addEventListener("click", () => {
  if (!currentRows.length) return;
  runPipelineAnimation(currentHeaders, currentRows, currentSource, true);
});

// ---------- Dashboard ----------
function deltaClass(pct) {
  if (Math.abs(pct) <= 3) return "good";
  if (Math.abs(pct) <= 8) return "warn";
  return "bad";
}

function renderKPIs(report) {
  const { kpis } = report;
  const row = document.getElementById("kpiRow");
  const cards = [
    { label: t("dashboard.kpi.spend"), value: fmtUSD(kpis.totalActual), delta: t("dashboard.kpi.spend.sub", { budget: fmtUSD(kpis.totalBudget) }), cls: "good" },
    { label: t("dashboard.kpi.variance", { month: kpis.latestMonth }), value: `${kpis.latestVariancePct.toFixed(1)}%`, delta: kpis.latestVariancePct > 0 ? t("dashboard.kpi.variance.over") : t("dashboard.kpi.variance.under"), cls: deltaClass(kpis.latestVariancePct) },
    { label: t("dashboard.kpi.productivity"), value: kpis.avgProductivity.toFixed(2), delta: kpis.avgProductivity >= 1 ? t("dashboard.kpi.productivity.over") : t("dashboard.kpi.productivity.under"), cls: kpis.avgProductivity >= 1 ? "good" : "warn" },
    { label: t("dashboard.kpi.inventory"), value: `${kpis.inventoryGapPct.toFixed(1)}%`, delta: kpis.inventoryGapPct > 0 ? t("dashboard.kpi.inventory.over") : t("dashboard.kpi.inventory.under"), cls: deltaClass(kpis.inventoryGapPct) }
  ];
  row.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-delta ${c.cls}">${c.delta}</div>
    </div>
  `).join("");
}

let chartRefs = {};
function destroyCharts() { Object.values(chartRefs).forEach(c => c && c.destroy()); chartRefs = {}; }

const CHART_COLORS = { accent: "#0077b6", accent2: "#0091d4", good: "#1a9c63", warn: "#b5720a", bad: "#d1373f", grid: "#e3e8f1", text: "#5a6478" };

function baseOptions(extra = {}) {
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: CHART_COLORS.text, boxWidth: 12, font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: CHART_COLORS.text, font: { size: 10 } }, grid: { color: CHART_COLORS.grid } },
      y: { ticks: { color: CHART_COLORS.text, font: { size: 10 } }, grid: { color: CHART_COLORS.grid } }
    }
  }, extra);
}

function renderCharts(report) {
  destroyCharts();
  const { budgetByMonth, varianceByCC, inventoryByCC, productivityByMonth } = report.charts;

  chartRefs.budget = new Chart(document.getElementById("chartBudget"), {
    type: "line",
    data: {
      labels: budgetByMonth.map(b => b.month),
      datasets: [
        { label: t("dashboard.legend.actual"), data: budgetByMonth.map(b => b.actual), borderColor: CHART_COLORS.accent, backgroundColor: "transparent", tension: 0.3 },
        { label: t("dashboard.legend.budget"), data: budgetByMonth.map(b => b.budget), borderColor: CHART_COLORS.text, backgroundColor: "transparent", borderDash: [6, 4], tension: 0.3 }
      ]
    },
    options: baseOptions()
  });

  chartRefs.variance = new Chart(document.getElementById("chartVariance"), {
    type: "bar",
    data: {
      labels: varianceByCC.map(v => v.ccLabel),
      datasets: [{ data: varianceByCC.map(v => v.variance), backgroundColor: varianceByCC.map(v => v.variance > 5 ? CHART_COLORS.bad : v.variance < -5 ? CHART_COLORS.good : CHART_COLORS.accent2) }]
    },
    options: baseOptions({ plugins: { legend: { display: false } } })
  });

  chartRefs.inventory = new Chart(document.getElementById("chartInventory"), {
    type: "bar",
    data: {
      labels: inventoryByCC.map(i => i.ccLabel),
      datasets: [
        { label: t("dashboard.legend.actual"), data: inventoryByCC.map(i => i.actual), backgroundColor: CHART_COLORS.accent },
        { label: t("dashboard.legend.target"), data: inventoryByCC.map(i => i.target), backgroundColor: CHART_COLORS.text }
      ]
    },
    options: baseOptions()
  });

  chartRefs.productivity = new Chart(document.getElementById("chartProductivity"), {
    type: "line",
    data: {
      labels: productivityByMonth.map(p => p.month),
      datasets: [{ data: productivityByMonth.map(p => p.index), borderColor: CHART_COLORS.good, backgroundColor: "rgba(26,156,99,0.12)", fill: true, tension: 0.3 }]
    },
    options: baseOptions({ plugins: { legend: { display: false } } })
  });
}

function renderDashboard(report) {
  renderKPIs(report);
  renderCharts(report);
}

// ---------- SQL Explorer ----------
document.getElementById("sqlInput").value = SQL_DEFAULT_QUERY;

function runSqlQuery() {
  const query = document.getElementById("sqlInput").value.trim();
  const status = document.getElementById("sqlStatus");
  const table = document.getElementById("sqlResult");
  if (!query || !currentRows.length) return;
  try {
    const { columns, rows } = runSql(query, currentRows);
    status.textContent = t("sql.rows", { n: rows.length });
    status.classList.remove("bad");
    table.innerHTML = `
      <thead><tr>${columns.map(c => `<th>${c}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${columns.map(c => `<td>${r[c]}</td>`).join("")}</tr>`).join("")}</tbody>
    `;
  } catch (err) {
    status.textContent = t("sql.error", { msg: err.message });
    status.classList.add("bad");
    table.innerHTML = "";
  }
}

document.getElementById("runSqlBtn").addEventListener("click", runSqlQuery);
document.querySelectorAll(".chip[data-sql]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("sqlInput").value = SQL_EXAMPLES[btn.dataset.sql];
    runSqlQuery();
  });
});

// ---------- Insights ----------
function renderRuleBasedInsights(report) {
  const body = document.getElementById("insightsBody");
  const note = document.getElementById("insightsNote");
  note.textContent = getApiKey() ? "" : t("insights.fallbackNote");
  const labelKey = { risk: "insights.risk", watch: "insights.watch", ok: "insights.ok" };
  body.innerHTML = `
    <h3 class="insights-heading">${t("insights.rule.title")}</h3>
    <ul class="insights-list">
      ${report.insights.map(i => `<li><span class="badge ${i.level}">${t(labelKey[i.level])}:</span> ${t(i.key, i.vars)}</li>`).join("")}
    </ul>
  `;
}

document.getElementById("generateInsightsBtn").addEventListener("click", async () => {
  if (!currentReport) return;
  const note = document.getElementById("insightsNote");
  const body = document.getElementById("insightsBody");

  if (!getApiKey()) {
    note.textContent = t("insights.fallbackNote");
    renderRuleBasedInsights(currentReport);
    return;
  }

  note.textContent = t("insights.generating");
  try {
    const ctx = buildDataContext(currentReport, currentRows.length);
    const summary = await generateExecutiveSummary(ctx, CURRENT_LANG);
    note.textContent = "";
    body.innerHTML = `
      <h3 class="insights-heading">${t("insights.ai.title")}</h3>
      <ul class="insights-list ai">
        ${summary.split("\n").filter(l => l.trim()).map(l => `<li>${l.replace(/^-\s*/, "")}</li>`).join("")}
      </ul>
    `;
  } catch (err) {
    note.textContent = t("insights.error", { msg: err.message });
    renderRuleBasedInsights(currentReport);
  }
});

// ---------- Assistant ----------
function appendMessage(text, who) {
  const log = document.getElementById("chatLog");
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function renderChatSuggestions() {
  const box = document.getElementById("chatSuggestions");
  const prompts = CURRENT_LANG === "es"
    ? ["¿Dónde está el mayor riesgo de variación?", "¿Riesgo de inventario?", "¿Cómo automatiza el pipeline?", "Muéstrame una consulta SQL"]
    : ["Where is the biggest variance risk?", "Any inventory risk?", "How does the pipeline automate this?", "Show me a SQL query"];
  box.innerHTML = prompts.map(p => `<button type="button" class="chip">${p}</button>`).join("");
  box.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("chatInput").value = btn.textContent;
      document.getElementById("chatForm").requestSubmit();
    });
  });
}

document.getElementById("chatForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !currentReport) return;
  appendMessage(text, "user");
  input.value = "";

  const thinkingEl = appendMessage(t("assistant.thinking"), "bot");

  if (!getApiKey()) {
    thinkingEl.textContent = answerFallback(text, currentReport, CURRENT_LANG);
    return;
  }

  try {
    const ctx = buildDataContext(currentReport, currentRows.length);
    const answer = await chatWithAssistant(text, ctx, CURRENT_LANG, chatHistory);
    thinkingEl.textContent = answer;
    chatHistory.push({ role: "user", content: text }, { role: "assistant", content: answer });
    if (chatHistory.length > 12) chatHistory = chatHistory.slice(-12);
  } catch (err) {
    thinkingEl.textContent = `${t("assistant.error", { msg: err.message })}\n\n${answerFallback(text, currentReport, CURRENT_LANG)}`;
  }
});

// ---------- API key modal ----------
const apiKeyModal = document.getElementById("apiKeyModal");

function updateApiKeyBtnLabel() {
  document.getElementById("apiKeyBtnLabel").textContent = getApiKey() ? t("sidebar.apiKeyOn") : t("sidebar.apiKey");
  document.getElementById("apiKeyBtn").classList.toggle("connected", !!getApiKey());
}

document.getElementById("apiKeyBtn").addEventListener("click", () => {
  document.getElementById("apiKeyInput").value = getApiKey() || "";
  apiKeyModal.classList.add("open");
});
document.getElementById("apiKeyCloseBtn").addEventListener("click", () => apiKeyModal.classList.remove("open"));
apiKeyModal.addEventListener("click", (e) => { if (e.target === apiKeyModal) apiKeyModal.classList.remove("open"); });

document.getElementById("apiKeySaveBtn").addEventListener("click", () => {
  const key = document.getElementById("apiKeyInput").value.trim();
  const remember = document.getElementById("apiKeyRemember").checked;
  setApiKey(key, remember);
  updateApiKeyBtnLabel();
  if (currentReport) renderRuleBasedInsights(currentReport);
  apiKeyModal.classList.remove("open");
});

document.getElementById("apiKeyClearBtn").addEventListener("click", () => {
  clearApiKey();
  document.getElementById("apiKeyInput").value = "";
  updateApiKeyBtnLabel();
  if (currentReport) renderRuleBasedInsights(currentReport);
});

// ---------- Init ----------
applyI18n();
renderChatSuggestions();
appendMessage(t("assistant.greeting"), "bot");
updateApiKeyBtnLabel();

fetch("assets/data/sample_finance_data.csv")
  .then(r => r.text())
  .then(text => loadDataset(text, "sample_finance_data.csv", false));
