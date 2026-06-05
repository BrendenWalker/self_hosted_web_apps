const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { parse: parseCsv } = require('csv-parse/sync');
const { createDbPool, testConnection } = require('../../common/database/db-config');
const { runProjection } = require('./services/projectionRunner');
const { runScenario, summarizeScenarioProjection, ensureScenarioComputed } = require('./services/scenarioEngine');
const { explainScenarioComparison } = require('./services/scenarioExplanationService');
const { captureHouseholdSnapshot, loadScenario } = require('./services/scenarioService');
const taxParams = require('./services/taxParameters');
const { federalOrdinaryTaxWithBreakdown } = require('./services/yearTaxService');
const seeds = require('./services/taxParametersSeeds');
require('dotenv').config();

function contributionLimitsToBase(limits) {
  return {
    ira: limits.ira?.base ?? 0,
    ira_catch_up: limits.ira?.catch_up ?? 0,
    hsa_individual: limits.hsa_individual?.base ?? 0,
    hsa_family: limits.hsa_family?.base ?? 0,
    hsa_catch_up: limits.hsa_individual?.catch_up ?? 0,
    '401k_elective': limits['401k_elective']?.base ?? 0,
    '401k_catch_up': limits['401k_elective']?.catch_up ?? 0,
  };
}

const app = express();
const port = process.env.PORT || 80;

let isReady = false;

// Behind Docker/reverse proxy (X-Forwarded-For); required by express-rate-limit.
if (process.env.TRUST_PROXY !== 'false') {
  app.set('trust proxy', 1);
}

app.use(cors());
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const pool = createDbPool({
  database: process.env.DB_NAME || 'retirementhub',
});

testConnection(pool);

/** Whole-number id only (rejects dollar amounts like 3230.69 in URL/body). */
function parsePositiveIntParam(raw) {
  const s = raw != null ? String(raw).trim() : '';
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function describeValue(value) {
  if (value === null) return { value: null, type: 'null' };
  if (value === undefined) return { value: undefined, type: 'undefined' };
  return { value, type: typeof value, string: String(value) };
}

function balanceRequestDebug(req, extra) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  return {
    method: req.method,
    path: req.originalUrl || req.url,
    params: req.params,
    body,
    bodyFields: Object.fromEntries(
      Object.keys(body).map((key) => [key, describeValue(body[key])])
    ),
    ...extra,
  };
}

function postgresErrorDebug(error) {
  if (!error) return null;
  return {
    code: error.code,
    message: error.message,
    detail: error.detail,
    column: error.column,
    table: error.table,
    schema: error.schema,
    constraint: error.constraint,
    where: error.where,
  };
}

function balanceApiError(res, req, operation, context, error, statusCode) {
  const postgres = postgresErrorDebug(error);
  let message =
    (error && error.message) ||
    context.fallback ||
    'Account balance request failed';
  if (error && error.code === '22P02') {
    const col = postgres?.column ? ` (column: ${postgres.column})` : '';
    message = `PostgreSQL rejected a value for an integer field${col}: ${error.message}`;
  }
  const payload = {
    error: message,
    operation,
    debug: balanceRequestDebug(req, context),
    postgres,
  };
  console.error(`[account-balance] ${operation}`, JSON.stringify(payload, null, 2));
  res.status(statusCode || (error && error.code === '22P02' ? 400 : 500)).json(payload);
}

function balanceValidationError(res, req, operation, message, context) {
  const payload = {
    error: message,
    operation,
    debug: balanceRequestDebug(req, context),
  };
  console.warn(`[account-balance] ${operation} validation`, JSON.stringify(payload, null, 2));
  res.status(400).json(payload);
}

function dbErrorResponse(res, error, fallback) {
  if (error && error.code === '22P02') {
    return res.status(400).json({
      error: `PostgreSQL rejected a value for an integer field: ${error.message}`,
      postgres: postgresErrorDebug(error),
    });
  }
  return res.status(500).json({ error: (error && error.message) || fallback });
}

