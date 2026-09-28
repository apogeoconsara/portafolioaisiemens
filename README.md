# Digital Finance Console

A working single-screen tool built for a Digital Finance / Business Intelligence role
(SAP FI/CO, Power BI/Tableau, Alteryx-style automation, SQL, AI-assisted reporting).
It is not a resume — every tab is a small working implementation of something the job
post asks for, running entirely client-side (no backend, no build step).

Open `index.html` in a browser, or serve the folder statically:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Data model

Four source extracts, joined client-side, mirror a real SAP FI/CO landscape rather than a
single flat spreadsheet:

- `fico_actuals.csv` — a SAP FI/CO actual/plan line-item extract: `bukrs` (company code),
  `kokrs` (controlling area), `gjahr`/`poper` (fiscal year/period), `kostl` (cost center),
  `kstar`/`kstar_name` (cost element), `waers`, `actual_amount`, `plan_amount`.
- `cost_center_master.csv` — a CSKS/CSKT-style cost-center master (name, cost-center group,
  plant assignment, lock status). One posting (`4009000`) has no matching master record,
  and one cost center (`4004000`) is `BLOCKED` — both are real, detectable data-governance
  problems, not scripted text.
- `inventory_mm.csv` — a separate MM stock extract by plant (`werks`/`lgort`/`matnr`,
  `labst` actual stock, `minbe` reorder point), joined back to a cost center via the plant
  assignment in the master data.
- `ops_kpis.csv` — a non-SAP operations feed (productivity index, headcount) joined on
  cost center + period, representing the "other business systems" the job post mentions.

## Tabs

- **Data Pipeline** — extracts all four sources, joins FI/CO actuals to cost-center master
  and ops KPIs, and runs 7 data quality/governance checks (schema, nulls, negative amounts,
  duplicate KOSTL/period, unmastered cost centers, blocked cost centers) with every step
  logged automatically.
- **Dashboard** — the KPIs and charts (Chart.js) a Power BI/Tableau report would show:
  actual vs. plan, variance % by cost center, inventory vs. reorder point, productivity
  trend.
- **SQL Explorer** — a real, in-browser SQL engine (alasql) over the raw tables
  (`fico_actuals`, `cost_center_master`, `inventory_mm`, `ops_kpis`) plus a joined `finance`
  view. The default query is an actual `LEFT JOIN` that finds the unmastered cost center.
- **AI Executive Summary** — sends the computed KPIs to the Claude API and asks for a
  board-ready summary. Falls back to a deterministic rule-based summary when no API key
  is connected, so the tab always works.
- **AI Assistant** — a chat grounded in the currently loaded dataset, including the
  governance findings above. Answered by Claude when an API key is connected, otherwise by
  a deterministic automation-logic fallback.

Available in English and Spanish (toggle in the sidebar).

## Using the Claude API tabs

Click **Connect Claude API** in the sidebar and paste an Anthropic API key. The key is
kept only in this browser tab (memory, or `sessionStorage` if you check "remember"), and
is sent directly to `api.anthropic.com` — this page has no server of its own to send it
to. This direct-from-browser pattern (`anthropic-dangerous-direct-browser-access` header)
is meant for demos/prototyping, not production use.

## Structure

```
index.html
assets/
  css/style.css
  js/
    i18n.js                 # EN/ES strings + t()/setLang()
    data-engine.js           # CSV parsing, KPI/insight computation, quality checks
    sql-engine.js             # alasql wrapper + example queries
    ai.js                     # Claude API calls (executive summary, chat)
    assistant-fallback.js     # deterministic assistant used without an API key
    app.js                    # view switching, rendering, event wiring
  vendor/
    chart.umd.min.js          # Chart.js, vendored (no CDN dependency)
    alasql.min.js             # alasql, vendored (no CDN dependency)
  data/
    fico_actuals.csv          # SAP FI/CO actual/plan line items
    cost_center_master.csv    # CSKS/CSKT-style cost-center master
    inventory_mm.csv          # SAP MM stock extract by plant
    ops_kpis.csv               # non-SAP ops KPI feed (productivity, headcount)
```

## Note on real SAP experience

This tool demonstrates the ability to reason about and build against a SAP FI/CO-shaped
data model (cost centers, cost elements, controlling area, master-data governance) — it
is not a claim of hands-on production SAP experience. Check the CV for what's actually
been done in production.
