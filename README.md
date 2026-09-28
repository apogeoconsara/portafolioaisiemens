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

## Tabs

- **Data Pipeline** — simulates an automated extract → validate → transform → load flow
  over a SAP FI/CO-style cost-center export (`assets/data/sample_finance_data.csv`, or any
  CSV with the same schema). Runs data quality/governance checks and logs every step.
- **Dashboard** — the KPIs and charts (Chart.js) a Power BI/Tableau report would show:
  actual vs. budget, variance % by cost center, inventory vs. target, productivity trend.
- **SQL Explorer** — a real, in-browser SQL engine (alasql) over the loaded dataset
  (table `finance`). Write and run your own queries, no BI tool required.
- **AI Executive Summary** — sends the computed KPIs to the Claude API and asks for a
  board-ready summary. Falls back to a deterministic rule-based summary when no API key
  is connected, so the tab always works.
- **AI Assistant** — a chat grounded in the currently loaded dataset. Answered by Claude
  when an API key is connected, otherwise by a deterministic automation-logic fallback.

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
  data/sample_finance_data.csv
```