let accountBalanceColumnTypes = null;
async function loadAccountBalanceColumnTypes() {
  try {
    const result = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'account_balance'
         AND column_name IN ('balance', 'account_id')`
    );
    accountBalanceColumnTypes = {};
    result.rows.forEach((r) => {
      accountBalanceColumnTypes[r.column_name] = r.data_type;
    });
  } catch (e) {
    console.warn('Could not read account_balance column types:', e.message);
  }
}
loadAccountBalanceColumnTypes();

// ==================== HOUSEHOLD ====================

app.get('/api/household', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM household ORDER BY id LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Household not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching household:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Tables do not exist. Run database/schema.sql on your retirementhub database.' });
    }
    res.status(500).json({ error: error.message || 'Failed to fetch household' });
  }
});

app.put('/api/household', async (req, res) => {
  try {
    const {
      p1_display_name,
      p2_display_name,
      p1_birth_year,
      p2_birth_year,
      p1_retirement_date,
      p2_retirement_date,
      p1_ss_monthly_estimate,
      p2_ss_monthly_estimate,
      p1_ss_at_fra,
      p2_ss_at_fra,
      filing_status,
      required_monthly_income_retirement,
      projection_horizon_years,
      projection_growth_pct,
      projection_expense_growth_pct,
      projection_ssi_growth_pct,
    } = req.body;
    const shouldSetRmi = Object.prototype.hasOwnProperty.call(req.body, 'required_monthly_income_retirement');
    const rmiStored = shouldSetRmi
      ? required_monthly_income_retirement != null && required_monthly_income_retirement !== ''
        ? parseFloat(required_monthly_income_retirement)
        : null
      : null;
    const shouldSetP1Ret = Object.prototype.hasOwnProperty.call(req.body, 'p1_retirement_date');
    const shouldSetP2Ret = Object.prototype.hasOwnProperty.call(req.body, 'p2_retirement_date');
    const shouldSetP1SsEst = Object.prototype.hasOwnProperty.call(req.body, 'p1_ss_monthly_estimate');
    const shouldSetP2SsEst = Object.prototype.hasOwnProperty.call(req.body, 'p2_ss_monthly_estimate');
    const shouldSetP1SsFra = Object.prototype.hasOwnProperty.call(req.body, 'p1_ss_at_fra');
    const shouldSetP2SsFra = Object.prototype.hasOwnProperty.call(req.body, 'p2_ss_at_fra');
    const shouldSetProjYears = Object.prototype.hasOwnProperty.call(req.body, 'projection_horizon_years');
    const shouldSetProjGrowth = Object.prototype.hasOwnProperty.call(req.body, 'projection_growth_pct');
    const shouldSetProjExpenseGrowth = Object.prototype.hasOwnProperty.call(req.body, 'projection_expense_growth_pct');
    const shouldSetProjSsiGrowth = Object.prototype.hasOwnProperty.call(req.body, 'projection_ssi_growth_pct');
    const clamp = (n, lo, hi, fallback) => {
      if (!Number.isFinite(n)) return fallback;
      return Math.min(hi, Math.max(lo, n));
    };
    const projYearsStored = shouldSetProjYears
      ? clamp(parseInt(projection_horizon_years, 10), 5, 50, 30)
      : null;
    const projGrowthStored = shouldSetProjGrowth
      ? clamp(parseFloat(projection_growth_pct), 0.01, 20, 5)
      : null;
    const projExpenseGrowthStored = shouldSetProjExpenseGrowth
      ? clamp(parseFloat(projection_expense_growth_pct), 0.01, 10, 2.5)
      : null;
    const projSsiGrowthStored = shouldSetProjSsiGrowth
      ? clamp(parseFloat(projection_ssi_growth_pct), 0.01, 10, 2.5)
      : null;
    const result = await pool.query(
      `UPDATE household SET
        p1_display_name = COALESCE($1, p1_display_name),
        p2_display_name = COALESCE($2, p2_display_name),
        p1_birth_year = COALESCE($3, p1_birth_year),
        p2_birth_year = COALESCE($4, p2_birth_year),
        p1_retirement_date = CASE WHEN $14::boolean THEN $5 ELSE p1_retirement_date END,
        p2_retirement_date = CASE WHEN $15::boolean THEN $6 ELSE p2_retirement_date END,
        p1_ss_monthly_estimate = CASE WHEN $16::boolean THEN $7 ELSE p1_ss_monthly_estimate END,
        p2_ss_monthly_estimate = CASE WHEN $17::boolean THEN $8 ELSE p2_ss_monthly_estimate END,
        p1_ss_at_fra = CASE WHEN $18::boolean THEN $9 ELSE p1_ss_at_fra END,
        p2_ss_at_fra = CASE WHEN $19::boolean THEN $10 ELSE p2_ss_at_fra END,
        filing_status = COALESCE($11, filing_status),
        required_monthly_income_retirement = CASE WHEN $13::boolean THEN $12 ELSE required_monthly_income_retirement END,
        projection_horizon_years = CASE WHEN $20::boolean THEN $21 ELSE projection_horizon_years END,
        projection_growth_pct = CASE WHEN $22::boolean THEN $23 ELSE projection_growth_pct END,
        projection_expense_growth_pct = CASE WHEN $24::boolean THEN $25 ELSE projection_expense_growth_pct END,
        projection_ssi_growth_pct = CASE WHEN $26::boolean THEN $27 ELSE projection_ssi_growth_pct END,
        modified = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM household LIMIT 1)
       RETURNING *`,
      [
        p1_display_name != null ? String(p1_display_name).trim() : null,
        p2_display_name != null ? String(p2_display_name).trim() : null,
        p1_birth_year != null ? parseInt(p1_birth_year, 10) : null,
        p2_birth_year != null ? parseInt(p2_birth_year, 10) : null,
        p1_retirement_date && String(p1_retirement_date).trim() ? String(p1_retirement_date).trim().slice(0, 10) : null,
        p2_retirement_date && String(p2_retirement_date).trim() ? String(p2_retirement_date).trim().slice(0, 10) : null,
        p1_ss_monthly_estimate != null && p1_ss_monthly_estimate !== '' ? parseFloat(p1_ss_monthly_estimate) : null,
        p2_ss_monthly_estimate != null && p2_ss_monthly_estimate !== '' ? parseFloat(p2_ss_monthly_estimate) : null,
        p1_ss_at_fra != null && p1_ss_at_fra !== '' ? parseFloat(p1_ss_at_fra) : null,
        p2_ss_at_fra != null && p2_ss_at_fra !== '' ? parseFloat(p2_ss_at_fra) : null,
        filing_status != null ? String(filing_status).trim() : null,
        rmiStored,
        shouldSetRmi,
        shouldSetP1Ret,
        shouldSetP2Ret,
        shouldSetP1SsEst,
        shouldSetP2SsEst,
        shouldSetP1SsFra,
        shouldSetP2SsFra,
        shouldSetProjYears,
        projYearsStored,
        shouldSetProjGrowth,
        projGrowthStored,
        shouldSetProjExpenseGrowth,
        projExpenseGrowthStored,
        shouldSetProjSsiGrowth,
        projSsiGrowthStored,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Household not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating household:', error);
    res.status(500).json({ error: error.message || 'Failed to update household' });
  }
});

// ==================== INCOME ====================
// Returns row with latest as_of; multiple rows allowed for history.

app.get('/api/income', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM income ORDER BY as_of DESC, id DESC LIMIT 1'
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching income:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Tables do not exist. Run database/schema.sql on your retirementhub database.' });
    }
    res.status(500).json({ error: error.message || 'Failed to fetch income' });
  }
});

app.put('/api/income', async (req, res) => {
  try {
    const { id, as_of, gross_salary, gross_salary_p2, expected_raise_pct, bonus_quarterly,
      four_o_one_k_pct, four_o_one_k_match_pct, four_o_one_k_pct_p2, four_o_one_k_match_pct_p2 } = req.body;
    const targetId = id != null ? parseInt(id, 10) : null;
    if (targetId != null && Number.isInteger(targetId)) {
      const result = await pool.query(
        `UPDATE income SET
          as_of = COALESCE($1, as_of),
          gross_salary = COALESCE($2, gross_salary),
          gross_salary_p2 = $3,
          expected_raise_pct = $4,
          bonus_quarterly = $5,
          four_o_one_k_pct = $6,
          four_o_one_k_match_pct = $7,
          four_o_one_k_pct_p2 = $8,
          four_o_one_k_match_pct_p2 = $9,
          modified = CURRENT_TIMESTAMP
         WHERE id = $10
         RETURNING *`,
        [
          as_of && String(as_of).trim() ? String(as_of).trim() : null,
          gross_salary != null ? parseFloat(gross_salary) : null,
          gross_salary_p2 != null ? parseFloat(gross_salary_p2) : null,
          expected_raise_pct != null ? parseFloat(expected_raise_pct) : null,
          bonus_quarterly != null ? parseFloat(bonus_quarterly) : null,
          four_o_one_k_pct != null ? parseFloat(four_o_one_k_pct) : null,
          four_o_one_k_match_pct != null ? parseFloat(four_o_one_k_match_pct) : null,
          four_o_one_k_pct_p2 != null ? parseFloat(four_o_one_k_pct_p2) : null,
          four_o_one_k_match_pct_p2 != null ? parseFloat(four_o_one_k_match_pct_p2) : null,
          targetId,
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Income not found' });
      }
      return res.json(result.rows[0]);
    }
    const result = await pool.query(
      `UPDATE income SET
        as_of = COALESCE($1, as_of),
        gross_salary = COALESCE($2, gross_salary),
        gross_salary_p2 = $3,
        expected_raise_pct = $4,
        bonus_quarterly = $5,
        four_o_one_k_pct = $6,
        four_o_one_k_match_pct = $7,
        four_o_one_k_pct_p2 = $8,
        four_o_one_k_match_pct_p2 = $9,
        modified = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM income ORDER BY as_of DESC, id DESC LIMIT 1)
       RETURNING *`,
      [
        as_of && String(as_of).trim() ? String(as_of).trim() : null,
        gross_salary != null ? parseFloat(gross_salary) : null,
        gross_salary_p2 != null ? parseFloat(gross_salary_p2) : null,
        expected_raise_pct != null ? parseFloat(expected_raise_pct) : null,
        bonus_quarterly != null ? parseFloat(bonus_quarterly) : null,
        four_o_one_k_pct != null ? parseFloat(four_o_one_k_pct) : null,
        four_o_one_k_match_pct != null ? parseFloat(four_o_one_k_match_pct) : null,
        four_o_one_k_pct_p2 != null ? parseFloat(four_o_one_k_pct_p2) : null,
        four_o_one_k_match_pct_p2 != null ? parseFloat(four_o_one_k_match_pct_p2) : null,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Income not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating income:', error);
    res.status(500).json({ error: error.message || 'Failed to update income' });
  }
});

// ==================== ACCOUNTS (user-defined) ====================

app.get('/api/accounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM account ORDER BY sort_order, name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Tables do not exist. Run database/schema.sql on your retirementhub database.' });
    }
    res.status(500).json({ error: error.message || 'Failed to fetch accounts' });
  }
});

app.get('/api/accounts/:id', async (req, res) => {
  try {
    const accountId = parsePositiveIntParam(req.params.id);
    if (!accountId) {
      return res.status(400).json({ error: 'Invalid account id' });
    }
    const result = await pool.query('SELECT * FROM account WHERE id = $1', [accountId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch account' });
  }
});

function parseExpectedDepreciationPct(raw) {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(100, Math.round(n * 100) / 100);
}

const RMD_ACCOUNT_TYPES = new Set(['ira_traditional', '401k_traditional']);

/** Traditional IRA / 401(k) trad: whose balance applies for RMD (null = use owner_type). */
function parseRmdOwnerType(raw, accountType) {
  if (!RMD_ACCOUNT_TYPES.has(accountType)) return null;
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim();
  if (s === 'p1' || s === 'p2' || s === 'joint') return s;
  return null;
}

app.post('/api/accounts', async (req, res) => {
  try {
    const { name, account_type, owner_type, sort_order, expected_depreciation_pct, rmd_owner_type } = req.body;
    const trimmedName = name != null ? String(name).trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ error: 'Account name is required' });
    }
    const at = account_type || 'taxable';
    const dep = at === 'asset' ? parseExpectedDepreciationPct(expected_depreciation_pct) : null;
    const rmdOt = parseRmdOwnerType(rmd_owner_type, at);
    const result = await pool.query(
      `INSERT INTO account (name, account_type, owner_type, sort_order, expected_depreciation_pct, rmd_owner_type)
       VALUES ($1, $2, COALESCE($3, 'joint'), COALESCE($4, 0), $5, $6)
       RETURNING *`,
      [trimmedName, at, owner_type || 'joint', sort_order != null ? parseInt(sort_order, 10) : 0, dep, rmdOt]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating account:', error);
    if (error.code === '23514') {
      return res.status(400).json({ error: 'Invalid account_type or owner_type' });
    }
    res.status(500).json({ error: error.message || 'Failed to create account' });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    const { name, account_type, owner_type, sort_order, expected_depreciation_pct, rmd_owner_type } = req.body;
    const id = parsePositiveIntParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid account id' });
    }
    const trimmedName = name != null ? String(name).trim() : null;
    const existing = await pool.query(
      'SELECT account_type, expected_depreciation_pct, rmd_owner_type, owner_type FROM account WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const prev = existing.rows[0];
    const resolvedType =
      account_type != null ? String(account_type).trim() : prev.account_type;
    let dep = null;
    if (resolvedType === 'asset') {
      if (expected_depreciation_pct !== undefined) {
        dep = parseExpectedDepreciationPct(expected_depreciation_pct);
      } else if (prev.account_type === 'asset') {
        dep = prev.expected_depreciation_pct;
      } else {
        dep = null;
      }
    }
    let rmdOt = null;
    if (RMD_ACCOUNT_TYPES.has(resolvedType)) {
      if (rmd_owner_type !== undefined) {
        rmdOt = parseRmdOwnerType(rmd_owner_type, resolvedType);
      } else if (RMD_ACCOUNT_TYPES.has(prev.account_type)) {
        rmdOt = prev.rmd_owner_type;
      } else {
        rmdOt = null;
      }
    }
    const result = await pool.query(
      `UPDATE account SET
        name = COALESCE($1, name),
        account_type = COALESCE($2, account_type),
        owner_type = COALESCE($3, owner_type),
        sort_order = COALESCE($4, sort_order),
        expected_depreciation_pct = $5,
        rmd_owner_type = $6,
        modified = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        trimmedName,
        account_type != null ? String(account_type).trim() : null,
        owner_type != null ? String(owner_type).trim() : null,
        sort_order != null ? parseInt(sort_order, 10) : null,
        dep,
        rmdOt,
        id,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: error.message || 'Failed to update account' });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const accountId = parsePositiveIntParam(req.params.id);
    if (!accountId) {
      return res.status(400).json({ error: 'Invalid account id' });
    }
    const result = await pool.query('DELETE FROM account WHERE id = $1 RETURNING *', [accountId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: error.message || 'Failed to delete account' });
  }
});

