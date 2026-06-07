const { yearFromDate, ageAtEoy } = require('../lib/dates');
const { computeRmdForBalance, rmdStartAgeFromBirthYear } = require('../lib/rmd');
const {
  ssMonthlyAtClaimAge,
  ssFactorForAge,
  ssEarningsTestWarning,
} = require('../lib/socialSecurity');
const { loadScenario, overlayFromScenario } = require('./scenarioService');
const {
  classifyAccounts,
  totalPreTax,
  totalFinancial,
  balancesByBucketSnapshot,
  balancesBySavingsCategorySnapshot,
  syncBucketDetails,
  snapshotBucketAggregates,
  applyGrowthToBuckets,
  estimateTaxableDividendsAndGains,
} = require('./taxBuckets');
const { computeWithdrawals, liquidateAssetsForSpending } = require('./withdrawalEngine');
const { computeRothConversion, applyRothConversion } = require('./rothConversionEngine');
const { computeYearTax } = require('./yearTaxService');
const { computePlanningScores, computeSsComparison } = require('./planningInsights');
const taxParams = require('./taxParameters');

const {
  computeYearContributions,
  applyDirectedContributions,
  allocateSurplusAfterDirected,
  incomeSurplusToTaxableFlag,
  limitsToBase,
} = require('./contributionPlanner');

function tryParseFloat(v) {
  if (v == null || v === '') return null;
  const p = parseFloat(String(v).trim());
  return Number.isFinite(p) ? p : null;
}

function tryParseInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

