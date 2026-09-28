// Direct browser calls to the Anthropic Messages API. This is the documented
// "prototyping" pattern (anthropic-dangerous-direct-browser-access header) —
// the key lives only in this tab's memory/sessionStorage and is sent straight
// to api.anthropic.com, never to any other server, because this page has no
// backend of its own.
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL_SUMMARY = "claude-sonnet-5-5";
const MODEL_CHAT = "claude-haiku-4-5-20251001";

let _apiKey = null;

function getApiKey() {
  if (_apiKey) return _apiKey;
  try { return sessionStorage.getItem("anthropic_api_key") || null; } catch (e) { return null; }
}

function setApiKey(key, remember) {
  _apiKey = key || null;
  try {
    if (remember && key) sessionStorage.setItem("anthropic_api_key", key);
    else sessionStorage.removeItem("anthropic_api_key");
  } catch (e) { /* storage unavailable, key still held in memory */ }
}

function clearApiKey() {
  _apiKey = null;
  try { sessionStorage.removeItem("anthropic_api_key"); } catch (e) {}
}

async function callClaude({ model, system, messages, maxTokens }) {
  const key = getApiKey();
  if (!key) throw new Error("no-api-key");

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 600,
      system,
      messages
    })
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const body = await res.json(); msg = body?.error?.message || msg; } catch (e) {}
    throw new Error(msg);
  }

  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
  if (!text) throw new Error("empty-response");
  return text;
}

// Builds a compact, factual data context string from the current report —
// this is what grounds both the executive summary and the assistant.
function buildDataContext(report, rowCount) {
  const { kpis, charts } = report;
  const lines = [];
  lines.push(`Dataset: ${rowCount} SAP FI/CO actual/plan line items (BUKRS/KOKRS/GJAHR/POPER/KOSTL/KSTAR schema) joined against cost-center master data (CSKS/CSKT-style), an MM inventory extract, and a non-SAP ops KPI feed. ${kpis.costCenterCount} cost centers (KOSTL), latest period ${kpis.latestMonth}.`);
  lines.push(`Total spend in period: $${Math.round(kpis.totalActual)} vs. plan $${Math.round(kpis.totalBudget)}.`);
  lines.push(`Budget variance in ${kpis.latestMonth}: ${kpis.latestVariancePct.toFixed(1)}%.`);
  lines.push(`Average productivity index: ${kpis.avgProductivity.toFixed(2)} (target 1.00).`);
  lines.push(`Average inventory gap vs. reorder point (MINBE): ${kpis.inventoryGapPct.toFixed(1)}%.`);
  lines.push("Variance by cost center (latest period):");
  charts.varianceByCC.forEach(v => lines.push(`- ${v.ccLabel}: ${v.variance.toFixed(1)}% vs. plan${v.unmastered ? " [GOVERNANCE ISSUE: this KOSTL has no cost-center master record]" : ""}${v.blocked ? " [GOVERNANCE ISSUE: this KOSTL is BLOCKED in master data]" : ""}`));
  if (charts.inventoryByCC.length) {
    lines.push("Inventory actual (LABST) vs. reorder point (MINBE), latest period:");
    charts.inventoryByCC.forEach(i => lines.push(`- ${i.ccLabel}: ${i.actual} actual vs. ${i.target} reorder point`));
  }
  lines.push("Productivity index by period: " + charts.productivityByMonth.map(p => `${p.month}=${p.index.toFixed(2)}`).join(", "));
  return lines.join("\n");
}

async function generateExecutiveSummary(dataContext, lang) {
  const langName = lang === "es" ? "Spanish" : "English";
  const system = `You are a Finance & Controlling analyst producing a short executive summary for Finance, Operations, IT and Supply Chain leadership, based on SAP FI/CO-derived KPIs. Be concise (max 6 bullet points), specific about numbers, and flag risks before minor items. Respond in ${langName} only, as plain bullet points starting with "- ".`;
  return callClaude({
    model: MODEL_SUMMARY,
    system,
    messages: [{ role: "user", content: `Here is the current dataset summary:\n\n${dataContext}\n\nWrite the executive summary.` }],
    maxTokens: 500
  });
}

async function chatWithAssistant(userText, dataContext, lang, history) {
  const langName = lang === "es" ? "Spanish" : "English";
  const system = `You are the assistant embedded in a Digital Finance automation console (SAP FI/CO data pipeline, KPI dashboard, SQL explorer). Answer questions about the currently loaded dataset, financial/controlling concepts, or how to use the tool. Be concise and concrete. Respond in ${langName} only.\n\nCurrent dataset summary:\n${dataContext}`;
  const messages = [...(history || []), { role: "user", content: userText }];
  return callClaude({ model: MODEL_CHAT, system, messages, maxTokens: 400 });
}