// ==================== ACCOUNT BALANCES ====================
// Snapshots by as_of; latest per account for projections; full history per account.

app.get('/api/account-balances', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (ab.account_id)
              ab.id AS balance_id, ab.account_id, ab.as_of, ab.balance, ab.modified,
              a.name AS account_name, a.account_type, a.owner_type,
              a.expected_depreciation_pct, a.rmd_owner_type
       FROM account_balance ab
       JOIN account a ON ab.account_id = a.id
       ORDER BY ab.account_id, ab.as_of DESC, ab.id DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching account balances:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Tables do not exist. Run database/schema.sql on your retirementhub database.' });
    }
    res.status(500).json({ error: error.message || 'Failed to fetch account balances' });
  }
});

app.get('/api/accounts/:id/balances', async (req, res) => {
  const operation = 'get_account_balance_history';
  try {
    const accountId = parsePositiveIntParam(req.params.id);
    if (!accountId) {
      return balanceValidationError(res, req, operation, 'Invalid account id', {
        url_id_raw: describeValue(req.params.id),
        url_id_parsed: accountId,
      });
    }
    console.info('[account-balance] history sql params', { accountId: describeValue(accountId) });
    const result = await pool.query(
      `SELECT ab.id AS balance_id, ab.account_id, ab.as_of, ab.balance, ab.modified
       FROM account_balance ab WHERE ab.account_id = $1 ORDER BY ab.as_of DESC, ab.id DESC`,
      [accountId]
    );
    res.json(result.rows);
  } catch (error) {
    balanceApiError(res, req, operation, {
      fallback: 'Failed to fetch account balances',
      url_id_parsed: parsePositiveIntParam(req.params.id),
    }, error);
  }
});

async function upsertAccountBalanceRow(accountId, as_of, balance) {
  const asOfDate = as_of && String(as_of).trim() ? String(as_of).trim() : new Date().toISOString().slice(0, 10);
  const balanceValue = balance != null ? parseFloat(balance) : 0;
  const sqlParams = [accountId, asOfDate, balanceValue];
  console.info('[account-balance] upsert sql params', {
    accountId: describeValue(accountId),
    asOfDate: describeValue(asOfDate),
    balanceValue: describeValue(balanceValue),
    dbBalanceColumnType: accountBalanceColumnTypes?.balance,
    dbAccountIdColumnType: accountBalanceColumnTypes?.account_id,
  });
  const result = await pool.query(
    `INSERT INTO account_balance (account_id, as_of, balance)
     VALUES ($1, $2, $3)
     ON CONFLICT (account_id, as_of) DO UPDATE SET balance = EXCLUDED.balance, modified = CURRENT_TIMESTAMP
     RETURNING id AS balance_id, account_id, as_of, balance, modified`,
    sqlParams
  );
  return result.rows[0];
}

app.post('/api/account-balances', async (req, res) => {
  const operation = 'post_account_balance';
  try {
    const { account_id, as_of, balance } = req.body || {};
    const accountId = parsePositiveIntParam(account_id);
    if (!accountId) {
      return balanceValidationError(
        res,
        req,
        operation,
        'Valid account_id is required (whole number, not the balance amount)',
        {
          account_id_raw: describeValue(account_id),
          account_id_parsed: accountId,
          as_of_raw: describeValue(as_of),
          balance_raw: describeValue(balance),
        }
      );
    }
    const row = await upsertAccountBalanceRow(accountId, as_of, balance);
    res.status(201).json(row);
  } catch (error) {
    balanceApiError(res, req, operation, {
      fallback: 'Failed to create account balance',
      account_id_raw: describeValue(req.body?.account_id),
      account_id_parsed: parsePositiveIntParam(req.body?.account_id),
      as_of_raw: describeValue(req.body?.as_of),
      balance_raw: describeValue(req.body?.balance),
    }, error);
  }
});

/** Deprecated: upsert only via POST with account_id in body (URL :id is ignored). */
app.put('/api/account-balances/:id', async (req, res) => {
  const operation = 'put_account_balance';
  try {
    const accountId = parsePositiveIntParam(req.body?.account_id);
    if (!accountId) {
      return balanceValidationError(
        res,
        req,
        operation,
        'PUT is deprecated. Use POST /api/account-balances with { account_id, as_of, balance }.',
        {
          url_id_raw: describeValue(req.params.id),
          url_id_parsed: parsePositiveIntParam(req.params.id),
          account_id_raw: describeValue(req.body?.account_id),
          account_id_parsed: accountId,
        }
      );
    }
    const row = await upsertAccountBalanceRow(accountId, req.body.as_of, req.body.balance);
    return res.json(row);
  } catch (error) {
    balanceApiError(res, req, operation, {
      fallback: 'Failed to update account balance',
      url_id_raw: describeValue(req.params.id),
      account_id_parsed: parsePositiveIntParam(req.body?.account_id),
    }, error);
  }
});

app.delete('/api/account-balances/:id', async (req, res) => {
  const operation = 'delete_account_balance';
  try {
    const balanceRowId = parsePositiveIntParam(req.params.id);
    if (!balanceRowId) {
      return balanceValidationError(res, req, operation, 'Invalid balance id', {
        url_id_raw: describeValue(req.params.id),
        url_id_parsed: balanceRowId,
      });
    }
    console.info('[account-balance] delete sql params', { balanceRowId: describeValue(balanceRowId) });
    const result = await pool.query('DELETE FROM account_balance WHERE id = $1 RETURNING *', [balanceRowId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account balance not found', operation, debug: balanceRequestDebug(req, { balanceRowId }) });
    }
    res.json({ message: 'Account balance deleted' });
  } catch (error) {
    balanceApiError(res, req, operation, {
      fallback: 'Failed to delete account balance',
      balance_row_id_parsed: parsePositiveIntParam(req.params.id),
    }, error);
  }
});

// ==================== EXPENSE CATEGORIES (read-only) ====================

app.get('/api/expense-categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expense_category ORDER BY category_group, sort_order, name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch expense categories' });
  }
});

app.patch('/api/expense-categories/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { category_type } = req.body;
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid category id' });
    }
    const allowed = ['regular', 'p2_health_until_medicare'];
    const newType = category_type != null && allowed.includes(String(category_type).trim()) ? String(category_type).trim() : null;
    if (newType == null) {
      return res.status(400).json({ error: 'category_type must be one of: regular, p2_health_until_medicare' });
    }
    const result = await pool.query(
      'UPDATE expense_category SET category_type = $1, modified = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newType, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense category not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense category:', error);
    res.status(500).json({ error: error.message || 'Failed to update expense category' });
  }
});

// Returns latest as_of per category; only rows with actual_annual or positive current/mo or retirement/mo.
app.get('/api/expense-lines', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM (
        SELECT DISTINCT ON (el.expense_category_id) el.*, ec.name AS category_name, ec.category_group, ec.category_type
        FROM expense_line el
        JOIN expense_category ec ON el.expense_category_id = ec.id
        ORDER BY el.expense_category_id, el.as_of DESC, el.id DESC
      ) sub
      WHERE (sub.actual_annual IS NOT NULL AND sub.actual_annual > 0)
         OR (sub.current_monthly > 0)
         OR (sub.retirement_monthly IS NOT NULL AND sub.retirement_monthly > 0)`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expense lines:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch expense lines' });
  }
});

app.put('/api/expense-lines/:id', async (req, res) => {
  try {
    const { current_monthly, retirement_monthly, actual_annual, as_of } = req.body;
    const result = await pool.query(
      `UPDATE expense_line SET
        current_monthly = COALESCE($1, current_monthly),
        retirement_monthly = $2,
        actual_annual = $3,
        as_of = COALESCE($4, as_of),
        modified = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        current_monthly != null ? parseFloat(current_monthly) : null,
        retirement_monthly != null ? parseFloat(retirement_monthly) : null,
        actual_annual != null ? parseFloat(actual_annual) : null,
        as_of && String(as_of).trim() ? String(as_of).trim() : null,
        parseInt(req.params.id, 10),
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense line not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense line:', error);
    res.status(500).json({ error: error.message || 'Failed to update expense line' });
  }
});

