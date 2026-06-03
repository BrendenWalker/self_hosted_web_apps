const { yearFromDate } = require('../lib/dates');

async function loadScenario(pool, scenarioId) {
  try {
    let scenarioRes;
    if (scenarioId != null) {
      scenarioRes = await pool.query(
        `SELECT s.id, s.name, s.description, s.is_default, s.household_id,
                sa.retirement_age_p1, sa.retirement_age_p2,
                sa.social_security_claim_age_p1, sa.social_security_claim_age_p2,
                sa.annual_spending_target, sa.inflation_rate, sa.portfolio_return_rate,
                sa.withdrawal_strategy, sa.withdrawal_order_custom, sa.roth_conversion_strategy, sa.notes
         FROM scenario s
         LEFT JOIN scenario_assumption sa ON sa.scenario_id = s.id
         WHERE s.id = $1`,
        [scenarioId]
      );
    } else {
      scenarioRes = await pool.query(
        `SELECT s.id, s.name, s.description, s.is_default, s.household_id,
                sa.retirement_age_p1, sa.retirement_age_p2,
                sa.social_security_claim_age_p1, sa.social_security_claim_age_p2,
                sa.annual_spending_target, sa.inflation_rate, sa.portfolio_return_rate,
                sa.withdrawal_strategy, sa.withdrawal_order_custom, sa.roth_conversion_strategy, sa.notes
         FROM scenario s
         LEFT JOIN scenario_assumption sa ON sa.scenario_id = s.id
         WHERE s.is_default = TRUE
         ORDER BY s.id LIMIT 1`
      );
    }
    if (!scenarioRes.rows.length) return null;

    const row = scenarioRes.rows[0];
    let rothPlan = null;
    try {
      const rothRes = await pool.query(
        `SELECT * FROM roth_conversion_plan WHERE scenario_id = $1`,
        [row.id]
      );
      rothPlan = rothRes.rows[0] || null;
    } catch {
      rothPlan = null;
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      is_default: row.is_default,
      assumptions: {
        retirement_age_p1: row.retirement_age_p1,
        retirement_age_p2: row.retirement_age_p2,
        social_security_claim_age_p1: row.social_security_claim_age_p1,
        social_security_claim_age_p2: row.social_security_claim_age_p2,
        annual_spending_target: row.annual_spending_target != null ? parseFloat(row.annual_spending_target) : null,
        inflation_rate: row.inflation_rate != null ? parseFloat(row.inflation_rate) : null,
        portfolio_return_rate: row.portfolio_return_rate != null ? parseFloat(row.portfolio_return_rate) : null,
        withdrawal_strategy: row.withdrawal_strategy || 'conservative',
        withdrawal_order_custom: row.withdrawal_order_custom,
        roth_conversion_strategy: row.roth_conversion_strategy || 'none',
        notes: row.notes,
      },
      roth_plan: rothPlan,
    };
  } catch (err) {
    if (err.code === '42P01') return null;
    throw err;
  }
}

function overlayFromScenario(household, scenario) {
  const p1Birth = household?.p1_birth_year != null ? parseInt(household.p1_birth_year, 10) : null;
  const p2Birth = household?.p2_birth_year != null ? parseInt(household.p2_birth_year, 10) : null;
  const a = scenario?.assumptions;

  let p1RetirementYear = yearFromDate(household?.p1_retirement_date);
  let p2RetirementYear = yearFromDate(household?.p2_retirement_date);
  let p1SsClaimAge = p1RetirementYear != null && p1Birth != null ? Math.min(70, Math.max(62, p1RetirementYear - p1Birth)) : null;
  let p2SsClaimAge = p2RetirementYear != null && p2Birth != null ? Math.min(70, Math.max(62, p2RetirementYear - p2Birth)) : null;

  if (a) {
    if (a.retirement_age_p1 != null && p1Birth != null) p1RetirementYear = p1Birth + a.retirement_age_p1;
    if (a.retirement_age_p2 != null && p2Birth != null) p2RetirementYear = p2Birth + a.retirement_age_p2;
    if (a.social_security_claim_age_p1 != null) p1SsClaimAge = a.social_security_claim_age_p1;
    if (a.social_security_claim_age_p2 != null) p2SsClaimAge = a.social_security_claim_age_p2;
  }

  const p1SsStartYear = p1Birth != null && p1SsClaimAge != null ? p1Birth + p1SsClaimAge : null;
  const p2SsStartYear = p2Birth != null && p2SsClaimAge != null ? p2Birth + p2SsClaimAge : null;

  return {
    p1RetirementYear,
    p2RetirementYear,
    p1SsClaimAge,
    p2SsClaimAge,
    p1SsStartYear,
    p2SsStartYear,
    annualSpendingTarget: a?.annual_spending_target,
    withdrawalStrategy: a?.withdrawal_strategy || 'conservative',
    withdrawalOrderCustom: a?.withdrawal_order_custom,
    rothConversionStrategy: a?.roth_conversion_strategy || 'none',
    inflationRate: a?.inflation_rate,
    portfolioReturnRate: a?.portfolio_return_rate,
  };
}

module.exports = { loadScenario, overlayFromScenario };
