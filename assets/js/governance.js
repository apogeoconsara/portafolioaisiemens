// Renderers for Roadmap, Controls & Documentation, Automation & Impact and Guide & Downloads.
// Depends on: I18N/t/CURRENT_LANG (i18n.js), governance-data.js, Chart.js, and the
// pipeline globals declared in app.js (read lazily at render time).

const LV = (o) => (o && typeof o === "object") ? (o[CURRENT_LANG] ?? o.en) : o;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let govCharts = {};
function destroyGovChart(name) { if (govCharts[name]) { govCharts[name].destroy(); delete govCharts[name]; } }

const GOV_COLORS = { accent: "#0077b6", accent2: "#0091d4", good: "#1a9c63", warn: "#b5720a", bad: "#d1373f", grid: "#e3e8f1", text: "#5a6478" };

const ROADMAP_STATUS_COLOR = { live: GOV_COLORS.good, progress: GOV_COLORS.accent, pilot: GOV_COLORS.accent2, planned: "#8a94a8" };
let roadmapFilter = "all";
let controlsTab = "matrix";
const impactState = {
  steps: { extract: [3, 0], clean: [6, 0], validate: [5, 1], report: [4, 0.5] },
  processes: 3, runs: 12, rate: 45, maint: 60
};

// ---------- helpers ----------
function scoreOf(r) { return r.value / r.effort; }
function quadrantOf(r) {
  if (r.value >= 7 && r.effort <= 5) return "quick";
  if (r.value >= 7) return "strategic";
  return "fill";
}
function waveOf(r) {
  const q = quadrantOf(r);
  if (q === "quick") return "now";
  if (q === "fill") return "alongside";
  return r.effort <= 7 ? "next" : "later";
}
function rankedRoadmap() { return [...ROADMAP].sort((a, b) => scoreOf(b) - scoreOf(a) || a.effort - b.effort); }

function checkById(id) {
  return (typeof lastQualityChecks !== "undefined" ? lastQualityChecks : []).find(c => c.id === id);
}
function hasData() { return typeof currentActuals !== "undefined" && currentActuals.length > 0; }

function roadmapEvidence(r) {
  const key = `roadmap.ev.${r.id}`;
  if (!hasData()) return t("roadmap.noData");
  const vars = {};
  if (r.id === "R1") vars.rows = currentActuals.length;
  if (r.id === "R2") {
    const m = checkById("master"), b = checkById("blocked");
    vars.unm = m && m.detail ? m.detail.length : 0;
    vars.blk = b && b.detail ? b.detail.length : 0;
  }
  if (r.id === "R4") {
    vars.total = currentInventoryRaw.length;
    vars.low = currentInventoryRaw.filter(i => i.labst <= i.minbe).length;
  }
  if (r.id === "R5") {
    vars.rows = currentOps.length;
    vars.avg = currentOps.length ? (currentOps.reduce((s, o) => s + o.productivity_index, 0) / currentOps.length).toFixed(2) : "—";
  }
  return t(key, vars);
}

const statusBadge = (s) => `<span class="pill pill-${s}">${t("status." + s)}</span>`;

// ---------- Roadmap ----------
function renderRoadmap() {
  const items = rankedRoadmap();

  const waves = ["all", "now", "alongside", "next", "later"];
  document.getElementById("roadmapFilters").innerHTML = waves.map(w =>
    `<button class="chip ${roadmapFilter === w ? "chip-active" : ""}" data-wave="${w}">${w === "all" ? t("roadmap.filter.all") : t("wave." + w)}</button>`).join("");

  const rows = items.filter(r => roadmapFilter === "all" || waveOf(r) === roadmapFilter);
  document.getElementById("roadmapTable").innerHTML = `
    <thead><tr>
      <th class="num">${t("roadmap.col.rank")}</th><th>${t("roadmap.col.initiative")}</th>
      <th class="num">${t("roadmap.col.value")}</th><th class="num">${t("roadmap.col.effort")}</th>
      <th>${t("roadmap.col.wave")}</th><th>${t("roadmap.col.status")}</th>
    </tr></thead>
    <tbody>${rows.map(r => `
      <tr>
        <td class="num">${items.indexOf(r) + 1}</td>
        <td><div class="strong">${esc(LV(r.name))}</div><div class="sub">${esc(roadmapEvidence(r))}</div></td>
        <td class="num">${r.value}</td><td class="num">${r.effort}</td>
        <td><span class="pill pill-wave-${waveOf(r)}">${t("wave." + waveOf(r))}</span></td>
        <td>${statusBadge(r.status)}</td>
      </tr>`).join("")}</tbody>`;

  renderRoadmapChart(items);
  document.getElementById("roadmapLegend").innerHTML = ["live", "progress", "pilot", "planned"].map(k =>
    `<span><i style="background:${ROADMAP_STATUS_COLOR[k]}"></i>${t("status." + k)}</span>`).join("");
}

