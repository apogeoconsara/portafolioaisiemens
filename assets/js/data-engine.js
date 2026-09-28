// ---------- SAP-style source schemas ----------
// fico_actuals.csv mirrors a SAP FI/CO cost-center actual/plan line-item extract
// (company code BUKRS, controlling area KOKRS, fiscal year/period GJAHR/POPER,
// cost center KOSTL, cost element KSTAR). cost_center_master.csv mirrors the
// CSKS/CSKT cost-center master (name, cost-center group, plant assignment,
// lock status). inventory_mm.csv is a separate MM stock extract by plant
// (WERKS/LGORT/MATNR). ops_kpis.csv represents a non-SAP operations system fed
// into the same pipeline, joined on cost center + period.
const REQUIRED_ACTUALS_COLUMNS = ["bukrs", "kokrs", "gjahr", "poper", "kostl", "kstar", "kstar_name", "waers", "actual_amount", "plan_amount"];

const AREA_BY_GROUP = { MFG: "Manufacturing", SCM: "Supply Chain", FICO: "Finance & Controlling", ITD: "IT / Digital" };

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).filter(Boolean).map(line => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => {
      const raw = (cells[i] ?? "").trim();
      row[h] = raw !== "" && !isNaN(Number(raw)) ? Number(raw) : raw;
    });
    return row;
  });
  return { headers, rows };
}

function pad2(n) { return String(n).padStart(2, "0"); }

// ---------- Join FI/CO actuals -> cost center master -> ops KPIs ----------
function buildEnrichedDataset(actuals, master, inventory, ops) {
  const masterByKey = new Map(master.map(m => [`${m.kokrs}__${m.kostl}`, m]));
  const masterByWerks = new Map();
  master.forEach(m => { if (!masterByWerks.has(m.werks)) masterByWerks.set(m.werks, m); });
  const opsByKey = new Map(ops.map(o => [`${o.kostl}__${o.gjahr}__${o.poper}`, o]));

  const finance = actuals.map(r => {
    const m = masterByKey.get(`${r.kokrs}__${r.kostl}`);
    const o = opsByKey.get(`${r.kostl}__${r.gjahr}__${r.poper}`);
    const unmastered = !m;
    const blocked = !!m && m.status === "BLOCKED";
    const area = m ? (AREA_BY_GROUP[m.kostl_group] || m.kostl_group) : "Unmapped";
    return {
      ...r,
      month: `${r.gjahr}-${pad2(r.poper)}`,
      kostl_name: m ? m.kostl_name : null,
      kostl_group: m ? m.kostl_group : null,
      area,
      unmastered,
      blocked,
      actual_usd: r.actual_amount,
      budget_usd: r.plan_amount,
      productivity_index: o ? o.productivity_index : null,
      headcount: o ? o.headcount : null
    };
  });

  const enrichedInventory = inventory.map(r => {
    const m = masterByWerks.get(r.werks);
    return {
      ...r,
      month: `${r.gjahr}-${pad2(r.poper)}`,
      kostl: m ? m.kostl : null,
      area: m ? (AREA_BY_GROUP[m.kostl_group] || m.kostl_group) : "Unmapped",
      inventory_units: r.labst,
      inventory_target_units: r.minbe
    };
  });

  return { finance, inventory: enrichedInventory };
}

// ---------- Data quality / governance checks (used by the Pipeline tab) ----------
function runQualityChecks(actualsHeaders, actuals, finance) {
  const checks = [];

  checks.push({ id: "rowcount", key: "pipeline.check.rowcount", vars: {}, passed: actuals.length > 0 });

  const missingCols = REQUIRED_ACTUALS_COLUMNS.filter(c => !actualsHeaders.includes(c));
  checks.push({ id: "schema", key: "pipeline.check.schema", vars: { n: REQUIRED_ACTUALS_COLUMNS.length }, passed: missingCols.length === 0, detail: missingCols });

  const hasNulls = missingCols.length === 0 && actuals.some(r => [r.actual_amount, r.plan_amount, r.gjahr, r.poper].some(v => v === "" || v === undefined || Number.isNaN(v)));
  checks.push({ id: "nulls", key: "pipeline.check.nulls", vars: {}, passed: !hasNulls });

  const hasNegative = missingCols.length === 0 && actuals.some(r => r.actual_amount < 0 || r.plan_amount < 0);
  checks.push({ id: "negbudget", key: "pipeline.check.negbudget", vars: {}, passed: !hasNegative });

  const seen = new Set();
  const dupeKeys = [];
  actuals.forEach(r => {
    const k = `${r.kostl}__${r.gjahr}__${r.poper}`;
    if (seen.has(k)) dupeKeys.push(k);
    seen.add(k);
  });
  checks.push({ id: "dupes", key: "pipeline.check.dupes", vars: {}, passed: dupeKeys.length === 0, detail: dupeKeys });

  const unmasteredCodes = [...new Set(finance.filter(r => r.unmastered).map(r => r.kostl))];
  checks.push({ id: "master", key: "pipeline.check.master", vars: {}, passed: unmasteredCodes.length === 0, detail: unmasteredCodes });

  const blockedCodes = [...new Set(finance.filter(r => r.blocked).map(r => r.kostl))];
  checks.push({ id: "blocked", key: "pipeline.check.blocked", vars: {}, passed: blockedCodes.length === 0, detail: blockedCodes });

  return checks;
}

