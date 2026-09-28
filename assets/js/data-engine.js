const REQUIRED_COLUMNS = [
  "month", "cost_center", "area", "actual_usd", "budget_usd",
  "inventory_units", "inventory_target_units", "productivity_index", "headcount"
];

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

// ---------- Data quality / governance checks (used by the Pipeline tab) ----------
function runQualityChecks(headers, rows) {
  const checks = [];

  checks.push({ id: "rowcount", key: "pipeline.check.rowcount", vars: {}, passed: rows.length > 0 });

  const missingCols = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
  checks.push({ id: "schema", key: "pipeline.check.schema", vars: { n: REQUIRED_COLUMNS.length }, passed: missingCols.length === 0, detail: missingCols });

  const numericCols = ["actual_usd", "budget_usd", "inventory_units", "inventory_target_units", "productivity_index", "headcount"];
  const hasNulls = missingCols.length === 0 && rows.some(r => numericCols.some(c => r[c] === "" || r[c] === undefined || Number.isNaN(r[c])));
  checks.push({ id: "nulls", key: "pipeline.check.nulls", vars: {}, passed: !hasNulls });

  const hasNegative = missingCols.length === 0 && rows.some(r => r.actual_usd < 0 || r.budget_usd < 0);
  checks.push({ id: "negbudget", key: "pipeline.check.negbudget", vars: {}, passed: !hasNegative });

  const seen = new Set();
  let hasDupes = false;
  if (missingCols.length === 0) {
    rows.forEach(r => {
      const k = `${r.month}__${r.cost_center}`;
      if (seen.has(k)) hasDupes = true;
      seen.add(k);
    });
  }
  checks.push({ id: "dupes", key: "pipeline.check.dupes", vars: {}, passed: !hasDupes });

  return checks;
}

// ---------- KPI + insight engine ----------
function computeReport(rows) {
  const months = [...new Set(rows.map(r => r.month))].sort();
  const costCenters = [...new Set(rows.map(r => r.cost_center))];

  const totalActual = rows.reduce((s, r) => s + (r.actual_usd || 0), 0);
  const totalBudget = rows.reduce((s, r) => s + (r.budget_usd || 0), 0);

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

  const budgetByMonth = months.map(m => {
    const rs = rows.filter(r => r.month === m);
    return { month: m, actual: rs.reduce((s, r) => s + r.actual_usd, 0), budget: rs.reduce((s, r) => s + r.budget_usd, 0) };
  });

  const varianceByCC = costCenters.map(cc => {
    const r = latestRows.find(x => x.cost_center === cc);
    if (!r) return { cc, ccLabel: cc, variance: 0 };
    return { cc, ccLabel: `${cc} (${r.area})`, variance: ((r.actual_usd - r.budget_usd) / r.budget_usd) * 100 };
  });

  const inventoryByCC = latestRows
    .filter(r => (r.inventory_target_units || 0) > 0)
    .map(r => ({ cc: r.cost_center, ccLabel: `${r.cost_center} (${r.area})`, actual: r.inventory_units, target: r.inventory_target_units }));

  const productivityByMonth = months.map(m => {
    const rs = rows.filter(r => r.month === m);
    return { month: m, index: rs.reduce((s, r) => s + r.productivity_index, 0) / rs.length };
  });

  // Insights as {level, key, vars} so the UI can render them in the active language.
  const insights = [];
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