function renderRoadmapChart(items) {
  destroyGovChart("roadmap");
  const canvas = document.getElementById("chartRoadmap");
  if (!canvas) return;
  const colorFor = (r) => ROADMAP_STATUS_COLOR[r.status];
  const labelPlugin = {
    id: "roadmapLabels",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales: { x, y } } = chart;
      ctx.save();
      // quadrant guides
      ctx.strokeStyle = "rgba(90,100,120,.35)"; ctx.setLineDash([5, 4]);
      const xv = x.getPixelForValue(5.5), yv = y.getPixelForValue(6.5);
      ctx.beginPath(); ctx.moveTo(xv, a.top); ctx.lineTo(xv, a.bottom); ctx.moveTo(a.left, yv); ctx.lineTo(a.right, yv); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(90,100,120,.75)"; ctx.font = "600 11px Inter, sans-serif";
      ctx.textAlign = "left"; ctx.fillText(t("roadmap.q.quick"), a.left + 8, a.top + 16);
      ctx.textAlign = "right"; ctx.fillText(t("roadmap.q.strategic"), a.right - 8, a.top + 16);
      ctx.fillText(t("roadmap.q.fill"), a.left + 70, a.bottom - 8);
      // point ids
      ctx.fillStyle = "#fff"; ctx.font = "700 10px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      chart.getDatasetMeta(0).data.forEach((pt, i) => ctx.fillText(items[i].id, pt.x, pt.y + 0.5));
      ctx.restore();
    }
  };
  govCharts.roadmap = new Chart(canvas, {
    type: "scatter",
    data: { datasets: [{
      data: items.map(r => ({ x: r.effort, y: r.value })),
      pointRadius: 12, pointHoverRadius: 14,
      backgroundColor: items.map(colorFor), borderColor: "#fff", borderWidth: 2
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          title: (c) => `${items[c[0].dataIndex].id} · ${LV(items[c[0].dataIndex].name)}`,
          label: (c) => `${t("roadmap.col.value")} ${items[c.dataIndex].value} · ${t("roadmap.col.effort")} ${items[c.dataIndex].effort} · ${t("roadmap.col.score")} ${scoreOf(items[c.dataIndex]).toFixed(1)}`
        } }
      },
      scales: {
        x: { min: 0, max: 10, title: { display: true, text: t("roadmap.axis.effort"), color: GOV_COLORS.text, font: { size: 11 } }, grid: { color: GOV_COLORS.grid }, ticks: { color: GOV_COLORS.text, stepSize: 1 } },
        y: { min: 3, max: 10, title: { display: true, text: t("roadmap.axis.value"), color: GOV_COLORS.text, font: { size: 11 } }, grid: { color: GOV_COLORS.grid }, ticks: { color: GOV_COLORS.text, stepSize: 1 } }
      }
    },
    plugins: [labelPlugin]
  });
}

// ---------- Controls ----------
function controlStatus(c) {
  if (c.check) {
    const res = checkById(c.check);
    if (!res) return { s: "manual", detail: "" };
    return res.passed ? { s: "pass", detail: "" } : { s: "fail", detail: (res.detail || []).join(", ") };
  }
  return { s: c.state === "planned" ? "planned" : "manual", detail: "" };
}

