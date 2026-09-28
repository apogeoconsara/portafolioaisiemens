// ---------- Skills grid ----------
function renderSkills() {
  const grid = document.getElementById("skillsGrid");
  grid.innerHTML = SKILLS.map(s => `
    <div class="skill-card">
      <span class="skill-tag">${s.tag}</span>
      <h3>${s.title}</h3>
      <p>${s.body}</p>
    </div>
  `).join("");
}

// ---------- CSV parsing ----------
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).filter(Boolean).map(line => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      const raw = (cells[i] ?? "").trim();
      row[h] = isNaN(Number(raw)) || raw === "" ? raw : Number(raw);
    });
    return row;
  });
}

// ---------- KPI + insight engine ----------
function computeReport(rows) {
  const months = [...new Set(rows.map(r => r.month))].sort();
  const costCenters = [...new Set(rows.map(r => r.cost_center))];

  const totalActual = rows.reduce((s, r) => s + (r.actual_usd || 0), 0);
  const totalBudget = rows.reduce((s, r) => s + (r.budget_usd || 0), 0);
  const overallVariancePct = ((totalActual - totalBudget) / totalBudget) * 100;

  const avgProductivity = rows.reduce((s, r) => s + (r.productivity_index || 0), 0) / rows.length;

  const inventoryRows = rows.filter(r => (r.inventory_target_units || 0) > 0);
  const inventoryGapPct = inventoryRows.length
    ? inventoryRows.reduce((s, r) => s + ((r.inventory_units - r.inventory_target_units) / r.inventory_target_units), 0) / inventoryRows.length * 100
    : 0;

  const latestMonth = months[months.length - 1];
  const latestRows = rows.filter(r => r.month === latestMonth);
  const latestActual = latestRows.reduce((s, r) => s + r.actual_usd, 0);
  const latestBudget = latestRows.reduce((s, r) => s + r.budget_usd, 0);
  const latestVariancePct = ((latestActual - latestBudget) / latestBudget) * 100;

  // Budget vs actual by month
  const budgetByMonth = months.map(m => {
    const rs = rows.filter(r => r.month === m);
    return {
      month: m,
      actual: rs.reduce((s, r) => s + r.actual_usd, 0),
      budget: rs.reduce((s, r) => s + r.budget_usd, 0)
    };
  });

  // Variance % by cost center (latest month)
  const varianceByCC = costCenters.map(cc => {
    const r = latestRows.find(x => x.cost_center === cc);
    if (!r) return { cc, variance: 0 };
    return { cc: `${cc} (${r.area})`, variance: ((r.actual_usd - r.budget_usd) / r.budget_usd) * 100 };
  });

  // Inventory actual vs target by cost center (latest month, only where applicable)
  const inventoryByCC = latestRows
    .filter(r => (r.inventory_target_units || 0) > 0)
    .map(r => ({ cc: `${r.cost_center} (${r.area})`, actual: r.inventory_units, target: r.inventory_target_units }));

  // Productivity trend by month (average across cost centers)
  const productivityByMonth = months.map(m => {
    const rs = rows.filter(r => r.month === m);
    return { month: m, index: rs.reduce((s, r) => s + r.productivity_index, 0) / rs.length };
  });

  // Insights
  const insights = [];
  varianceByCC.forEach(v => {
    if (v.variance > 5) insights.push({ level: "risk", text: `Sobrecosto en ${v.cc}: +${v.variance.toFixed(1)}% vs. presupuesto en ${latestMonth}. Revisar causa raíz antes del cierre.` });
    else if (v.variance < -5) insights.push({ level: "ok", text: `Ahorro en ${v.cc}: ${v.variance.toFixed(1)}% vs. presupuesto en ${latestMonth}.` });
  });
  inventoryByCC.forEach(inv => {
    const gap = ((inv.actual - inv.target) / inv.target) * 100;
    if (gap > 10) insights.push({ level: "watch", text: `Inventario de ${inv.cc} está ${gap.toFixed(1)}% sobre el objetivo — posible riesgo de capital de trabajo inmovilizado.` });
    else if (gap < -10) insights.push({ level: "risk", text: `Inventario de ${inv.cc} está ${Math.abs(gap).toFixed(1)}% bajo el objetivo — riesgo de quiebre de stock.` });
  });
  const latestProd = productivityByMonth[productivityByMonth.length - 1];
  const firstProd = productivityByMonth[0];
  if (latestProd && firstProd && latestProd.index < firstProd.index) {
    insights.push({ level: "watch", text: `El índice de productividad promedio cayó de ${firstProd.index.toFixed(2)} a ${latestProd.index.toFixed(2)} entre ${firstProd.month} y ${latestProd.month}.` });
  }
  if (insights.length === 0) insights.push({ level: "ok", text: "No se detectaron riesgos significativos en el periodo analizado." });

  return {
    kpis: {
      totalActual, totalBudget, overallVariancePct, avgProductivity, inventoryGapPct,
      latestMonth, latestVariancePct
    },
    charts: { budgetByMonth, varianceByCC, inventoryByCC, productivityByMonth },
    insights
  };
}

