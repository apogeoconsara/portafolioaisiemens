// Deterministic assistant used when no Claude API key is connected. It reads
// live numbers out of the currently computed report so answers stay grounded
// in whatever dataset is loaded, instead of being generic FAQ text.
function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const FALLBACK_RULES = [
  {
    keywords: ["variance", "variacion", "budget", "presupuesto", "sobrecosto", "overspend"],
    answer: (report, lang) => {
      const worst = [...report.charts.varianceByCC].sort((a, b) => b.variance - a.variance)[0];
      if (!worst) return null;
      return lang === "es"
        ? `En ${report.kpis.latestMonth}, el mayor riesgo de variación es ${worst.ccLabel} con ${worst.variance.toFixed(1)}% vs. presupuesto. La variación total del periodo es ${report.kpis.latestVariancePct.toFixed(1)}%. Puedes ver el detalle en la pestaña Dashboard o consultarlo en SQL Explorer.`
        : `In ${report.kpis.latestMonth}, the largest variance risk is ${worst.ccLabel} at ${worst.variance.toFixed(1)}% vs. budget. Overall period variance is ${report.kpis.latestVariancePct.toFixed(1)}%. See the Dashboard tab for the full breakdown, or query it directly in SQL Explorer.`;
    }
  },
  {
    keywords: ["inventory", "inventario", "stock"],
    answer: (report, lang) => {
      if (!report.charts.inventoryByCC.length) return null;
      const worst = [...report.charts.inventoryByCC].sort((a, b) =>
        Math.abs((b.actual - b.target) / b.target) - Math.abs((a.actual - a.target) / a.target)
      )[0];
      const gap = ((worst.actual - worst.target) / worst.target * 100).toFixed(1);
      return lang === "es"
        ? `La mayor brecha de inventario es ${worst.ccLabel}: ${worst.actual} unidades actuales vs. ${worst.target} objetivo (${gap}% de diferencia). La brecha promedio del dataset es ${report.kpis.inventoryGapPct.toFixed(1)}%.`
        : `The largest inventory gap is ${worst.ccLabel}: ${worst.actual} actual units vs. ${worst.target} target (${gap}% difference). The dataset's average gap is ${report.kpis.inventoryGapPct.toFixed(1)}%.`;
    }
  },
  {
    keywords: ["productivity", "productividad"],
    answer: (report, lang) => {
      const trend = report.charts.productivityByMonth;
      const first = trend[0], last = trend[trend.length - 1];
      return lang === "es"
        ? `El índice de productividad promedio pasó de ${first.index.toFixed(2)} en ${first.month} a ${last.index.toFixed(2)} en ${last.month} (meta: 1.00). Se calcula automáticamente al correr el pipeline.`
        : `The average productivity index moved from ${first.index.toFixed(2)} in ${first.month} to ${last.index.toFixed(2)} in ${last.month} (target: 1.00). It's computed automatically each time the pipeline runs.`;
    }
  },
  {
    keywords: ["sap", "fico", "fi/co", "erp", "pipeline", "automat"],
    answer: (report, lang) => lang === "es"
      ? `El pipeline simula una extracción SAP FI/CO por centro de costo (month, cost_center, area, actual_usd, budget_usd, inventory_units, inventory_target_units, productivity_index, headcount). La pestaña Pipeline de Datos ejecuta extraer → validar → transformar → cargar automáticamente, con controles de calidad y un log de cada paso.`
      : `The pipeline simulates a SAP FI/CO cost-center extract (month, cost_center, area, actual_usd, budget_usd, inventory_units, inventory_target_units, productivity_index, headcount). The Data Pipeline tab runs extract → validate → transform → load automatically, with quality checks and a log of every step.`
  },
  {
    keywords: ["sql", "query", "consulta", "base de datos"],
    answer: (report, lang) => lang === "es"
      ? `Puedes escribir SQL directamente sobre la tabla "finance" en la pestaña Explorador SQL — por ejemplo: SELECT area, AVG(productivity_index) FROM finance GROUP BY area. Corre en el navegador, sin backend.`
      : `You can write SQL directly against the "finance" table in the SQL Explorer tab — e.g. SELECT area, AVG(productivity_index) FROM finance GROUP BY area. It runs in the browser, no backend involved.`
  },
  {
    keywords: ["power bi", "tableau", "dashboard", "kpi"],
    answer: (report, lang) => lang === "es"
      ? `El Dashboard muestra actual vs. presupuesto, variación % por centro de costo, inventario vs. objetivo y tendencia de productividad — el mismo tipo de vista que construiría en Power BI o Tableau sobre datos SAP.`
      : `The Dashboard shows actual vs. budget, variance % by cost center, inventory vs. target and productivity trend — the same kind of view you'd build in Power BI or Tableau on top of SAP data.`
  },
  {
    keywords: ["hello", "hi", "hola", "buenas"],
    answer: (report, lang) => lang === "es"
      ? "Hola. Pregúntame sobre variación presupuestal, riesgo de inventario, productividad, el pipeline SAP o cómo consultarlo con SQL."
      : "Hi. Ask me about budget variance, inventory risk, productivity, the SAP pipeline, or how to query it with SQL."
  }
];

function answerFallback(userText, report, lang) {
  const norm = normalize(userText);
  for (const rule of FALLBACK_RULES) {
    if (rule.keywords.some(k => norm.includes(normalize(k)))) {
      const out = rule.answer(report, lang);
      if (out) return out;
    }
  }
  return t("assistant.fallback.generic");
}
