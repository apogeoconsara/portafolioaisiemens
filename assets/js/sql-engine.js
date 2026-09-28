// Thin wrapper around alasql so the SQL Explorer tab can query the loaded
// SAP-style extracts in-browser, with no backend. Four raw tables mirror the
// source systems, plus a "finance" table with the already-joined/enriched
// rows for convenience.
const TABLE_SCHEMAS = {
  fico_actuals: "bukrs STRING, kokrs STRING, gjahr NUMBER, poper NUMBER, kostl STRING, kstar STRING, kstar_name STRING, waers STRING, actual_amount NUMBER, plan_amount NUMBER",
  cost_center_master: "kokrs STRING, bukrs STRING, kostl STRING, kostl_name STRING, kostl_group STRING, werks STRING, status STRING",
  inventory_mm: "gjahr NUMBER, poper NUMBER, werks STRING, lgort STRING, matnr STRING, material_desc STRING, labst NUMBER, minbe NUMBER",
  ops_kpis: "gjahr NUMBER, poper NUMBER, kostl STRING, productivity_index NUMBER, headcount NUMBER",
  finance: "month STRING, kostl STRING, kostl_name STRING, area STRING, actual_usd NUMBER, budget_usd NUMBER, productivity_index NUMBER, headcount NUMBER, unmastered BOOLEAN, blocked BOOLEAN"
};

function loadTable(name, rows) {
  alasql(`DROP TABLE IF EXISTS ${name}`);
  alasql(`CREATE TABLE ${name} (${TABLE_SCHEMAS[name]})`);
  alasql.tables[name].data = rows;
}

function loadAllTables({ actuals, master, inventory, ops, finance }) {
  loadTable("fico_actuals", actuals);
  loadTable("cost_center_master", master);
  loadTable("inventory_mm", inventory);
  loadTable("ops_kpis", ops);
  loadTable("finance", finance);
}

function runSql(query) {
  const result = alasql(query);
  if (!Array.isArray(result)) return { columns: [], rows: [] };
  const columns = result.length ? Object.keys(result[0]) : [];
  return { columns, rows: result };
}

const SQL_EXAMPLES = {
  unmastered: "-- Postings to a cost center missing from master data (governance issue)\nSELECT a.kostl, a.gjahr, a.poper, a.actual_amount\nFROM fico_actuals a\nLEFT JOIN cost_center_master m ON a.kokrs = m.kokrs AND a.kostl = m.kostl\nWHERE m.kostl IS NULL;",
  blocked: "-- Postings made to a cost center that is BLOCKED in master data\nSELECT a.kostl, m.kostl_name, a.gjahr, a.poper, a.actual_amount\nFROM fico_actuals a\nJOIN cost_center_master m ON a.kokrs = m.kokrs AND a.kostl = m.kostl\nWHERE m.status = 'BLOCKED';",
  overspend: "SELECT a.kostl, m.kostl_name, a.gjahr, a.poper, a.actual_amount - a.plan_amount AS variance_usd\nFROM fico_actuals a\nJOIN cost_center_master m ON a.kokrs = m.kokrs AND a.kostl = m.kostl\nWHERE a.actual_amount > a.plan_amount\nORDER BY variance_usd DESC\nLIMIT 5;",
  productivity: "SELECT m.kostl_group, ROUND(AVG(o.productivity_index), 3) AS avg_productivity\nFROM ops_kpis o\nJOIN cost_center_master m ON o.kostl = m.kostl\nGROUP BY m.kostl_group\nORDER BY avg_productivity DESC;"
};

const SQL_DEFAULT_QUERY = SQL_EXAMPLES.unmastered;