// ---------- KPI + insight engine ----------
function computeReport(finance, inventory) {
  const months = [...new Set(finance.map(r => r.month))].sort();
  const costCenters = [...new Set(finance.map(r => r.kostl))];

  const totalActual = finance.reduce((s, r) => s + (r.actual_usd || 0), 0);
  const totalBudget = finance.reduce((s, r) => s + (r.budget_usd || 0), 0);

  const prodRows = finance.filter(r => typeof r.productivity_index === "number");
  const avgProductivity = prodRows.length ? prodRows.reduce((s, r) => s + r.productivity_index, 0) / prodRows.length : 0;

  const invWithTarget = inventory.filter(r => (r.inventory_target_units || 0) > 0);
  const inventoryGapPct = invWithTarget.length
    ? invWithTarget.reduce((s, r) => s + ((r.inventory_units - r.inventory_target_units) / r.inventory_target_units), 0) / invWithTarget.length * 100
    : 0;

  const latestMonth = months[months.length - 1];
  const latestRows = finance.filter(r => r.month === latestMonth);
  const latestActual = latestRows.reduce((s, r) => s + r.actual_usd, 0);
  const latestBudget = latestRows.reduce((s, r) => s + r.budget_usd, 0);
  const latestVariancePct = ((latestActual - latestBudget) / latestBudget) * 100;

  const budgetByMonth = months.map(m => {
    const rs = finance.filter(r => r.month === m);
    return { month: m, actual: rs.reduce((s, r) => s + r.actual_usd, 0), budget: rs.reduce((s, r) => s + r.budget_usd, 0) };
  });

  const varianceByCC = costCenters.map(cc => {
    const r = latestRows.find(x => x.kostl === cc);
    if (!r) return { cc, ccLabel: cc, variance: 0 };
    return { cc, ccLabel: `${cc} (${r.area})`, variance: ((r.actual_usd - r.budget_usd) / r.budget_usd) * 100, unmastered: r.unmastered, blocked: r.blocked };
  });

  const inventoryByCC = inventory
    .filter(r => r.month === latestMonth && (r.inventory_target_units || 0) > 0)
    .map(r => ({ cc: r.kostl, ccLabel: `${r.kostl} (${r.area})`, actual: r.inventory_units, target: r.inventory_target_units }));

  const productivityByMonth = months.map(m => {
    const rs = finance.filter(r => r.month === m && typeof r.productivity_index === "number");
    return { month: m, index: rs.length ? rs.reduce((s, r) => s + r.productivity_index, 0) / rs.length : null };
  }).filter(p => p.index !== null);

  // Insights as {level, key, vars} so the UI can render them in the active language.
  const insights = [];
  latestRows.filter(r => r.unmastered).forEach(r => {
    insights.push({ level: "risk", key: "insights.text.unmastered", vars: { cc: r.kostl, amount: fmtUSD(r.actual_usd), month: latestMonth } });
  });
  latestRows.filter(r => r.blocked).forEach(r => {
    insights.push({ level: "risk", key: "insights.text.blocked", vars: { cc: `${r.kostl} (${r.kostl_name})`, amount: fmtUSD(r.actual_usd), month: latestMonth } });
  });
  varianceByCC.forEach(v => {
    if (v.variance > 5) insights.push({ level: "risk", key: "insights.text.overspend", vars: { cc: v.ccLabel, pct: v.variance.toFixed(1), month: latestMonth } });
    else if (v.variance < -5) insights.push({ level: "ok", key: "insights.text.saving", vars: { cc: v.ccLabel, pct: v.variance.toFixed(1), month: latestMonth } });
  });
  inventoryByCC.forEach(inv => {
    const gap = ((inv.actual - inv.target) / inv.target) * 100;
    if (gap > 10) insights.push({ level: "watch", key: "insights.text.inventoryHigh", vars: { cc: inv.ccLabel, pct: gap.toFixed(1) } });
    else if (gap < -10) insights.push({ level: "risk", key: "insights.text.inventoryLow", vars: { cc: inv.ccLabel, pct: Math.abs(gap).toFixed(1) } });
  });
  const latestProd = productivityByMonth[productivityByMonth.length - 1];
  const firstProd = productivityByMonth[0];
  if (latestProd && firstProd && latestProd.index < firstProd.index) {
    insights.push({ level: "watch", key: "insights.text.productivityDrop", vars: { first: firstProd.index.toFixed(2), last: latestProd.index.toFixed(2), firstMonth: firstProd.month, lastMonth: latestProd.month } });
  }
  if (insights.length === 0) insights.push({ level: "ok", key: "insights.text.none", vars: {} });

  return {
    kpis: { totalActual, totalBudget, avgProductivity, inventoryGapPct, latestMonth, latestVariancePct, costCenterCount: costCenters.length },
    charts: { budgetByMonth, varianceByCC, inventoryByCC, productivityByMonth },
    insights
  };
}

function fmtUSD(n) {
  return "$" + Math.round(n).toLocaleString("en-US");
}
