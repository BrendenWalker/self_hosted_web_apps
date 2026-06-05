const { runProjection } = require('./projectionRunner');

async function persistYearlyResults(client, scenarioId, byYear) {
  await client.query('DELETE FROM scenario_yearly_result WHERE scenario_id = $1', [scenarioId]);
  for (const row of byYear) {
    await client.query(
      `INSERT INTO scenario_yearly_result (scenario_id, year, result_row, computed_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [scenarioId, row.year, JSON.stringify(row)]
    );
  }
  await client.query(
    'UPDATE scenario SET last_computed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [scenarioId]
  );
}

async function runScenario(pool, scenarioId, query = {}) {
  const projection = await runProjection(pool, { ...query, scenario_id: scenarioId });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await persistYearlyResults(client, scenarioId, projection.by_year || []);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code !== '42P01') throw err;
  } finally {
    client.release();
  }
  return projection;
}

async function loadCachedYearlyResults(pool, scenarioId) {
  try {
    const res = await pool.query(
      `SELECT year, result_row FROM scenario_yearly_result
       WHERE scenario_id = $1 ORDER BY year`,
      [scenarioId]
    );
    if (!res.rows.length) return null;
    return res.rows.map((r) => r.result_row);
  } catch (err) {
    if (err.code === '42P01') return null;
    throw err;
  }
}

function summarizeScenarioProjection(projection) {
  const last = projection.by_year?.[projection.by_year.length - 1];
  const scores = projection.projection_meta?.planning_scores;
  return {
    scenario_id: projection.scenario?.id,
    scenario_name: projection.scenario?.name,
    p1_retirement_year: projection.projection_meta?.p1_retirement_year,
    p2_retirement_year: projection.projection_meta?.p2_retirement_year,
    p1_ss_claim_age: projection.projection_meta?.p1_ss_claim_age,
    p2_ss_claim_age: projection.projection_meta?.p2_ss_claim_age,
    withdrawal_strategy: projection.projection_meta?.withdrawal_strategy,
    roth_strategy: projection.projection_meta?.roth_conversion_strategy,
    lifetime_total_tax: scores?.lifetime_total_tax,
    ending_net_worth: last?.net_worth,
    peak_rmd: scores?.peak_rmd,
    peak_rmd_year: scores?.peak_rmd_year,
    year_reaches_target: projection.year_reaches_target,
    total_roth_conversions: Math.round(
      (projection.by_year || []).reduce((s, r) => s + (r.roth_conversion || 0), 0) * 100
    ) / 100,
  };
}

async function ensureScenarioComputed(pool, scenarioId, query = {}, { recompute = false } = {}) {
  if (!recompute) {
    const cached = await loadCachedYearlyResults(pool, scenarioId);
    if (cached?.length) {
      const meta = await pool.query('SELECT last_computed_at FROM scenario WHERE id = $1', [scenarioId]);
      return {
        by_year: cached,
        last_computed_at: meta.rows[0]?.last_computed_at,
        from_cache: true,
      };
    }
  }
  const projection = await runScenario(pool, scenarioId, query);
  return {
    ...projection,
    from_cache: false,
  };
}

module.exports = {
  runScenario,
  loadCachedYearlyResults,
  persistYearlyResults,
  summarizeScenarioProjection,
  ensureScenarioComputed,
};