function renderControls() {
  document.querySelectorAll("#controlsTabs .chip").forEach(b => b.classList.toggle("chip-active", b.dataset.ctab === controlsTab));
  document.querySelectorAll("#controlsBody > [data-ctab]").forEach(el => el.hidden = el.dataset.ctab !== controlsTab);

  const statuses = CONTROLS.map(controlStatus);
  const pass = statuses.filter(s => s.s === "pass").length;
  const fail = statuses.filter(s => s.s === "fail").length;
  document.getElementById("controlsSummary").innerHTML =
    `<span class="v-good">${t("controls.sum.pass", { n: pass })}</span><span class="dot">·</span>` +
    `<span class="${fail ? "v-bad" : "v-good"}">${t("controls.sum.fail", { n: fail })}</span><span class="dot">·</span>` +
    `<span>${t("controls.sum.total", { n: CONTROLS.length })}</span>`;

  document.getElementById("controlsTable").innerHTML = `
    <thead><tr><th class="nw">${t("controls.col.id")}</th><th>${t("controls.col.control")}</th><th>${t("controls.col.type")}</th>
      <th>${t("controls.col.freq")}</th><th>${t("controls.col.owner")}</th><th>${t("controls.col.status")}</th></tr></thead>
    <tbody>${CONTROLS.map((c, i) => {
      const st = statuses[i];
      return `<tr>
        <td class="mono nw">${c.id}</td>
        <td><div class="strong">${esc(LV(c.name))}</div><div class="sub">${esc(LV(c.objective))}</div></td>
        <td>${t("type." + c.type)} · ${t("mode." + c.mode)}</td>
        <td>${esc(LV(c.freq))}</td><td>${esc(LV(c.owner))}</td>
        <td><span class="pill pill-c-${st.s}">${t("cstatus." + st.s)}</span>${st.detail ? `<div class="check-detail">${esc(t("controls.exception", { detail: st.detail }))}</div>` : ""}</td>
      </tr>`;
    }).join("")}</tbody>`;

  document.getElementById("kpiTable").innerHTML = `
    <thead><tr>${["name", "definition", "formula", "threshold", "owner"].map(k => `<th>${t("kpi.col." + k)}</th>`).join("")}</tr></thead>
    <tbody>${KPI_GLOSSARY.map(k => `<tr>
      <td class="strong">${esc(LV(k.name))}</td><td>${esc(LV(k.def))}</td><td class="mono">${esc(k.formula)}</td>
      <td>${esc(LV(k.threshold))}</td><td>${esc(LV(k.owner))}</td>
    </tr>`).join("")}</tbody>`;

  document.getElementById("ownerTable").innerHTML = `
    <thead><tr>${["dataset", "system", "owner", "refresh", "rows"].map(k => `<th class="${k === "rows" ? "num" : ""}">${t("own.col." + k)}</th>`).join("")}</tr></thead>
    <tbody>${OWNERSHIP.map(o => `<tr>
      <td class="mono strong">${o.dataset}</td><td>${esc(LV(o.system))}</td><td>${esc(LV(o.owner))}</td>
      <td>${esc(LV(o.refresh))}</td><td class="num">${o.rows()}</td>
    </tr>`).join("")}</tbody>`;

  const hops = [t("own.hop.1"), t("own.hop.2"), t("own.hop.3"), t("own.hop.4")];
  document.getElementById("lineage").innerHTML = hops.map(h => `<span class="hop">${esc(h)}</span>`).join('<span class="hop-arrow">→</span>');
}

