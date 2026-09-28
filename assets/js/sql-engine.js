// Thin wrapper around alasql so the SQL Explorer tab can query the loaded
// dataset in-browser (table name: finance) without any backend.
function runSql(query, rows) {
  alasql("DROP TABLE IF EXISTS finance");
  alasql("CREATE TABLE finance (month STRING, cost_center STRING, area STRING, actual_usd NUMBER, budget_usd NUMBER, inventory_units NUMBER, inventory_target_units NUMBER, productivity_index NUMBER, headcount NUMBER)");
  alasql.tables.finance.data = rows;
  const result = alasql(query);
  if (!Array.isArray(result)) return { columns: [], rows: [] };
  const columns = result.length ? Object.keys(result[0]) : [];
  return { columns, rows: result };
}

const SQL_EXAMPLES = {
  overspend: "SELECT cost_center, area, month, actual_usd - budget_usd AS variance_usd\nFROM finance\nWHERE actual_usd > budget_usd\nORDER BY variance_usd DESC\nLIMIT 5;",
  inventory: "SELECT cost_center, area, month, inventory_units, inventory_target_units,\n  ROUND((inventory_units - inventory_target_units) * 100.0 / inventory_target_units, 1) AS gap_pct\nFROM finance\nWHERE inventory_target_units > 0\nORDER BY gap_pct DESC;",
  productivity: "SELECT area, ROUND(AVG(productivity_index), 3) AS avg_productivity\nFROM finance\nGROUP BY area\nORDER BY avg_productivity DESC;"
};

const SQL_DEFAULT_QUERY = SQL_EXAMPLES.overspend;