function fmtUSD(n) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function deltaClass(pct) {
  if (Math.abs(pct) <= 3) return "good";
  if (Math.abs(pct) <= 8) return "warn";
  return "bad";
}

// ---------- Render KPIs ----------
function renderKPIs(report) {
  const { kpis } = report;
  const row = document.getElementById("kpiRow");
  const cards = [
    { label: "Gasto total (todo el periodo)", value: fmtUSD(kpis.totalActual), delta: `Presupuesto: ${fmtUSD(kpis.totalBudget)}`, cls: "good" },
    { label: `Variación vs. presupuesto (${kpis.latestMonth})`, value: `${kpis.latestVariancePct.toFixed(1)}%`, delta: kpis.latestVariancePct > 0 ? "Sobre presupuesto" : "Bajo presupuesto", cls: deltaClass(kpis.latestVariancePct) },
    { label: "Índice de productividad promedio", value: kpis.avgProductivity.toFixed(2), delta: kpis.avgProductivity >= 1 ? "Sobre meta (1.00)" : "Bajo meta (1.00)", cls: kpis.avgProductivity >= 1 ? "good" : "warn" },
    { label: "Brecha de inventario promedio", value: `${kpis.inventoryGapPct.toFixed(1)}%`, delta: kpis.inventoryGapPct > 0 ? "Sobre objetivo" : "Bajo objetivo", cls: deltaClass(kpis.inventoryGapPct) }
  ];
  row.innerHTML = cards.map(c => `
    <div class="kpi-card">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-delta ${c.cls}">${c.delta}</div>
    </div>
  `).join("");
}

// ---------- Render insights ----------
function renderInsights(report) {
  const list = document.getElementById("insightsList");
  const labelMap = { risk: ["Riesgo", "risk"], watch: ["Atención", "watch"], ok: ["Ok", "ok"] };
  list.innerHTML = report.insights.map(i => {
    const [label, cls] = labelMap[i.level];
    return `<li><span class="badge ${cls}">${label}:</span>${i.text}</li>`;
  }).join("");
}

// ---------- Charts ----------
let chartRefs = {};
function destroyCharts() {
  Object.values(chartRefs).forEach(c => c && c.destroy());
  chartRefs = {};
}

const CHART_COLORS = { accent: "#0077b6", accent2: "#0091d4", good: "#1a9c63", warn: "#b5720a", bad: "#d1373f", grid: "#e3e8f1", text: "#5a6478" };