app.post('/api/expense-lines', async (req, res) => {
  try {
    const { expense_category_id, as_of, current_monthly, retirement_monthly, actual_annual } = req.body;
    const categoryId = expense_category_id != null ? parseInt(expense_category_id, 10) : null;
    if (!categoryId || !Number.isInteger(categoryId)) {
      return res.status(400).json({ error: 'expense_category_id is required' });
    }
    const asOfDate = as_of && String(as_of).trim() ? String(as_of).trim() : new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `INSERT INTO expense_line (expense_category_id, as_of, current_monthly, retirement_monthly, actual_annual)
       VALUES ($1, $2, COALESCE($3, 0), $4, $5)
       ON CONFLICT (expense_category_id, as_of) DO UPDATE SET
         current_monthly = EXCLUDED.current_monthly,
         retirement_monthly = EXCLUDED.retirement_monthly,
         actual_annual = EXCLUDED.actual_annual,
         modified = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        categoryId,
        asOfDate,
        current_monthly != null ? parseFloat(current_monthly) : 0,
        retirement_monthly != null ? parseFloat(retirement_monthly) : null,
        actual_annual != null ? parseFloat(actual_annual) : null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expense line:', error);
    res.status(500).json({ error: error.message || 'Failed to create expense line' });
  }
});

// ==================== IMPORT (CSV from GnuCash-style reports) ====================
// Expenses CSV: category_name, actual_annual [, as_of ]. Headers optional; as_of defaults to request body or last day of current year.
// Account balances CSV: account_name, as_of, balance. Headers optional. Missing accounts are created as savings/joint.

const CATEGORY_ALIASES = {
  'educational': 'Education',
  'entertain': 'Entertainment',
  'home improvement': 'Home Repair',
  'serv': 'Auto Service',
  'bank chrg': 'Misc',
  'registration': 'Auto Registration',
  'fuel': 'Auto Fuel',
  'household': 'Groceries',
  'auto': 'Auto',
  'homeowners': 'Homeowners',
  'medical (pretax)': 'Medical',
  'mortgage interest': 'Supplies',
  'medicine and doctors': 'Medicine/Docs',
  'misc': 'Misc',
  'total expenses (c-ez)': 'Misc',
  'property tax': 'Property Tax',
  'sales tax': 'Misc',
  'tax prep': 'Misc',
  'federal': 'Federal',
  'medicare': 'Medicare',
  'social security': 'Social Security',
  'cable': 'Cable',
  'cell phone': 'Cell Phone',
  'electric': 'Electricity',
  'garbage collection': 'Garbage',
  'gas': 'Gas',
  'reno sewer': 'Sewer',
  'water': 'Water',
  'expenses': 'Misc',
  'lodging': 'Travel',
  'memberships': 'Memberships',
  'mad money': 'Mad Money',
  'travel': 'Travel',
};

function normalizeCategoryName(name) {
  if (!name || typeof name !== 'string') return '';
  const t = name.trim().toLowerCase();
  return CATEGORY_ALIASES[t] || name.trim();
}

function parseCsvRows(buffer) {
  const text = buffer.toString('utf8').trim();
  if (!text) return { rows: [], headers: [] };
  try {
    const parsed = parseCsv(text, { skip_empty_lines: true, trim: true, relax_column_count: true });
    if (!parsed.length) return { rows: [], headers: [] };
    const first = parsed[0];
    // Two-column format with no header: first cell contains ":" (e.g. "Discretionary:Home Improvement,389.73")
    if (first.length === 2 && String(first[0] || '').includes(':')) {
      const headers = ['category_path', 'actual_annual'];
      const rows = parsed.map((row) => ({
        category_path: row[0] != null ? String(row[0]).trim() : '',
        actual_annual: row[1] != null ? String(row[1]).trim() : '',
      }));
      return { rows, headers };
    }
    const headers = first.map((h) => (h != null ? String(h).trim().toLowerCase() : ''));
    const rows = parsed.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] != null ? String(row[i]).trim() : ''; });
      return obj;
    });
    return { rows, headers };
  } catch (e) {
    throw new Error('Invalid CSV: ' + (e.message || String(e)));
  }
}

/** Parse "Group:Name" or "Group:Sub:Name" → { category_group, category_name }. If no colon, use value for both. */
function parseCategoryPath(path) {
  if (!path || typeof path !== 'string') return { category_group: '', category_name: '' };
  const s = path.trim();
  const idx = s.indexOf(':');
  if (idx === -1) return { category_group: s, category_name: s };
  const category_group = s.slice(0, idx).trim();
  const category_name = s.slice(s.lastIndexOf(':') + 1).trim();
  return { category_group: category_group || s, category_name: category_name || s };
}

const ALLOWED_GROUPS = ['discretionary', 'fixed', 'insurance', 'utilities', 'tax', 'personal'];

function normalizeCategoryGroup(raw) {
  if (!raw || typeof raw !== 'string') return 'discretionary';
  const n = String(raw).trim().toLowerCase().replace(/\s+/g, '_');
  return ALLOWED_GROUPS.includes(n) ? n : (ALLOWED_GROUPS.find((g) => g.startsWith(n)) || 'discretionary');
}

app.post('/api/import/expenses', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'CSV file is required. Use form field name "file".' });
    }
    const asOfFromBody = req.body.as_of && String(req.body.as_of).trim();
    if (!asOfFromBody) {
      return res.status(400).json({ error: 'As of date is required. Select a date in the import form.' });
    }
    let asOf = asOfFromBody.slice(0, 10);
    if (asOf.includes('/')) {
      const parts = asOf.split(/[/-]/);
      if (parts.length >= 3) asOf = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }

    // Household retirement dates: if AsOf >= effective retirement date, pre-fill retirement/mo; else current/mo
    let effectiveRetirementDate = null;
    const householdResult = await pool.query('SELECT p1_retirement_date, p2_retirement_date FROM household ORDER BY id LIMIT 1');
    if (householdResult.rows.length > 0) {
      const h = householdResult.rows[0];
      const d1 = h.p1_retirement_date ? String(h.p1_retirement_date).slice(0, 10) : null;
      const d2 = h.p2_retirement_date ? String(h.p2_retirement_date).slice(0, 10) : null;
      if (d1 && d2) effectiveRetirementDate = d1 > d2 ? d1 : d2;
      else if (d1) effectiveRetirementDate = d1;
      else if (d2) effectiveRetirementDate = d2;
    }

    const { rows, headers } = parseCsvRows(req.file.buffer);
    const isTwoColumn = headers.length === 2;

    const categoryIdx = headers.findIndex((h) => /category|name|path/i.test(h) && !/group|amount|actual/.test(h));
    const groupIdx = headers.findIndex((h) => /group/i.test(h));
    const amountIdx = headers.findIndex((h) => /actual_annual|amount|total/i.test(h));
    const pathIdx = headers.findIndex((h) => /path|category_path/i.test(h));

    const getCategoryPathOrName = (row) => {
      if (isTwoColumn) return (pathIdx >= 0 ? row[headers[pathIdx]] : row[headers[0]]) ?? '';
      return (categoryIdx >= 0 ? row[headers[categoryIdx]] : row[headers[0]]) ?? '';
    };
    const getGroup = (row) => {
      if (isTwoColumn) return ''; // parsed from path
      return (groupIdx >= 0 ? row[headers[groupIdx]] : (headers.length > 2 ? row[headers[1]] : '')) ?? '';
    };
    const getAmount = (row) => {
      if (isTwoColumn) return (amountIdx >= 0 ? row[headers[amountIdx]] : row[headers[1]]) ?? '';
      return (amountIdx >= 0 ? row[headers[amountIdx]] : row[headers[headers.length > 2 ? 2 : 1]]) ?? '';
    };

    const imported = [];
    const skipped = [];
    const errors = [];
    const categoriesCreated = [];

    async function getOrCreateCategory(categoryName, categoryGroup) {
      const name = categoryName.trim();
      if (!name) return null;
      const group = normalizeCategoryGroup(categoryGroup || 'discretionary');
      const existing = await pool.query('SELECT id FROM expense_category WHERE LOWER(name) = LOWER($1)', [name]);
      if (existing.rows.length > 0) return { id: existing.rows[0].id, created: false };
      const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM expense_category');
      const sortOrder = maxOrder.rows[0].next_order;
      await pool.query(
        'INSERT INTO expense_category (name, category_group, sort_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
        [name, group, sortOrder]
      );
      const inserted = await pool.query('SELECT id FROM expense_category WHERE LOWER(name) = LOWER($1)', [name]);
      if (inserted.rows.length > 0) {
        categoriesCreated.push(name);
        return { id: inserted.rows[0].id, created: true };
      }
      return null;
    }

    for (const row of rows) {
      const rawPathOrName = getCategoryPathOrName(row);
      const amountStr = getAmount(row);
      if (!rawPathOrName || String(rawPathOrName).toLowerCase() === 'grand total') continue;

      let categoryName;
      let categoryGroup;

      if (isTwoColumn) {
        const parsed = parseCategoryPath(rawPathOrName);
        categoryName = parsed.category_name || parsed.category_group;
        categoryGroup = parsed.category_group;
        if (!categoryName) {
          skipped.push({ category: rawPathOrName, reason: 'Could not parse category from path' });
          continue;
        }
        categoryGroup = normalizeCategoryGroup(categoryGroup);
      } else {
        categoryName = normalizeCategoryName(rawPathOrName);
        if (!categoryName) {
          skipped.push({ category: rawPathOrName, reason: 'Empty category name' });
          continue;
        }
        const rowGroup = getGroup(row);
        categoryGroup = rowGroup && String(rowGroup).trim()
          ? normalizeCategoryGroup(String(rowGroup).trim())
          : 'discretionary';
      }

      const cat = await getOrCreateCategory(categoryName, categoryGroup);
      if (!cat) {
        errors.push({ category: rawPathOrName, reason: 'Could not create or find category' });
        continue;
      }

      const amount = parseFloat(String(amountStr).replace(/[$,]/g, ''));
      if (Number.isNaN(amount)) {
        errors.push({ category: rawPathOrName, reason: 'Invalid amount' });
        continue;
      }

      const monthlyValue = Math.round((amount / 12) * 100) / 100;
      const isRetirement = effectiveRetirementDate && asOf >= effectiveRetirementDate;
      const currentMonthly = isRetirement ? 0 : monthlyValue;
      const retirementMonthly = isRetirement ? monthlyValue : null;

      try {
        await pool.query(
          `INSERT INTO expense_line (expense_category_id, as_of, current_monthly, retirement_monthly, actual_annual)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (expense_category_id, as_of) DO UPDATE SET
             current_monthly = EXCLUDED.current_monthly,
             retirement_monthly = EXCLUDED.retirement_monthly,
             actual_annual = EXCLUDED.actual_annual,
             modified = CURRENT_TIMESTAMP`,
          [cat.id, asOf, currentMonthly, retirementMonthly, amount]
        );
        imported.push({ category: categoryName, as_of: asOf, actual_annual: amount });
      } catch (err) {
        errors.push({ category: rawPathOrName, reason: err.message || 'Database error' });
      }
    }

    res.status(200).json({
      imported: imported.length,
      skipped: skipped.length,
      errors: errors.length,
      categories_created: categoriesCreated.length,
      details: { imported, skipped, errors, categories_created: categoriesCreated },
    });
  } catch (error) {
    console.error('Import expenses error:', error);
    res.status(400).json({ error: error.message || 'Import failed' });
  }
});

app.post('/api/import/account-balances', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'CSV file is required. Use form field name "file".' });
    }
    const asOfFromBody = req.body.as_of && String(req.body.as_of).trim();
    if (!asOfFromBody) {
      return res.status(400).json({ error: 'As of date is required. Select a date in the import form.' });
    }
    let asOf = asOfFromBody.slice(0, 10);
    if (asOf.includes('/')) {
      const parts = asOf.split(/[/-]/);
      if (parts.length >= 3) asOf = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
    const { rows, headers } = parseCsvRows(req.file.buffer);
    const nameIdx = headers.findIndex((h) => /account|name/i.test(h) && !/balance/.test(h));
    const balanceIdx = headers.findIndex((h) => /balance|amount/i.test(h));
    const getName = (row) => (nameIdx >= 0 ? row[headers[nameIdx]] : row[0]);
    const getBalance = (row) => (balanceIdx >= 0 ? row[headers[balanceIdx]] : row[1]);

    const accountsResult = await pool.query('SELECT id, name FROM account');
    const accountByName = {};
    accountsResult.rows.forEach((r) => { accountByName[r.name.toLowerCase()] = r.id; });

    const imported = [];
    const created = [];
    const errors = [];

    for (const row of rows) {
      const accountName = getName(row);
      if (!accountName || accountName.toLowerCase() === 'grand total') continue;
      const balanceStr = getBalance(row);
      const balance = parseFloat(String(balanceStr).replace(/[$,]/g, ''));
      if (Number.isNaN(balance)) {
        errors.push({ account: accountName, reason: 'Invalid balance' });
        continue;
      }
      let accountId = accountByName[accountName.toLowerCase()];
      if (!accountId) {
        try {
          const ins = await pool.query(
            `INSERT INTO account (name, account_type, owner_type, sort_order) VALUES ($1, 'savings', 'joint', 0) RETURNING id, name`,
            [accountName.trim()]
          );
          accountId = ins.rows[0].id;
          accountByName[accountName.toLowerCase()] = accountId;
          created.push(accountName.trim());
        } catch (err) {
          errors.push({ account: accountName, reason: err.message || 'Could not create account' });
          continue;
        }
      }
      try {
        await pool.query(
          `INSERT INTO account_balance (account_id, as_of, balance)
           VALUES ($1, $2, $3)
           ON CONFLICT (account_id, as_of) DO UPDATE SET balance = EXCLUDED.balance, modified = CURRENT_TIMESTAMP`,
          [accountId, asOf, balance]
        );
        imported.push({ account: accountName, as_of: asOf, balance });
      } catch (err) {
        errors.push({ account: accountName, reason: err.message || 'Database error' });
      }
    }

    res.status(200).json({
      imported: imported.length,
      accounts_created: created.length,
      errors: errors.length,
      details: { imported, accounts_created: created, errors },
    });
  } catch (error) {
    console.error('Import account balances error:', error);
    res.status(400).json({ error: error.message || 'Import failed' });
  }
});

// ==================== MORTGAGE ====================

app.get('/api/mortgage', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mortgage ORDER BY id LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mortgage not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching mortgage:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch mortgage' });
  }
});

app.put('/api/mortgage', async (req, res) => {
  try {
    const { monthly_payment, payoff_date } = req.body;
    const result = await pool.query(
      `UPDATE mortgage SET
        monthly_payment = COALESCE($1, monthly_payment),
        payoff_date = $2,
        modified = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM mortgage LIMIT 1)
       RETURNING *`,
      [
        monthly_payment != null ? parseFloat(monthly_payment) : null,
        payoff_date && String(payoff_date).trim() ? String(payoff_date).trim() : null,
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mortgage not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating mortgage:', error);
    res.status(500).json({ error: error.message || 'Failed to update mortgage' });
  }
});

// ==================== SAVINGS LIMITS (Stage 2 — tax-leveraged maximums) ====================

app.get('/api/savings-limits', async (req, res) => {
  try {
    const yearParam = req.query.year != null ? parseInt(String(req.query.year).trim(), 10) : null;
    let household = null;
    try {
      const hResult = await pool.query('SELECT p1_display_name, p2_display_name, p1_birth_year, p2_birth_year FROM household ORDER BY id LIMIT 1');
      if (hResult.rows.length > 0) household = hResult.rows[0];
    } catch (e) { /* ignore */ }

    const p1BirthYear = household?.p1_birth_year != null ? parseInt(household.p1_birth_year, 10) : null;
    const p2BirthYear = household?.p2_birth_year != null ? parseInt(household.p2_birth_year, 10) : null;

    function ageAtEoy(birthYear, year) {
      if (birthYear == null || !Number.isInteger(birthYear)) return null;
      return year - birthYear;
    }

    function buildPartyLimits(birthYear, base, year) {
      const age = ageAtEoy(birthYear, year);
      const iraCatchUp = age != null && age >= 50 ? (base.ira_catch_up || 0) : 0;
      const k401CatchUp = age != null && age >= 50 ? (base['401k_catch_up'] || 0) : 0;
      const hsaCatchUp = age != null && age >= 55 ? (base.hsa_catch_up || 0) : 0;
      return {
        age_at_eoy: age,
        ira_limit: (base.ira || 0) + iraCatchUp,
        ira_catch_up_applies: iraCatchUp > 0,
        '401k_elective_limit': (base['401k_elective'] || 0) + k401CatchUp,
        '401k_catch_up_applies': k401CatchUp > 0,
        hsa_individual_limit: (base.hsa_individual || 0) + (hsaCatchUp > 0 ? hsaCatchUp : 0),
        hsa_family_limit: (base.hsa_family || 0) + (hsaCatchUp > 0 ? hsaCatchUp : 0),
        hsa_catch_up_applies: hsaCatchUp > 0,
      };
    }

    function buildHsaFamilyHouseholdLimit(base, p1BirthYear, p2BirthYear, year) {
      const p1Age = ageAtEoy(p1BirthYear, year);
      const p2Age = ageAtEoy(p2BirthYear, year);
      const catchUp = base.hsa_catch_up || 0;
      const p1CatchUp = p1Age != null && p1Age >= 55 ? catchUp : 0;
      const p2CatchUp = p2Age != null && p2Age >= 55 ? catchUp : 0;
      return (base.hsa_family || 0) + p1CatchUp + p2CatchUp;
    }

    if (yearParam != null && Number.isInteger(yearParam) && yearParam >= 2020 && yearParam <= 2030) {
      const limits = await taxParams.getContributionLimits(pool, yearParam);
      const base = contributionLimitsToBase(limits);
      const p1 = buildPartyLimits(p1BirthYear, base, yearParam);
      const p2 = buildPartyLimits(p2BirthYear, base, yearParam);
      p1.hsa_family_limit = buildHsaFamilyHouseholdLimit(base, p1BirthYear, p2BirthYear, yearParam);
      p2.hsa_family_limit = null;
      return res.json({
        year: yearParam,
        household: household ? { p1_display_name: household.p1_display_name, p2_display_name: household.p2_display_name } : null,
        limits: base,
        p1,
        p2,
      });
    }

    const years = {};
    const yearRows = await pool.query('SELECT year FROM tax_year ORDER BY year');
    const yearList =
      yearRows.rows.length > 0
        ? yearRows.rows.map((r) => parseInt(r.year, 10))
        : [2024, 2025, 2026];
    for (const y of yearList) {
      const limits = await taxParams.getContributionLimits(pool, y);
      const base = contributionLimitsToBase(limits);
      const p1 = buildPartyLimits(p1BirthYear, base, y);
      const p2 = buildPartyLimits(p2BirthYear, base, y);
      p1.hsa_family_limit = buildHsaFamilyHouseholdLimit(base, p1BirthYear, p2BirthYear, y);
      p2.hsa_family_limit = null;
      years[y] = { base, p1, p2 };
    }
    res.json({
      household: household ? { p1_display_name: household.p1_display_name, p2_display_name: household.p2_display_name } : null,
      years,
    });
  } catch (error) {
    console.error('Error fetching savings limits:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch savings limits' });
  }
});

// ==================== BUDGET SUMMARY (computed) ====================

app.get('/api/budget-summary', async (req, res) => {
  try {
    const linesResult = await pool.query(
      `SELECT el.current_monthly, el.retirement_monthly, ec.category_type
       FROM (SELECT DISTINCT ON (expense_category_id) expense_category_id, current_monthly, retirement_monthly
             FROM expense_line ORDER BY expense_category_id, as_of DESC, id DESC) el
       JOIN expense_category ec ON el.expense_category_id = ec.id`
    );
    let currentAnnual = 0;
    let retirementAnnual = 0;
    for (const row of linesResult.rows) {
      if ((row.category_type || 'regular') === 'p2_health_until_medicare') continue;
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
    retirementAnnual += mortgageMonthly * 12; // include until payoff; could exclude after payoff_date
    res.json({
      current_annual: Math.round(currentAnnual * 100) / 100,
      retirement_annual: Math.round(retirementAnnual * 100) / 100,
      target_25x_current: Math.round(currentAnnual * 25 * 100) / 100,
      target_25x_retirement: Math.round(retirementAnnual * 25 * 100) / 100,
    });
  } catch (error) {
    console.error('Error computing budget summary:', error);
    res.status(500).json({ error: error.message || 'Failed to compute budget summary' });
  }
});

// ==================== RETIREMENT TAX GUIDE ====================

async function estimateFederalTax(pool, taxableIncome, year, filingStatus) {
  const fs = taxParams.normalizeFilingStatus(filingStatus);
  const deduction = await taxParams.getStandardDeduction(pool, year, fs, null, null);
  const afterDeduction = Math.max(0, (taxableIncome || 0) - deduction);
  const result = await federalOrdinaryTaxWithBreakdown(pool, afterDeduction, fs, year);
  return result.total;
}

app.get('/api/retirement-tax-guide', async (req, res) => {
  try {
    const yearParam = req.query.year != null ? parseInt(String(req.query.year).trim(), 10) : null;
    const taxableIncomeParam = req.query.taxable_income != null ? parseFloat(String(req.query.taxable_income).trim()) : null;
    const filingParam = req.query.filing_status || 'married_filing_jointly';
    const year = Number.isFinite(yearParam) && yearParam >= 2024 && yearParam <= 2050 ? yearParam : new Date().getFullYear();

    const partBMonthly = await taxParams.getMedicarePartB(pool, year);
    const partBByYear = {};
    for (let y = 2024; y <= Math.min(year + 30, 2040); y++) {
      partBByYear[y] = await taxParams.getMedicarePartB(pool, y);
    }

    const out = {
      social_security: {
        retirement_monthly: 0,
        note: 'Social Security (OASDI) tax is not withheld on benefits. Set retirement/mo to 0 for this category.',
      },
      medicare: {
        retirement_monthly_suggested: partBMonthly,
        retirement_monthly_by_year: partBByYear,
        note: 'Pre-retirement: payroll Medicare tax. After retirement: Medicare Part B (and often Part D) premiums. Suggested value is standard Part B premium; add Part D and adjust for IRMAA if applicable.',
      },
      federal: {
        note: 'Federal income tax still applies to taxable retirement income (taxable portion of Social Security + IRA/401(k) withdrawals + other). Use "Estimate" with taxable income to get a suggested annual amount, then divide by 12 for retirement/mo.',
      },
    };

    if (Number.isFinite(taxableIncomeParam) && taxableIncomeParam >= 0) {
      const estimatedAnnual = await estimateFederalTax(pool, taxableIncomeParam, year, filingParam);
      out.federal.estimated_annual_tax = estimatedAnnual;
      out.federal.estimated_monthly = Math.round((estimatedAnnual / 12) * 100) / 100;
      out.federal.taxable_income_used = taxableIncomeParam;
      out.federal.year_used = year;
    }

    res.json(out);
  } catch (error) {
    console.error('Error building retirement tax guide:', error);
    res.status(500).json({ error: error.message || 'Failed to build guide' });
  }
});

// ==================== TAX PARAMETERS ====================

app.get('/api/tax-parameters/years', async (req, res) => {
  try {
    const r = await pool.query('SELECT year, status, inflation_pct, notes FROM tax_year ORDER BY year');
    res.json({
      years: r.rows.map((row) => ({
        ...row,
        has_irs_seed: seeds.hasIrsSeedYear(parseInt(row.year, 10)),
      })),
    });
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Run migration 016_tax_parameters.sql.' });
    }
    console.error('Error listing tax years:', error);
    res.status(500).json({ error: error.message || 'Failed to list tax years' });
  }
});

app.post('/api/tax-parameters/years', async (req, res) => {
  try {
    const result = await taxParams.createTaxYear(pool, {
      year: req.body?.year,
      cloneFromYear: req.body?.clone_from_year,
      status: req.body?.status,
      inflation_pct: req.body?.inflation_pct,
      notes: req.body?.notes,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Run migration 016_tax_parameters.sql.' });
    }
    const code = error.statusCode || 500;
    if (code >= 500) console.error('Error creating tax year:', error);
    res.status(code).json({ error: error.message || 'Failed to create tax year' });
  }
});

app.get('/api/tax-parameters', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    if (!Number.isInteger(year)) return res.status(400).json({ error: 'year required' });
    const sd = (
      await pool.query(
        `SELECT filing_status, amount, age65_add_on, source, modified
         FROM tax_standard_deduction WHERE year=$1 ORDER BY filing_status`,
        [year]
      )
    ).rows;
    const br = (
      await pool.query(
        `SELECT filing_status, ordinal, lower_bound, rate, source, modified
         FROM tax_bracket WHERE year=$1 ORDER BY filing_status, ordinal`,
        [year]
      )
    ).rows;
    const cl = (
      await pool.query(
        `SELECT kind, base_amount, catch_up_amount, source, modified
         FROM tax_contribution_limit WHERE year=$1 ORDER BY kind`,
        [year]
      )
    ).rows;
    const mp = (
      await pool.query('SELECT monthly_premium, source, modified FROM tax_medicare_part_b WHERE year=$1', [
        year,
      ])
    ).rows[0] || null;
    res.json({
      year,
      standard_deduction: sd,
      brackets: br,
      contribution_limits: cl,
      medicare_part_b: mp,
    });
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Run migration 016_tax_parameters.sql.' });
    }
    console.error('Error fetching tax parameters:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch tax parameters' });
  }
});

app.put('/api/tax-parameters/standard-deduction/:year/:filingStatus', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const { amount, age65_add_on } = req.body;
    const r = await pool.query(
      `UPDATE tax_standard_deduction SET amount=$1, age65_add_on=$2, source='user_edited', modified=NOW()
       WHERE year=$3 AND filing_status=$4 RETURNING *`,
      [amount, age65_add_on ?? 0, year, req.params.filingStatus]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tax-parameters/bracket/:year/:filingStatus/:ordinal', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const ordinal = parseInt(req.params.ordinal, 10);
    const { lower_bound, rate } = req.body;
    const r = await pool.query(
      `UPDATE tax_bracket SET lower_bound=$1, rate=$2, source='user_edited', modified=NOW()
       WHERE year=$3 AND filing_status=$4 AND ordinal=$5 RETURNING *`,
      [lower_bound, rate, year, req.params.filingStatus, ordinal]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tax-parameters/contribution-limit/:year/:kind', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const { base_amount, catch_up_amount } = req.body;
    const r = await pool.query(
      `UPDATE tax_contribution_limit SET base_amount=$1, catch_up_amount=$2, source='user_edited', modified=NOW()
       WHERE year=$3 AND kind=$4 RETURNING *`,
      [base_amount, catch_up_amount ?? 0, year, req.params.kind]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tax-parameters/medicare-part-b/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const { monthly_premium } = req.body;
    const r = await pool.query(
      `UPDATE tax_medicare_part_b SET monthly_premium=$1, source='user_edited', modified=NOW()
       WHERE year=$2 RETURNING *`,
      [monthly_premium, year]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function taxResetConfirmed(req) {
  const q = req.query?.confirm;
  const b = req.body?.confirm;
  if (q === true || q === 'true' || b === true || b === 'true') return true;
  if (Array.isArray(q) && q.includes('true')) return true;
  return false;
}

app.post('/api/tax-parameters/:year/reset', async (req, res) => {
  try {
    if (!taxResetConfirmed(req)) {
      return res.status(400).json({ error: 'Add ?confirm=true to reset user edits for this year' });
    }
    const year = parseInt(req.params.year, 10);
    if (!Number.isInteger(year)) return res.status(400).json({ error: 'Invalid year' });
    const data = seeds.rowsForYear(year);
    if (!data.taxYears.length) {
      return res.status(404).json({ error: 'No seeded data for this year' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of data.standardDeduction) {
        await client.query(
          `INSERT INTO tax_standard_deduction (year, filing_status, amount, age65_add_on, source)
           VALUES ($1,$2,$3,$4,'seeded')
           ON CONFLICT (year, filing_status) DO UPDATE SET
             amount=EXCLUDED.amount, age65_add_on=EXCLUDED.age65_add_on, source='seeded', modified=NOW()`,
          [row.year, row.filing_status, row.amount, row.age65_add_on]
        );
      }
      for (const row of data.brackets) {
        await client.query(
          `INSERT INTO tax_bracket (year, filing_status, ordinal, lower_bound, rate, source)
           VALUES ($1,$2,$3,$4,$5,'seeded')
           ON CONFLICT (year, filing_status, ordinal) DO UPDATE SET
             lower_bound=EXCLUDED.lower_bound, rate=EXCLUDED.rate, source='seeded', modified=NOW()`,
          [row.year, row.filing_status, row.ordinal, row.lower_bound, row.rate]
        );
      }
      for (const row of data.contributionLimits) {
        await client.query(
          `INSERT INTO tax_contribution_limit (year, kind, base_amount, catch_up_amount, source)
           VALUES ($1,$2,$3,$4,'seeded')
           ON CONFLICT (year, kind) DO UPDATE SET
             base_amount=EXCLUDED.base_amount, catch_up_amount=EXCLUDED.catch_up_amount,
             source='seeded', modified=NOW()`,
          [row.year, row.kind, row.base_amount, row.catch_up_amount]
        );
      }
      for (const row of data.medicarePartB) {
        await client.query(
          `INSERT INTO tax_medicare_part_b (year, monthly_premium, source)
           VALUES ($1,$2,'seeded')
           ON CONFLICT (year) DO UPDATE SET
             monthly_premium=EXCLUDED.monthly_premium, source='seeded', modified=NOW()`,
          [row.year, row.monthly_premium]
        );
      }
      await client.query('COMMIT');
      res.json({ year, reset: true, message: 'Restored seeded defaults for this year' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Run migration 016_tax_parameters.sql.' });
    }
    console.error('Error resetting tax parameters:', error);
    res.status(500).json({ error: error.message || 'Failed to reset' });
  }
});

function summarizeFromCached(byYear, scenario) {
  if (!byYear?.length || !scenario) return null;
  const last = byYear[byYear.length - 1];
  const a = scenario.assumptions || {};
  let peakRmd = 0;
  let peakRmdYear = null;
  let lifetimeTax = 0;
  let totalRoth = 0;
  let p1RetirementYear = null;
  let p2RetirementYear = null;
  for (const r of byYear) {
    lifetimeTax += r.federal_tax_total || 0;
    totalRoth += r.roth_conversion || 0;
    if ((r.rmd || 0) > peakRmd) {
      peakRmd = r.rmd;
      peakRmdYear = r.year;
    }
    if (p1RetirementYear == null && r.p1_retired) p1RetirementYear = r.year;
    if (p2RetirementYear == null && r.p2_retired) p2RetirementYear = r.year;
  }
  return {
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    p1_retirement_year: p1RetirementYear,
    p2_retirement_year: p2RetirementYear,
    p1_ss_claim_age: a.social_security_claim_age_p1,
    p2_ss_claim_age: a.social_security_claim_age_p2,
    withdrawal_strategy: a.withdrawal_strategy,
    roth_strategy: a.roth_conversion_strategy,
    lifetime_total_tax: Math.round(lifetimeTax * 100) / 100,
    ending_net_worth: last?.net_worth,
    peak_rmd: peakRmd,
    peak_rmd_year: peakRmdYear,
    total_roth_conversions: Math.round(totalRoth * 100) / 100,
  };
}

async function loadScenarioCompareBundle(pool, id, recompute) {
  const scenario = await loadScenario(pool, id);
  if (!scenario) return null;
  const computed = await ensureScenarioComputed(pool, id, {}, { recompute: !!recompute });
  const byYear = computed.by_year || [];
  const summary = computed.from_cache
    ? summarizeFromCached(byYear, scenario)
    : summarizeScenarioProjection(computed);
  return { scenario, byYear, summary };
}

// ==================== SCENARIOS ====================

function parseScenarioAssumptionBody(body) {
  const a = body?.assumptions || body;
  return {
    retirement_age_p1: a.retirement_age_p1 != null ? parseInt(a.retirement_age_p1, 10) : null,
    retirement_age_p2: a.retirement_age_p2 != null ? parseInt(a.retirement_age_p2, 10) : null,
    social_security_claim_age_p1:
      a.social_security_claim_age_p1 != null ? parseInt(a.social_security_claim_age_p1, 10) : null,
    social_security_claim_age_p2:
      a.social_security_claim_age_p2 != null ? parseInt(a.social_security_claim_age_p2, 10) : null,
    annual_spending_target:
      a.annual_spending_target != null && a.annual_spending_target !== ''
        ? parseFloat(a.annual_spending_target)
        : null,
    inflation_rate: a.inflation_rate != null && a.inflation_rate !== '' ? parseFloat(a.inflation_rate) : null,
    portfolio_return_rate:
      a.portfolio_return_rate != null && a.portfolio_return_rate !== '' ? parseFloat(a.portfolio_return_rate) : null,
    withdrawal_strategy: a.withdrawal_strategy || 'conservative',
    withdrawal_order_custom: a.withdrawal_order_custom || null,
    roth_conversion_strategy: a.roth_conversion_strategy || 'none',
    notes: a.notes != null ? String(a.notes) : null,
  };
}

app.get('/api/scenarios', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.description, s.is_default, s.created_at, s.updated_at, s.last_computed_at,
              sa.retirement_age_p1, sa.retirement_age_p2,
              sa.social_security_claim_age_p1, sa.social_security_claim_age_p2,
              sa.annual_spending_target, sa.inflation_rate, sa.portfolio_return_rate,
              sa.withdrawal_strategy, sa.roth_conversion_strategy, sa.notes
       FROM scenario s
       LEFT JOIN scenario_assumption sa ON sa.scenario_id = s.id
       ORDER BY s.is_default DESC, s.id`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing scenarios:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Scenario tables missing. Run migration 012_scenario_framework.sql.' });
    }
    res.status(500).json({ error: error.message || 'Failed to list scenarios' });
  }
});