// ---------- Automation: Alteryx-style workflow ----------
function renderWorkflow() {
  const W = 1120, H = 300, NW = 190, NH = 52;
  const kinds = { input: "#0077b6", join: "#6b4fbb", formula: "#b5720a", test: "#1a9c63", output: "#10192e" };
  const nodes = {
    i1: { x: 10, y: 10, k: "input", l: t("automation.n.actuals") },
    i2: { x: 10, y: 80, k: "input", l: t("automation.n.master") },
    i3: { x: 10, y: 150, k: "input", l: t("automation.n.ops") },
    i4: { x: 10, y: 220, k: "input", l: t("automation.n.inventory") },
    j1: { x: 250, y: 30, k: "join", l: t("automation.n.j1") },
    j3: { x: 250, y: 200, k: "join", l: t("automation.n.j3") },
    j2: { x: 470, y: 90, k: "join", l: t("automation.n.j2") },
    f: { x: 690, y: 50, k: "formula", l: t("automation.n.formula") },
    c: { x: 690, y: 170, k: "test", l: t("automation.n.test") },
    o1: { x: 920, y: 10, k: "output", l: t("automation.n.dash") },
    o2: { x: 920, y: 80, k: "output", l: t("automation.n.pbi") },
    o3: { x: 920, y: 150, k: "output", l: t("automation.n.sql") },
    o4: { x: 920, y: 220, k: "output", l: t("automation.n.exc"), warn: true }
  };
  const edges = [["i1", "j1"], ["i2", "j1"], ["i4", "j3"], ["i2", "j3"], ["j1", "j2"], ["i3", "j2"], ["j2", "f"], ["j3", "f"], ["f", "c"],
    ["c", "o1"], ["c", "o2"], ["c", "o3"], ["c", "o4"]];
  const kindLabel = { input: t("automation.node.input"), join: t("automation.node.join"), formula: t("automation.node.formula"), test: t("automation.node.test"), output: t("automation.node.output") };

  const paths = edges.map(([a, b]) => {
    const A = nodes[a], B = nodes[b];
    const x1 = A.x + NW, y1 = A.y + NH / 2, x2 = B.x, y2 = B.y + NH / 2, mx = (x1 + x2) / 2;
    const warn = b === "o4";
    return `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="${warn ? GOV_COLORS.bad : "#9aa6bd"}" stroke-width="1.6" ${warn ? 'stroke-dasharray="5 4"' : ""} marker-end="url(#arrow${warn ? "W" : ""})"/>`;
  }).join("");
  const boxes = Object.values(nodes).map(n => `
    <g>
      <rect x="${n.x}" y="${n.y}" width="${NW}" height="${NH}" rx="8" fill="#fff" stroke="${n.warn ? GOV_COLORS.bad : "#cfd8e8"}" stroke-width="1.2"/>
      <rect x="${n.x}" y="${n.y}" width="${NW}" height="16" rx="8" fill="${kinds[n.k]}"/>
      <rect x="${n.x}" y="${n.y + 8}" width="${NW}" height="8" fill="${kinds[n.k]}"/>
      <text x="${n.x + 10}" y="${n.y + 12}" font-size="9.5" font-weight="700" fill="#fff" letter-spacing=".4">${esc(kindLabel[n.k].toUpperCase())}</text>
      <text x="${n.x + 10}" y="${n.y + 36}" font-size="12" font-weight="600" fill="#10192e">${esc(n.l)}</text>
    </g>`).join("");

  document.getElementById("workflowSvg").innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("automation.workflow.title"))}" font-family="Inter, system-ui, sans-serif">
      <defs>
        <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9aa6bd"/></marker>
        <marker id="arrowW" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${GOV_COLORS.bad}"/></marker>
      </defs>
      ${paths}${boxes}
    </svg>`;
}

// ---------- Automation: impact model ----------
function computeImpact() {
  const s = impactState;
  const manualPerRun = Object.values(s.steps).reduce((a, [m]) => a + m, 0);
  const autoPerRun = Object.values(s.steps).reduce((a, [, u]) => a + u, 0);
  const manualYear = manualPerRun * s.processes * s.runs;
  const autoYear = autoPerRun * s.processes * s.runs + s.maint;
  const saved = manualYear - autoYear;
  return { manualPerRun, autoPerRun, manualYear, autoYear, saved,
    pct: manualYear > 0 ? saved / manualYear : 0, fte: saved / 1800, cost: saved * s.rate };
}

function renderImpact() {
  const stepKeys = ["extract", "clean", "validate", "report"];
  const num = (cls, key, idx, val) => `<input type="number" class="num-input" min="0" step="0.5" data-imp="${cls}" data-key="${key}" data-idx="${idx}" value="${val}">`;
  document.getElementById("impactInputs").innerHTML = `
    <table class="gov-table compact">
      <thead><tr><th>${t("automation.step")}</th><th>${t("automation.manual")}</th><th>${t("automation.automated")}</th></tr></thead>
      <tbody>${stepKeys.map(k => `<tr><td>${t("automation.step." + k)}</td><td>${num("step", k, 0, impactState.steps[k][0])}</td><td>${num("step", k, 1, impactState.steps[k][1])}</td></tr>`).join("")}</tbody>
    </table>
    <div class="param-grid">
      ${[["processes", "automation.param.processes", 1], ["runs", "automation.param.runs", 1], ["rate", "automation.param.rate", 1], ["maint", "automation.param.maint", 1]].map(([k, label, st]) =>
        `<label class="param"><span>${t(label)}</span><input type="number" class="num-input" min="0" step="${st}" data-imp="param" data-key="${k}" value="${impactState[k]}"></label>`).join("")}
    </div>`;
  updateImpactOutputs();
}

function updateImpactOutputs() {
  const r = computeImpact();
  const f = (n) => Math.round(n).toLocaleString("en-US");
  document.getElementById("impactOutputs").innerHTML = [
    [t("automation.out.manualHours"), f(r.manualYear)],
    [t("automation.out.autoHours"), f(r.autoYear)],
    [t("automation.out.saved"), f(r.saved), "good"],
    [t("automation.out.pct"), (r.pct * 100).toFixed(0) + "%", "good"],
    [t("automation.out.fte"), r.fte.toFixed(2), "good"],
    [t("automation.out.cost"), "$" + f(r.cost), "good"]
  ].map(([l, v, c]) => `<div class="kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value ${c ? "v-" + c : ""}">${v}</div></div>`).join("");

  const canvas = document.getElementById("chartImpact");
  if (!canvas) return;
  if (govCharts.impact) {
    govCharts.impact.data.datasets[0].data = [r.manualYear, r.autoYear];
    govCharts.impact.data.labels = [t("automation.chart.manual"), t("automation.chart.auto")];
    govCharts.impact.update();
    return;
  }
  govCharts.impact = new Chart(canvas, {
    type: "bar",
    data: { labels: [t("automation.chart.manual"), t("automation.chart.auto")], datasets: [{ data: [r.manualYear, r.autoYear], backgroundColor: [GOV_COLORS.text, GOV_COLORS.accent], borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false }, ticks: { color: GOV_COLORS.text } }, y: { beginAtZero: true, grid: { color: GOV_COLORS.grid }, ticks: { color: GOV_COLORS.text } } }
    }
  });
}

function renderAutomation() {
  renderWorkflow();
  destroyGovChart("impact");
  renderImpact();
}

// ---------- Enablement ----------
function renderEnablement() {
  document.getElementById("quickStart").innerHTML = QUICK_START.map((s, i) => `<li><span class="qs-n">${i + 1}</span><span>${esc(LV(s))}</span></li>`).join("");

  document.getElementById("faqList").innerHTML = FAQ.map(f => `<details class="faq"><summary>${esc(LV(f.q))}</summary><p>${esc(LV(f.a))}</p></details>`).join("");
}

// ---------- Entry point + events ----------
function renderGovernance() {
  renderRoadmap();
  renderControls();
  renderAutomation();
  renderEnablement();
}

document.getElementById("roadmapFilters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-wave]");
  if (!b) return;
  roadmapFilter = b.dataset.wave;
  renderRoadmap();
});
document.getElementById("controlsTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ctab]");
  if (!b) return;
  controlsTab = b.dataset.ctab;
  renderControls();
});
document.getElementById("impactInputs").addEventListener("input", (e) => {
  const el = e.target.closest("[data-imp]");
  if (!el) return;
  const v = Math.max(0, parseFloat(el.value) || 0);
  if (el.dataset.imp === "step") impactState.steps[el.dataset.key][Number(el.dataset.idx)] = v;
  else impactState[el.dataset.key] = v;
  updateImpactOutputs();
});