function baseOptions(extra = {}) {
  return Object.assign({
    responsive: true,
    plugins: { legend: { labels: { color: CHART_COLORS.text } } },
    scales: {
      x: { ticks: { color: CHART_COLORS.text }, grid: { color: CHART_COLORS.grid } },
      y: { ticks: { color: CHART_COLORS.text }, grid: { color: CHART_COLORS.grid } }
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
        { label: "Actual", data: budgetByMonth.map(b => b.actual), borderColor: CHART_COLORS.accent, backgroundColor: "transparent", tension: 0.3 },
        { label: "Presupuesto", data: budgetByMonth.map(b => b.budget), borderColor: CHART_COLORS.text, backgroundColor: "transparent", borderDash: [6, 4], tension: 0.3 }
      ]
    },
    options: baseOptions()
  });

  chartRefs.variance = new Chart(document.getElementById("chartVariance"), {
    type: "bar",
    data: {
      labels: varianceByCC.map(v => v.cc),
      datasets: [{
        label: "Variación %",
        data: varianceByCC.map(v => v.variance),
        backgroundColor: varianceByCC.map(v => v.variance > 5 ? CHART_COLORS.bad : v.variance < -5 ? CHART_COLORS.good : CHART_COLORS.accent2)
      }]
    },
    options: baseOptions({ plugins: { legend: { display: false } } })
  });

  chartRefs.inventory = new Chart(document.getElementById("chartInventory"), {
    type: "bar",
    data: {
      labels: inventoryByCC.map(i => i.cc),
      datasets: [
        { label: "Actual", data: inventoryByCC.map(i => i.actual), backgroundColor: CHART_COLORS.accent },
        { label: "Objetivo", data: inventoryByCC.map(i => i.target), backgroundColor: CHART_COLORS.text }
      ]
    },
    options: baseOptions()
  });

  chartRefs.productivity = new Chart(document.getElementById("chartProductivity"), {
    type: "line",
    data: {
      labels: productivityByMonth.map(p => p.month),
      datasets: [{ label: "Índice de productividad", data: productivityByMonth.map(p => p.index), borderColor: CHART_COLORS.good, backgroundColor: "rgba(53,209,138,0.15)", fill: true, tension: 0.3 }]
    },
    options: baseOptions({ plugins: { legend: { display: false } } })
  });
}

// ---------- Pipeline ----------
function runPipeline(csvText, sourceLabel) {
  try {
    const rows = parseCSV(csvText);
    if (!rows.length) throw new Error("CSV vacío");
    const report = computeReport(rows);
    renderKPIs(report);
    renderCharts(report);
    renderInsights(report);
    document.getElementById("dataStatus").textContent = `Datos cargados: ${sourceLabel} (${rows.length} filas)`;
  } catch (e) {
    document.getElementById("dataStatus").textContent = `Error procesando CSV: ${e.message}`;
  }
}

document.getElementById("loadSampleBtn").addEventListener("click", () => {
  fetch("assets/data/sample_finance_data.csv")
    .then(r => r.text())
    .then(text => runPipeline(text, "sample_finance_data.csv"));
});

document.getElementById("csvInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => runPipeline(reader.result, file.name);
  reader.readAsText(file);
});

// ---------- Chatbot ----------
function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function findAnswer(userText) {
  const norm = normalize(userText);
  let best = null;
  let bestScore = 0;
  CHAT_RESPONSES.forEach(entry => {
    const score = entry.keywords.filter(k => norm.includes(normalize(k))).length;
    if (score > bestScore) { bestScore = score; best = entry; }
  });
  return best ? best.answer : CHAT_FALLBACK;
}

function appendMessage(text, who) {
  const log = document.getElementById("chatLog");
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function renderChatSuggestions() {
  const box = document.getElementById("chatSuggestions");
  const prompts = ["¿Experiencia con SAP?", "¿Qué haces en Power BI?", "¿Cómo automatizas procesos?", "¿Manejas SQL?"];
  box.innerHTML = prompts.map(p => `<button type="button" class="chip">${p}</button>`).join("");
  box.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("chatInput").value = btn.textContent;
      document.getElementById("chatForm").requestSubmit();
    });
  });
}

document.getElementById("chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  appendMessage(text, "user");
  input.value = "";
  setTimeout(() => appendMessage(findAnswer(text), "bot"), 250);
});

// ---------- Init ----------
renderSkills();
renderChatSuggestions();
appendMessage("Hola, soy el asistente de este portafolio. Pregúntame sobre SAP, Power BI, automatización o mi experiencia en Finance & Controlling.", "bot");