async function runProjection(pool, query = {}) {
  const allowZeroRates = !!process.env.DEBUG;
  const savingsProjectionMode =
    query.savings_projection === '1' || String(query.savings_projection || '').toLowerCase() === 'true';
  const minGrowth = savingsProjectionMode || allowZeroRates ? 0 : 0.01;
  const minIndexPct = allowZeroRates ? 0 : 0.01;
  const startYear = new Date().getFullYear();
  const scenarioIdQ = tryParseInt(query.scenario_id);

  const [householdRes, incomeRes, balancesRes, summaryRes, scenario] = await Promise.all([
    pool.query(
      `SELECT p1_display_name, p2_display_name, p1_birth_year, p2_birth_year,
              p1_retirement_date, p2_retirement_date, p1_ss_at_fra, p2_ss_at_fra, filing_status,
              required_monthly_income_retirement,
              projection_horizon_years, projection_growth_pct,
              projection_expense_growth_pct, projection_ssi_growth_pct
       FROM household ORDER BY id LIMIT 1`
    ),
    pool.query('SELECT * FROM income ORDER BY as_of DESC, id DESC LIMIT 1'),
    pool.query(
      `SELECT DISTINCT ON (ab.account_id) ab.account_id, ab.balance, a.account_type, a.expected_depreciation_pct,
              a.liquidate_in_retirement,
              a.owner_type, a.rmd_owner_type
       FROM account_balance ab
       JOIN account a ON ab.account_id = a.id
       ORDER BY ab.account_id, ab.as_of DESC, ab.id DESC`
    ),
    pool.query(
      `SELECT el.current_monthly, el.retirement_monthly, ec.category_type
       FROM (SELECT DISTINCT ON (expense_category_id) expense_category_id, current_monthly, retirement_monthly
             FROM expense_line ORDER BY expense_category_id, as_of DESC, id DESC) el
       JOIN expense_category ec ON el.expense_category_id = ec.id`
    ),
    loadScenario(pool, scenarioIdQ),
  ]);

  let taxProfilesByAccountId = {};
  try {
    const tpRes = await pool.query(
      `SELECT account_id, cost_basis, unrealized_gain_percent, dividend_yield, qualified_dividend_percent
       FROM account_tax_profile`
    );
    for (const r of tpRes.rows) {
      taxProfilesByAccountId[r.account_id] = r;
    }
  } catch {
    taxProfilesByAccountId = {};
  }

  const household = householdRes.rows[0] || null;
  const income = incomeRes.rows[0] || null;
  const overlay = overlayFromScenario(household, scenario);

  const yearsQ = tryParseInt(query.years);
  const yearsDb = tryParseInt(household?.projection_horizon_years);
  let horizonYears = Number.isFinite(yearsQ) ? yearsQ : yearsDb;
  if (!Number.isFinite(horizonYears)) horizonYears = 30;
  horizonYears = Math.min(50, Math.max(5, horizonYears));

  const growthQ = tryParseFloat(query.growth_pct);
  let growthPct = Number.isFinite(growthQ) && growthQ >= minGrowth && growthQ <= 20 ? growthQ : null;
  if (savingsProjectionMode) {
    growthPct = 0;
  } else if (growthPct == null) {
    const fromScenario = overlay.portfolioReturnRate;
    if (fromScenario != null && fromScenario >= minGrowth) growthPct = fromScenario;
    else {
      const gDb = tryParseFloat(household?.projection_growth_pct);
      growthPct = Number.isFinite(gDb) && gDb >= minGrowth && gDb <= 20 ? gDb : 5;
    }
  }

  const expenseGQ = tryParseFloat(query.expense_growth_pct) ?? tryParseFloat(query.expense_cola_pct);
  let expenseGrowthPct =
    Number.isFinite(expenseGQ) && expenseGQ >= minIndexPct && expenseGQ <= 10 ? expenseGQ : null;
  if (expenseGrowthPct == null) {
    const fromScenario = overlay.inflationRate;
    if (fromScenario != null && fromScenario >= minIndexPct) expenseGrowthPct = fromScenario;
    else {
      const eDb = tryParseFloat(household?.projection_expense_growth_pct);
      expenseGrowthPct = Number.isFinite(eDb) && eDb >= minIndexPct && eDb <= 10 ? eDb : 2.5;
    }
  }

  const ssiGQ = tryParseFloat(query.ssi_growth_pct);
  let ssiGrowthPct = Number.isFinite(ssiGQ) && ssiGQ >= minIndexPct && ssiGQ <= 10 ? ssiGQ : null;
  if (ssiGrowthPct == null) {
    const sDb = tryParseFloat(household?.projection_ssi_growth_pct);
    ssiGrowthPct = Number.isFinite(sDb) && sDb >= minIndexPct && sDb <= 10 ? sDb : 2.5;
  }

  const expenseGrowthFactor = 1 + expenseGrowthPct / 100;
  const ssiGrowthFactor = 1 + ssiGrowthPct / 100;
  const filingStatus = household?.filing_status || 'married_filing_jointly';
  const p1BirthYear = household?.p1_birth_year != null ? parseInt(household.p1_birth_year, 10) : null;
  const p2BirthYear = household?.p2_birth_year != null ? parseInt(household.p2_birth_year, 10) : null;

  const raP1Q = tryParseInt(query.retirement_age_p1);
  const raP2Q = tryParseInt(query.retirement_age_p2);
  if (raP1Q != null && raP1Q >= 62 && raP1Q <= 100 && p1BirthYear != null) {
    overlay.p1RetirementYear = p1BirthYear + raP1Q;
  }
  if (raP2Q != null && raP2Q >= 62 && raP2Q <= 100 && p2BirthYear != null) {
    overlay.p2RetirementYear = p2BirthYear + raP2Q;
  }

  const p1RetirementYear = overlay.p1RetirementYear;
  const p2RetirementYear = overlay.p2RetirementYear;
  const retirementYear =
    p1RetirementYear != null || p2RetirementYear != null
      ? Math.max(p1RetirementYear ?? Number.NEGATIVE_INFINITY, p2RetirementYear ?? Number.NEGATIVE_INFINITY)
      : null;

  const p1AtFraRaw =
    household?.p1_ss_at_fra != null && household.p1_ss_at_fra !== '' ? parseFloat(household.p1_ss_at_fra) : null;
  const p2AtFraRaw =
    household?.p2_ss_at_fra != null && household.p2_ss_at_fra !== '' ? parseFloat(household.p2_ss_at_fra) : null;

  const p1SsMonthly =
    Number.isFinite(p1AtFraRaw) && overlay.p1SsClaimAge != null
      ? ssMonthlyAtClaimAge(p1AtFraRaw, overlay.p1SsClaimAge) ?? 0
      : 0;
  const grossP2 = income ? parseFloat(income.gross_salary_p2) || 0 : 0;
  const p2HasNoEarnings = grossP2 === 0 || income?.gross_salary_p2 == null || income.gross_salary_p2 === '';
  const p2UsesSpousal =
    p2HasNoEarnings &&
    !(Number.isFinite(p2AtFraRaw) && p2AtFraRaw > 0) &&
    Number.isFinite(p1AtFraRaw) &&
    p1AtFraRaw > 0 &&
    overlay.p2SsClaimAge != null;
  const p2SsMonthly = p2UsesSpousal
    ? Math.round(0.5 * p1AtFraRaw * ssFactorForAge(overlay.p2SsClaimAge) * 100) / 100
    : Number.isFinite(p2AtFraRaw) && overlay.p2SsClaimAge != null
      ? ssMonthlyAtClaimAge(p2AtFraRaw, overlay.p2SsClaimAge) ?? 0
      : 0;
  const p1SsAnnual = p1SsMonthly * 12;
  const p2SsAnnual = p2SsMonthly * 12;

  let currentAnnual = 0;
  let retirementAnnual = 0;
  const p2HealthUntilMedicareMonthly = [];
  for (const row of summaryRes.rows) {
    const catType = row.category_type || 'regular';
    if (catType === 'p2_health_until_medicare') {
      const retVal = row.retirement_monthly != null ? parseFloat(row.retirement_monthly) : null;
      if (retVal != null && retVal > 0) p2HealthUntilMedicareMonthly.push(retVal);
      continue;
    }
    currentAnnual += (parseFloat(row.current_monthly) || 0) * 12;
    const retVal = row.retirement_monthly != null ? parseFloat(row.retirement_monthly) : null;
    if (retVal !== 0) {
      const r = retVal != null ? retVal : parseFloat(row.current_monthly) || 0;
      retirementAnnual += r * 12;
    }
  }
  const mortgageResult = await pool.query('SELECT monthly_payment FROM mortgage LIMIT 1');
  const mortgageMonthly = mortgageResult.rows.length ? parseFloat(mortgageResult.rows[0].monthly_payment) || 0 : 0;
  currentAnnual += mortgageMonthly * 12;
  retirementAnnual += mortgageMonthly * 12;

  const rmiRaw = household?.required_monthly_income_retirement;
  const rmiMonthlyParsed =
    rmiRaw != null && rmiRaw !== '' && Number.isFinite(parseFloat(rmiRaw)) ? parseFloat(rmiRaw) : null;
  const rmiMonthly =
    rmiMonthlyParsed != null && rmiMonthlyParsed > 0 ? Math.round(rmiMonthlyParsed * 100) / 100 : null;

  const annualFromScenario = overlay.annualSpendingTarget;
  const useSpendingTarget =
    (annualFromScenario != null && annualFromScenario > 0) || (rmiMonthly != null && rmiMonthly > 0);
  const spendingAnnualBase =
    annualFromScenario != null && annualFromScenario > 0
      ? annualFromScenario
      : rmiMonthly != null
        ? rmiMonthly * 12
        : null;

  const target25xRetirement =
    spendingAnnualBase != null
      ? Math.round(spendingAnnualBase * 25 * 100) / 100
      : Math.round(retirementAnnual * 25 * 100) / 100;

  const buckets = classifyAccounts(balancesRes.rows, taxProfilesByAccountId);
  let tradP1 = buckets.preTaxP1;
  let tradP2 = buckets.preTaxP2;
  const assetParts = buckets.assets;

  const startingBalancesBySavingsCategory = balancesBySavingsCategorySnapshot(buckets);
  const startingFinancialBalance = Math.round(totalFinancial(buckets) * 100) / 100;

  let startingNetWorth = startingFinancialBalance + assetParts.reduce((s, a) => s + a.balance, 0);
  startingNetWorth = Math.round(startingNetWorth * 100) / 100;

  const grossP1 = income ? parseFloat(income.gross_salary) || 0 : 0;
  const grossP2Num = income ? parseFloat(income.gross_salary_p2) || 0 : 0;
  const primaryEarnerRetirementYear =
    grossP1 > 0 && grossP2Num === 0
      ? p1RetirementYear
      : grossP2Num > 0 && grossP1 === 0
        ? p2RetirementYear
        : grossP1 >= grossP2Num
          ? p1RetirementYear
          : p2RetirementYear;
  const expenseRetirementYear = primaryEarnerRetirementYear ?? p1RetirementYear ?? p2RetirementYear;
  const p2MedicareYear = p2BirthYear != null ? p2BirthYear + 65 : null;

  const raisePct = income && income.expected_raise_pct != null ? parseFloat(income.expected_raise_pct) / 100 : 0;
  const bonusQuarterlyP1 = income ? parseFloat(income.bonus_quarterly) || 0 : 0;
  const bonusQuarterlyP2 = income ? parseFloat(income.bonus_quarterly_p2) || 0 : 0;
  const fourOOneKPctP1 = income && income.four_o_one_k_pct != null ? parseFloat(income.four_o_one_k_pct) / 100 : 0;
  const fourOOneKPctP2 = income && income.four_o_one_k_pct_p2 != null ? parseFloat(income.four_o_one_k_pct_p2) / 100 : 0;
  const matchPctP1 = income && income.four_o_one_k_match_pct != null ? parseFloat(income.four_o_one_k_match_pct) / 100 : 0;
  const matchPctP2 = income && income.four_o_one_k_match_pct_p2 != null ? parseFloat(income.four_o_one_k_match_pct_p2) / 100 : 0;

  const endYear = startYear + horizonYears;
  const accumulationEndYear =
    retirementYear != null ? Math.max(startYear - 1, retirementYear - 1) : null;
  const loopEndYear =
    savingsProjectionMode && retirementYear != null
      ? Math.min(endYear, Math.max(startYear - 1, retirementYear - 1))
      : endYear;
  const byYear = [];
  const growthFactor = 1 + growthPct / 100;
  const rothPlan = scenario?.roth_plan;

  for (let y = startYear; y <= loopEndYear; y++) {
    const openingBalancesBySavingsCategory = balancesBySavingsCategorySnapshot(buckets);
    const p1Retired = p1RetirementYear != null && y >= p1RetirementYear;
    const p2Retired = p2RetirementYear != null && y >= p2RetirementYear;
    const isRetired = retirementYear != null && y >= retirementYear;
    const yearsFromStart = y - startYear;
    const raiseFactor = 1 + (yearsFromStart > 0 ? Math.pow(1 + raisePct, yearsFromStart) - 1 : 0);

    let salaryP1 = grossP1 * (y === startYear ? 1 : raiseFactor);
    let salaryP2 = grossP2Num * (y === startYear ? 1 : raiseFactor);
    const wageIncome = (p1Retired ? 0 : salaryP1) + (p2Retired ? 0 : salaryP2);
    const bonusActive = expenseRetirementYear == null || y < expenseRetirementYear;
    const bonusAnnualP1 =
      bonusActive && !p1Retired
        ? bonusQuarterlyP1 * 4 * (y === startYear ? 1 : raiseFactor)
        : 0;
    const bonusAnnualP2 =
      bonusActive && !p2Retired
        ? bonusQuarterlyP2 * 4 * (y === startYear ? 1 : raiseFactor)
        : 0;
    const bonusAnnual = bonusAnnualP1 + bonusAnnualP2;

    const p1SsActive = overlay.p1SsStartYear != null && y >= overlay.p1SsStartYear;
    const p2SsActive = overlay.p2SsStartYear != null && y >= overlay.p2SsStartYear;
    const ssColaYearsP1 = p1SsActive && overlay.p1SsStartYear != null ? Math.max(0, y - overlay.p1SsStartYear) : 0;
    const ssColaYearsP2 = p2SsActive && overlay.p2SsStartYear != null ? Math.max(0, y - overlay.p2SsStartYear) : 0;
    const annualSsP1 = p1SsActive ? p1SsAnnual * Math.pow(ssiGrowthFactor, ssColaYearsP1) : 0;
    const annualSsP2 = p2SsActive ? p2SsAnnual * Math.pow(ssiGrowthFactor, ssColaYearsP2) : 0;
    const totalSs = annualSsP1 + annualSsP2;

    const age1 = ageAtEoy(p1BirthYear, y);
    const age2 = ageAtEoy(p2BirthYear, y);
    const rmdStart1 = rmdStartAgeFromBirthYear(p1BirthYear);
    const rmdStart2 = rmdStartAgeFromBirthYear(p2BirthYear);

    let rmd1 = 0;
    let rmd2 = 0;
    let rmdDivisor1 = null;
    let rmdDivisor2 = null;
    if (age1 != null && rmdStart1 != null && age1 >= rmdStart1 && tradP1 > 0) {
      const r = computeRmdForBalance(tradP1, age1);
      rmd1 = r.rmd;
      rmdDivisor1 = r.divisor;
    }
    if (age2 != null && rmdStart2 != null && age2 >= rmdStart2 && tradP2 > 0) {
      const r = computeRmdForBalance(tradP2, age2);
      rmd2 = r.rmd;
      rmdDivisor2 = r.divisor;
    }
    if (rmd1 > 0 || rmd2 > 0) {
      const prevAgg = snapshotBucketAggregates(buckets, tradP1, tradP2);
      tradP1 = Math.max(0, tradP1 - rmd1);
      tradP2 = Math.max(0, tradP2 - rmd2);
      syncBucketDetails(buckets, prevAgg, snapshotBucketAggregates(buckets, tradP1, tradP2));
    }
    const rmdTotal = Math.round((rmd1 + rmd2) * 100) / 100;

    const expensesUseRetirement = expenseRetirementYear != null && y >= expenseRetirementYear;
    const inP2HealthBridge =
      p1RetirementYear != null && p2MedicareYear != null && y >= p1RetirementYear && y < p2MedicareYear;

    let expensesAmount;
    let withdrawals = {
      cashWithdrawals: 0,
      taxableWithdrawals: 0,
      preTaxWithdrawals: 0,
      rothWithdrawals: 0,
      hsaWithdrawals: 0,
      assetLiquidations: 0,
      unmetSpending: 0,
    };
    let rothConversion = 0;

    const workingBuckets = {
      preTaxP1: tradP1,
      preTaxP2: tradP2,
      roth: buckets.roth,
      taxable: buckets.taxable,
      cash: buckets.cash,
      hsa: buckets.hsa,
      taxableProfiles: buckets.taxableProfiles,
    };

    if (useSpendingTarget && spendingAnnualBase != null && expensesUseRetirement && expenseRetirementYear != null) {
      const expenseGrowthYears = y - expenseRetirementYear;
      let baseNeed = spendingAnnualBase * Math.pow(expenseGrowthFactor, Math.max(0, expenseGrowthYears));
      if (inP2HealthBridge && p2HealthUntilMedicareMonthly.length > 0) {
        const bridgeColaYears = y - p1RetirementYear;
        let bridgeAnnual = 0;
        for (const monthly of p2HealthUntilMedicareMonthly) {
          bridgeAnnual += monthly * 12 * Math.pow(expenseGrowthFactor, Math.max(0, bridgeColaYears));
        }
        baseNeed += bridgeAnnual;
      }
      expensesAmount = Math.round(baseNeed * 100) / 100;
    } else {
      const expenseBase = expensesUseRetirement ? retirementAnnual : currentAnnual;
      const expenseGrowthYears =
        expensesUseRetirement && expenseRetirementYear != null ? y - expenseRetirementYear : y - startYear;
      expensesAmount = Math.round(
        expenseBase * Math.pow(expenseGrowthFactor, Math.max(0, expenseGrowthYears)) * 100
      ) / 100;
      if (inP2HealthBridge && p2HealthUntilMedicareMonthly.length > 0) {
        const bridgeColaYears = y - p1RetirementYear;
        let bridgeAnnual = 0;
        for (const monthly of p2HealthUntilMedicareMonthly) {
          bridgeAnnual += monthly * 12 * Math.pow(expenseGrowthFactor, Math.max(0, bridgeColaYears));
        }
        expensesAmount = Math.round((expensesAmount + bridgeAnnual) * 100) / 100;
      }
    }

    const spendingGap = Math.max(0, expensesAmount - totalSs - rmdTotal - wageIncome - bonusAnnual);
    if (spendingGap > 0) {
      const prevAgg = snapshotBucketAggregates(buckets, tradP1, tradP2);
      withdrawals = {
        assetLiquidations: 0,
        ...computeWithdrawals(
          spendingGap,
          workingBuckets,
          overlay.withdrawalStrategy,
          overlay.withdrawalOrderCustom
        ),
      };
      tradP1 = workingBuckets.preTaxP1;
      tradP2 = workingBuckets.preTaxP2;
      buckets.roth = workingBuckets.roth;
      buckets.taxable = workingBuckets.taxable;
      buckets.cash = workingBuckets.cash;
      buckets.hsa = workingBuckets.hsa;
      syncBucketDetails(buckets, prevAgg, snapshotBucketAggregates(buckets, tradP1, tradP2));
    }
    const inRetirementPhase = p1Retired || p2Retired;
    if (inRetirementPhase && withdrawals.unmetSpending > 0) {
      const liq = liquidateAssetsForSpending(assetParts, withdrawals.unmetSpending);
      withdrawals.assetLiquidations = liq.assetLiquidations;
      withdrawals.unmetSpending = liq.unmetSpending;
    }

    const baseOrdinary = wageIncome + bonusAnnual + rmdTotal;
    rothConversion = await computeRothConversion(pool, {
      plan: rothPlan,
      year: y,
      tradBalance: tradP1 + tradP2,
      baseOrdinaryIncome: baseOrdinary,
      filingStatus,
      age1,
      age2,
    });
    if (rothConversion > 0) {
      const prevAgg = snapshotBucketAggregates(buckets, tradP1, tradP2);
      const wb = { preTaxP1: tradP1, preTaxP2: tradP2, roth: buckets.roth };
      applyRothConversion(wb, rothConversion);
      tradP1 = wb.preTaxP1;
      tradP2 = wb.preTaxP2;
      buckets.roth = wb.roth;
      syncBucketDetails(buckets, prevAgg, snapshotBucketAggregates(buckets, tradP1, tradP2));
    }

    const { qualifiedDividends, longTermCapGains } = estimateTaxableDividendsAndGains(
      buckets,
      withdrawals.taxableWithdrawals
    );

    const [taxResult, taxParamProvenance, medicarePartB] = await Promise.all([
      computeYearTax(pool, {
      wages: wageIncome,
      bonus: bonusAnnual,
      rmd: rmdTotal,
      rothConversion,
      preTaxWithdrawals: withdrawals.preTaxWithdrawals,
      rothWithdrawals: withdrawals.rothWithdrawals,
      cashWithdrawals: withdrawals.cashWithdrawals,
      taxableWithdrawals: withdrawals.taxableWithdrawals,
      longTermCapGains,
      qualifiedDividends,
      ssAnnual: totalSs,
      filingStatus,
      year: y,
      age1,
      age2,
      }),
      taxParams.getTaxParamProvenance(pool, y, filingStatus, age1, age2),
      taxParams.getMedicarePartB(pool, y),
    ]);

    const totalSavingsDraw =
      withdrawals.cashWithdrawals +
      withdrawals.taxableWithdrawals +
      withdrawals.preTaxWithdrawals +
      withdrawals.rothWithdrawals +
      withdrawals.hsaWithdrawals +
      (withdrawals.assetLiquidations ?? 0);

    const incomeAmount =
      withdrawals.unmetSpending === 0 && spendingGap > 0
        ? Math.round(expensesAmount * 100) / 100
        : Math.round(
            (wageIncome + bonusAnnual + totalSs + rmdTotal + totalSavingsDraw) * 100
          ) / 100;
    const savingsAmount = Math.round((incomeAmount - expensesAmount) * 100) / 100;

    let contributions401k = 0;
    let contributionsIraTraditional = 0;
    let contributionsIraRoth = 0;
    let contributionsHsa = 0;
    let contributionsTaxable = 0;
    let surplusToTaxableP1 = 0;
    let surplusToTaxableP2 = 0;
    let surplusToTaxableTotal = 0;
    let discretionarySpentP1 = 0;
    let discretionarySpentP2 = 0;
    let discretionarySpentTotal = 0;
    let growthSavingsAmount = savingsAmount;

    if (!p1Retired || !p2Retired) {
      const limits = await taxParams.getContributionLimits(pool, y);
      const limitsBase = limitsToBase(limits);
      const yearRaiseFactor = y === startYear ? 1 : raiseFactor;
      const directed = computeYearContributions({
        income,
        limitsBase,
        p1BirthYear,
        p2BirthYear,
        year: y,
        p1Retired,
        p2Retired,
        bonusActive,
        raiseFactor: yearRaiseFactor,
        salaryP1,
        salaryP2,
        fourOOneKPctP1,
        fourOOneKPctP2,
        matchPctP1,
        matchPctP2,
      });
      contributions401k = directed.total401k;
      contributionsIraTraditional = directed.totalIraTraditional;
      contributionsIraRoth = directed.totalIraRoth;
      contributionsHsa = directed.totalHsa;
      contributionsTaxable = directed.totalTaxable;
      growthSavingsAmount = Math.round((savingsAmount - directed.total) * 100) / 100;
      const applied = applyDirectedContributions(buckets, tradP1, tradP2, directed);
      tradP1 = applied.tradP1;
      tradP2 = applied.tradP2;
    }

    const p1Earned = (p1Retired ? 0 : salaryP1) + bonusAnnualP1;
    const p2Earned = (p2Retired ? 0 : salaryP2) + bonusAnnualP2;
    const surplusAlloc = allocateSurplusAfterDirected({
      surplusAfterDirected: growthSavingsAmount,
      p1Earned,
      p2Earned,
      surplusToTaxableP1: incomeSurplusToTaxableFlag(income, 'surplus_to_taxable_p1'),
      surplusToTaxableP2: incomeSurplusToTaxableFlag(income, 'surplus_to_taxable_p2'),
    });
    growthSavingsAmount = surplusAlloc.growthSavingsAmount;
    surplusToTaxableP1 = surplusAlloc.surplusTaxableP1;
    surplusToTaxableP2 = surplusAlloc.surplusTaxableP2;
    surplusToTaxableTotal = surplusAlloc.surplusTaxableTotal;
    discretionarySpentP1 = surplusAlloc.discretionarySpentP1;
    discretionarySpentP2 = surplusAlloc.discretionarySpentP2;
    discretionarySpentTotal = surplusAlloc.discretionarySpentTotal;
    if (surplusToTaxableTotal > 0) {
      buckets.taxable += surplusToTaxableTotal;
    }

    const savingsAddedTotal = Math.round(
      (contributions401k +
        contributionsIraTraditional +
        contributionsIraRoth +
        contributionsHsa +
        contributionsTaxable +
        surplusToTaxableTotal) *
        100
    ) / 100;

    const effectiveGrowthFactor = savingsProjectionMode ? 1 : growthFactor;
    const grown = applyGrowthToBuckets(
      buckets,
      effectiveGrowthFactor,
      growthSavingsAmount,
      tradP1,
      tradP2
    );
    const prevAgg = snapshotBucketAggregates(buckets, tradP1, tradP2);
    tradP1 = grown.preTaxP1;
    tradP2 = grown.preTaxP2;
    buckets.roth = grown.roth;
    buckets.taxable = grown.taxable;
    buckets.cash = grown.cash;
    buckets.hsa = grown.hsa;
    syncBucketDetails(buckets, prevAgg, snapshotBucketAggregates(buckets, tradP1, tradP2));
    buckets.preTaxP1 = tradP1;
    buckets.preTaxP2 = tradP2;

    for (const ap of assetParts) {
      ap.balance *= ap.depFactor;
    }
    const hardAssetBalance = Math.round(assetParts.reduce((s, a) => s + a.balance, 0) * 100) / 100;
    const financialBalance = Math.round(totalFinancial(buckets) * 100) / 100;
    const netWorth = Math.round((financialBalance + hardAssetBalance) * 100) / 100;

    const taxableIncomeEstimate = Math.round(
      (wageIncome +
        bonusAnnual +
        rmdTotal +
        rothConversion +
        taxResult.taxableSs +
        withdrawals.preTaxWithdrawals +
        withdrawals.cashWithdrawals +
        withdrawals.taxableWithdrawals +
        qualifiedDividends) *
        100
    ) / 100;

    byYear.push({
      year: y,
      net_worth: netWorth,
      financial_balance: financialBalance,
      hard_asset_balance: hardAssetBalance,
      balances_by_bucket: balancesByBucketSnapshot(buckets),
      balances_by_savings_category: balancesBySavingsCategorySnapshot(buckets),
      opening_balances_by_savings_category: openingBalancesBySavingsCategory,
      savings_added_total: savingsAddedTotal,
      income: incomeAmount,
      expenses: expensesAmount,
      savings: savingsAmount,
      income_wages: Math.round(wageIncome * 100) / 100,
      income_wage_p1: Math.round((p1Retired ? 0 : salaryP1) * 100) / 100,
      income_wage_p2: Math.round((p2Retired ? 0 : salaryP2) * 100) / 100,
      income_bonus: Math.round(bonusAnnual * 100) / 100,
      income_bonus_p1: Math.round(bonusAnnualP1 * 100) / 100,
      income_bonus_p2: Math.round(bonusAnnualP2 * 100) / 100,
      income_ss_total: Math.round(totalSs * 100) / 100,
      income_ss_p1: Math.round(annualSsP1 * 100) / 100,
      income_ss_p2: Math.round(annualSsP2 * 100) / 100,
      taxable_ss_estimate: taxResult.taxableSs,
      taxable_income_estimate: taxableIncomeEstimate,
      taxable_income_before_deduction: taxableIncomeEstimate,
      taxable_ss_plus_rmd: Math.round((taxResult.taxableSs + rmdTotal + withdrawals.preTaxWithdrawals) * 100) / 100,
      standard_deduction_estimate: taxResult.standardDeduction,
      medicare_part_b_monthly_estimate: medicarePartB,
      tax_param_provenance: taxParamProvenance,
      taxable_income_after_standard_deduction: taxResult.taxableIncomeAfterDeduction,
      federal_tax_ordinary_estimate: taxResult.ordinaryTax,
      federal_tax_capital_gains_estimate: taxResult.capitalGainsTax,
      federal_tax_total: taxResult.totalTax,
      federal_tax_brackets: taxResult.federal_tax_brackets,
      federal_effective_rate_pct: taxResult.effectiveRate,
      marginal_rate_pct: Math.round(taxResult.marginalRate * 10000) / 100,
      irmaa_warning: taxResult.irmaaWarning,
      rmd: rmdTotal,
      rmd_p1: Math.round(rmd1 * 100) / 100,
      rmd_p2: Math.round(rmd2 * 100) / 100,
      rmd_divisor_p1: rmdDivisor1,
      rmd_divisor_p2: rmdDivisor2,
      rmd_tax_estimate: Math.round(rmdTotal * (taxResult.marginalRate || 0.22) * 100) / 100,
      roth_conversion: rothConversion,
      withdrawals,
      spending_sources: {
        social_security: Math.round(totalSs * 100) / 100,
        taxable: withdrawals.taxableWithdrawals,
        traditional_ira: withdrawals.preTaxWithdrawals + rmdTotal,
        roth: withdrawals.rothWithdrawals,
        hsa: withdrawals.hsaWithdrawals,
        cash: withdrawals.cashWithdrawals,
        asset_liquidation: withdrawals.assetLiquidations ?? 0,
      },
      contributions_401k: Math.round(contributions401k * 100) / 100,
      contributions_ira_traditional: Math.round(contributionsIraTraditional * 100) / 100,
      contributions_ira_roth: Math.round(contributionsIraRoth * 100) / 100,
      contributions_hsa: Math.round(contributionsHsa * 100) / 100,
      contributions_taxable: Math.round(contributionsTaxable * 100) / 100,
      surplus_to_taxable_p1: Math.round(surplusToTaxableP1 * 100) / 100,
      surplus_to_taxable_p2: Math.round(surplusToTaxableP2 * 100) / 100,
      surplus_to_taxable: Math.round(surplusToTaxableTotal * 100) / 100,
      discretionary_spending_p1: Math.round(discretionarySpentP1 * 100) / 100,
      discretionary_spending_p2: Math.round(discretionarySpentP2 * 100) / 100,
      discretionary_spending: Math.round(discretionarySpentTotal * 100) / 100,
      is_retired: isRetired,
      p1_retired: p1Retired,
      p2_retired: p2Retired,
      p1_age_eoy: age1,
      p2_age_eoy: age2,
      income_from_savings_draw: Math.round(totalSavingsDraw * 100) / 100,
      retirement_funding_shortfall: withdrawals.unmetSpending,
      ss_earnings_test_warning_p1: ssEarningsTestWarning(overlay.p1SsClaimAge, p1Retired ? 0 : salaryP1),
      ss_earnings_test_warning_p2: ssEarningsTestWarning(overlay.p2SsClaimAge, p2Retired ? 0 : salaryP2),
    });
  }

  let year_reaches_target = null;
  for (const row of byYear) {
    if (row.net_worth >= target25xRetirement) {
      year_reaches_target = row.year;
      break;
    }
  }

  let cumulativeRmd = 0;
  for (const row of byYear) cumulativeRmd += row.rmd ?? 0;

  const planningScores = computePlanningScores({ byYear, startingBuckets: balancesByBucketSnapshot(buckets) });
  const ssComparison = computeSsComparison(
    p1AtFraRaw,
    p2AtFraRaw,
    overlay.p1SsClaimAge,
    overlay.p2SsClaimAge,
    p1BirthYear,
    p2BirthYear,
    ssiGrowthFactor
  );

  return {
    start_year: startYear,
    end_year: savingsProjectionMode && accumulationEndYear != null ? loopEndYear : endYear,
    projection_horizon_years: horizonYears,
    growth_pct: growthPct,
    expense_growth_pct: expenseGrowthPct,
    ssi_growth_pct: ssiGrowthPct,
    savings_projection_mode: savingsProjectionMode,
    accumulation_end_year: savingsProjectionMode ? accumulationEndYear : null,
    starting_balances_by_savings_category: startingBalancesBySavingsCategory,
    starting_financial_balance: startingFinancialBalance,
    target_25x_retirement: target25xRetirement,
    retirement_year: retirementYear,
    starting_net_worth: startingNetWorth,
    current_annual: Math.round(currentAnnual * 100) / 100,
    retirement_annual: Math.round(retirementAnnual * 100) / 100,
    required_monthly_income_retirement: rmiMonthly,
    annual_spending_target: spendingAnnualBase,
    by_year: byYear,
    year_reaches_target,
    scenario: scenario
      ? { id: scenario.id, name: scenario.name, is_default: scenario.is_default }
      : null,
    household: household
      ? {
          p1_display_name: household.p1_display_name || 'P1',
          p2_display_name: household.p2_display_name || 'P2',
          filing_status: household.filing_status || 'married_filing_jointly',
          required_monthly_income_retirement: rmiMonthly,
        }
      : null,
    projection_meta: {
      p1_retirement_year: p1RetirementYear,
      p2_retirement_year: p2RetirementYear,
      p1_ss_start_year: overlay.p1SsStartYear,
      p2_ss_start_year: overlay.p2SsStartYear,
      p1_ss_claim_age: overlay.p1SsClaimAge,
      p2_ss_claim_age: overlay.p2SsClaimAge,
      p1_ss_monthly_used: p1SsMonthly,
      p2_ss_monthly_used: p2SsMonthly,
      p2_uses_spousal: p2UsesSpousal,
      expense_retirement_year: expenseRetirementYear,
      p1_rmd_start_age: rmdStartAgeFromBirthYear(p1BirthYear),
      p2_rmd_start_age: rmdStartAgeFromBirthYear(p2BirthYear),
      lifetime_rmd_total: Math.round(cumulativeRmd * 100) / 100,
      peak_rmd: planningScores.peak_rmd,
      peak_rmd_year: planningScores.peak_rmd_year,
      withdrawal_strategy: overlay.withdrawalStrategy,
      roth_conversion_strategy: overlay.rothConversionStrategy,
      use_required_monthly_income: useSpendingTarget && spendingAnnualBase != null,
      use_retirement_spending: useSpendingTarget && spendingAnnualBase != null,
      retirement_spending_annual_base: spendingAnnualBase,
      retirement_spending_expense_growth_pct: expenseGrowthPct,
      retirement_spending_note:
        spendingAnnualBase != null && expenseRetirementYear != null
          ? `Retirement spending starts at $${Math.round(spendingAnnualBase).toLocaleString('en-US')}/yr in ${expenseRetirementYear} and increases ${expenseGrowthPct}% per year (P2 pre-Medicare bridge added when applicable).`
          : null,
      ss_comparison: ssComparison,
      planning_scores: planningScores,
      rmd_note:
        'RMD from traditional IRA and traditional 401(k) balances using IRS Uniform Lifetime Table (2022+).',
      taxable_income_note:
        'Includes wages, RMD, Roth conversions, bucket withdrawals, estimated taxable SS, and qualified dividends. LTCG taxed separately.',
      tax_model_note:
        'Excludes NIIT, AMT, state/local tax, credits, and payroll taxes. IRMAA warning is approximate.',
      savings_projection_note: savingsProjectionMode
        ? 'Account balances reflect current Accounts plus annual savings only. Investment growth is not applied.'
        : null,
    },
  };
}

module.exports = { runProjection };