app.post('/api/scenarios', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, is_default, assumptions, roth_plan } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    await client.query('BEGIN');
    const hh = await client.query('SELECT id FROM household ORDER BY id LIMIT 1');
    const householdId = hh.rows[0]?.id || 1;
    if (is_default) {
      await client.query('UPDATE scenario SET is_default = FALSE WHERE household_id = $1', [householdId]);
    }
    const ins = await client.query(
      `INSERT INTO scenario (household_id, name, description, is_default)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [householdId, String(name).trim(), description || null, !!is_default]
    );
    const scenarioId = ins.rows[0].id;
    const snapshot = await captureHouseholdSnapshot(client);
    await client.query('UPDATE scenario SET base_household_snapshot = $2 WHERE id = $1', [
      scenarioId,
      JSON.stringify(snapshot),
    ]);
    const a = parseScenarioAssumptionBody({ assumptions: assumptions || req.body });
    await client.query(
      `INSERT INTO scenario_assumption (
        scenario_id, retirement_age_p1, retirement_age_p2,
        social_security_claim_age_p1, social_security_claim_age_p2,
        annual_spending_target, inflation_rate, portfolio_return_rate,
        withdrawal_strategy, withdrawal_order_custom, roth_conversion_strategy, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        scenarioId,
        a.retirement_age_p1,
        a.retirement_age_p2,
        a.social_security_claim_age_p1,
        a.social_security_claim_age_p2,
        a.annual_spending_target,
        a.inflation_rate,
        a.portfolio_return_rate,
        a.withdrawal_strategy,
        a.withdrawal_order_custom ? JSON.stringify(a.withdrawal_order_custom) : null,
        a.roth_conversion_strategy,
        a.notes,
      ]
    );
    const rp = roth_plan || {};
    await client.query(
      `INSERT INTO roth_conversion_plan (scenario_id, strategy_type, annual_fixed_amount, target_tax_bracket, max_taxable_income, max_irmaa_income)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        scenarioId,
        rp.strategy_type || a.roth_conversion_strategy || 'none',
        rp.annual_fixed_amount ?? null,
        rp.target_tax_bracket ?? null,
        rp.max_taxable_income ?? null,
        rp.max_irmaa_income ?? null,
      ]
    );
    await client.query('COMMIT');
    res.status(201).json({ ...ins.rows[0], assumptions: a });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating scenario:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Scenario tables missing. Run migrations.' });
    }
    res.status(500).json({ error: error.message || 'Failed to create scenario' });
  } finally {
    client.release();
  }
});

app.get('/api/scenarios/compare', async (req, res) => {
  try {
    const ids = (req.query.ids || '')
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isFinite(n));
    if (!ids.length) {
      return res.status(400).json({ error: 'ids query required (comma-separated scenario ids)' });
    }
    const recompute = req.query.recompute === '1' || req.query.recompute === 'true';
    const bundles = [];
    for (const id of ids) {
      const bundle = await loadScenarioCompareBundle(pool, id, recompute);
      if (bundle) bundles.push(bundle);
    }
    const rows = bundles.map((b) => b.summary);
    const defaultBundle =
      bundles.find((b) => b.summary.scenario_name === 'Baseline') ||
      bundles.find((b) => b.scenario.is_default) ||
      bundles[0];
    const altBundle =
      bundles.find((b) => b.summary.scenario_id !== defaultBundle.summary.scenario_id) || bundles[1];
    const explanation =
      rows.length >= 2 && defaultBundle && altBundle
        ? explainScenarioComparison(defaultBundle.summary, altBundle.summary, {
            baselineRows: defaultBundle.byYear,
            altRows: altBundle.byYear,
          })
        : null;
    res.json({ scenarios: rows, explanation });
  } catch (error) {
    console.error('Error comparing scenarios:', error);
    res.status(500).json({ error: error.message || 'Failed to compare scenarios' });
  }
});

app.get('/api/scenarios/compare/explain', async (req, res) => {
  try {
    const ids = (req.query.ids || '')
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isFinite(n));
    if (ids.length < 2) {
      return res.status(400).json({ error: 'ids query required with at least two scenario ids' });
    }
    const recompute = req.query.recompute === '1' || req.query.recompute === 'true';
    const bundles = [];
    for (const id of ids) {
      const bundle = await loadScenarioCompareBundle(pool, id, recompute);
      if (bundle) bundles.push(bundle);
    }
    const baseline = bundles[0];
    const comparisons = bundles.slice(1).map((alt) => ({
      vs: alt.summary.scenario_name,
      ...explainScenarioComparison(baseline.summary, alt.summary, {
        baselineRows: baseline.byYear,
        altRows: alt.byYear,
      }),
    }));
    res.json({ baseline: baseline.summary.scenario_name, comparisons });
  } catch (error) {
    console.error('Error explaining scenario comparison:', error);
    res.status(500).json({ error: error.message || 'Failed to explain comparison' });
  }
});

app.get('/api/scenarios/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const scenario = await loadScenario(pool, id);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    const meta = await pool.query(
      'SELECT last_computed_at, description FROM scenario WHERE id = $1',
      [id]
    );
    res.json({
      ...scenario,
      description: meta.rows[0]?.description,
      last_computed_at: meta.rows[0]?.last_computed_at,
    });
  } catch (error) {
    console.error('Error loading scenario:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Scenario tables missing. Run migration 012_scenario_framework.sql.' });
    }
    res.status(500).json({ error: error.message || 'Failed to load scenario' });
  }
});

app.get('/api/scenarios/:id/yearly', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const recompute = req.query.recompute === '1' || req.query.recompute === 'true';
    const computed = await ensureScenarioComputed(pool, id, req.query, { recompute });
    if (!computed.by_year?.length) {
      return res.status(404).json({ error: 'No computed results for this scenario. Run compute first.' });
    }
    res.json({
      scenario_id: id,
      last_computed_at: computed.last_computed_at || new Date().toISOString(),
      from_cache: !!computed.from_cache,
      by_year: computed.by_year,
    });
  } catch (error) {
    console.error('Error loading scenario yearly results:', error);
    res.status(500).json({ error: error.message || 'Failed to load yearly results' });
  }
});

app.put('/api/scenarios/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, is_default } = req.body;
    const hh = await pool.query('SELECT id FROM household ORDER BY id LIMIT 1');
    const householdId = hh.rows[0]?.id || 1;
    if (is_default) {
      await pool.query('UPDATE scenario SET is_default = FALSE WHERE household_id = $1', [householdId]);
    }
    const result = await pool.query(
      `UPDATE scenario SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        is_default = COALESCE($4, is_default),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, name != null ? String(name).trim() : null, description, is_default]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Scenario not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating scenario:', error);
    res.status(500).json({ error: error.message || 'Failed to update scenario' });
  }
});

app.put('/api/scenarios/:id/assumptions', async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    const a = parseScenarioAssumptionBody(req.body);
    const rp = req.body.roth_plan;
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO scenario_assumption (
        scenario_id, retirement_age_p1, retirement_age_p2,
        social_security_claim_age_p1, social_security_claim_age_p2,
        annual_spending_target, inflation_rate, portfolio_return_rate,
        withdrawal_strategy, withdrawal_order_custom, roth_conversion_strategy, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (scenario_id) DO UPDATE SET
        retirement_age_p1 = EXCLUDED.retirement_age_p1,
        retirement_age_p2 = EXCLUDED.retirement_age_p2,
        social_security_claim_age_p1 = EXCLUDED.social_security_claim_age_p1,
        social_security_claim_age_p2 = EXCLUDED.social_security_claim_age_p2,
        annual_spending_target = EXCLUDED.annual_spending_target,
        inflation_rate = EXCLUDED.inflation_rate,
        portfolio_return_rate = EXCLUDED.portfolio_return_rate,
        withdrawal_strategy = EXCLUDED.withdrawal_strategy,
        withdrawal_order_custom = EXCLUDED.withdrawal_order_custom,
        roth_conversion_strategy = EXCLUDED.roth_conversion_strategy,
        notes = EXCLUDED.notes`,
      [
        id,
        a.retirement_age_p1,
        a.retirement_age_p2,
        a.social_security_claim_age_p1,
        a.social_security_claim_age_p2,
        a.annual_spending_target,
        a.inflation_rate,
        a.portfolio_return_rate,
        a.withdrawal_strategy,
        a.withdrawal_order_custom ? JSON.stringify(a.withdrawal_order_custom) : null,
        a.roth_conversion_strategy,
        a.notes,
      ]
    );
    if (rp || a.roth_conversion_strategy) {
      await client.query(
        `INSERT INTO roth_conversion_plan (scenario_id, strategy_type, annual_fixed_amount, target_tax_bracket, max_taxable_income, max_irmaa_income)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (scenario_id) DO UPDATE SET
           strategy_type = EXCLUDED.strategy_type,
           annual_fixed_amount = EXCLUDED.annual_fixed_amount,
           target_tax_bracket = EXCLUDED.target_tax_bracket,
           max_taxable_income = EXCLUDED.max_taxable_income,
           max_irmaa_income = EXCLUDED.max_irmaa_income,
           modified = CURRENT_TIMESTAMP`,
        [
          id,
          rp?.strategy_type || a.roth_conversion_strategy || 'none',
          rp?.annual_fixed_amount ?? null,
          rp?.target_tax_bracket ?? null,
          rp?.max_taxable_income ?? null,
          rp?.max_irmaa_income ?? null,
        ]
      );
    }
    await client.query('UPDATE scenario SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ scenario_id: id, assumptions: a });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating scenario assumptions:', error);
    res.status(500).json({ error: error.message || 'Failed to update assumptions' });
  } finally {
    client.release();
  }
});

app.delete('/api/scenarios/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const check = await pool.query('SELECT is_default FROM scenario WHERE id = $1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Scenario not found' });
    const count = await pool.query('SELECT COUNT(*)::int AS c FROM scenario');
    if (check.rows[0].is_default && count.rows[0].c <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only scenario' });
    }
    await pool.query('DELETE FROM scenario WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting scenario:', error);
    res.status(500).json({ error: error.message || 'Failed to delete scenario' });
  }
});

app.post('/api/scenarios/:id/compute', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await runScenario(pool, id, req.query);
    res.json({
      scenario_id: id,
      last_computed_at: new Date().toISOString(),
      summary: summarizeScenarioProjection(data),
      by_year: data.by_year,
    });
  } catch (error) {
    console.error('Error computing scenario:', error);
    res.status(500).json({ error: error.message || 'Failed to compute scenario' });
  }
});

// ==================== ACCOUNT TAX PROFILE ====================

app.get('/api/accounts/:id/tax-profile', async (req, res) => {
  try {
    const id = parsePositiveIntParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid account id' });
    }
    const result = await pool.query('SELECT * FROM account_tax_profile WHERE account_id = $1', [id]);
    if (!result.rows.length) return res.json(null);
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '42P01') return res.json(null);
    res.status(500).json({ error: error.message || 'Failed to fetch tax profile' });
  }
});

app.put('/api/accounts/:id/tax-profile', async (req, res) => {
  try {
    const id = parsePositiveIntParam(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid account id' });
    }
    const { cost_basis, unrealized_gain_percent, dividend_yield, qualified_dividend_percent } = req.body;
    const result = await pool.query(
      `INSERT INTO account_tax_profile (account_id, cost_basis, unrealized_gain_percent, dividend_yield, qualified_dividend_percent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (account_id) DO UPDATE SET
         cost_basis = EXCLUDED.cost_basis,
         unrealized_gain_percent = EXCLUDED.unrealized_gain_percent,
         dividend_yield = EXCLUDED.dividend_yield,
         qualified_dividend_percent = EXCLUDED.qualified_dividend_percent,
         modified = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        id,
        cost_basis != null && cost_basis !== '' ? parseFloat(cost_basis) : null,
        unrealized_gain_percent != null && unrealized_gain_percent !== ''
          ? parseFloat(unrealized_gain_percent)
          : null,
        dividend_yield != null && dividend_yield !== '' ? parseFloat(dividend_yield) : null,
        qualified_dividend_percent != null && qualified_dividend_percent !== ''
          ? parseFloat(qualified_dividend_percent)
          : 100,
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Run migration 013_account_tax_profile.sql' });
    }
    res.status(500).json({ error: error.message || 'Failed to save tax profile' });
  }
});

// ==================== PROJECTIONS (Stage 4 — net worth & income/expenses by year) ====================

app.get('/api/projections', async (req, res) => {
  try {
    const data = await runProjection(pool, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error computing projections:', error);
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'Tables do not exist. Run database/schema.sql on your retirementhub database.' });
    }
    res.status(500).json({ error: error.message || 'Failed to compute projections' });
  }
});
// ==================== HEALTH ====================

app.get('/api/health', (req, res) => {
  const payload = {
    status: isReady ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || 'dev',
    balance_api: 5,
    account_balance_columns: accountBalanceColumnTypes,
  };
  if (isReady) {
    res.status(200).json(payload);
  } else {
    res.status(503).json(payload);
  }
});

function startServer(portToUse = port) {
  return app.listen(portToUse, () => {
    console.log(`Server running on port ${portToUse}`);
    isReady = true;
  });
}

if (require.main === module) {
  startServer();
} else {
  module.exports = { app, startServer };
}
