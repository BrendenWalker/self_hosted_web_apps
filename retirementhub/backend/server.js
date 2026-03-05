const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse: parseCsv } = require('csv-parse/sync');
const { createDbPool, testConnection } = require('../../common/database/db-config');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 80;

let isReady = false;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const pool = createDbPool({
  database: process.env.DB_NAME || 'retirementhub',
});

testConnection(pool);

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
    const { p1_display_name, p2_display_name, p1_birth_year, p2_birth_year, p1_retirement_date, p2_retirement_date, p1_ss_monthly_estimate, p2_ss_monthly_estimate, p1_ss_at_fra, p2_ss_at_fra, filing_status } = req.body;
    const result = await pool.query(
      `UPDATE household SET
        p1_display_name = COALESCE($1, p1_display_name),
        p2_display_name = COALESCE($2, p2_display_name),
        p1_birth_year = COALESCE($3, p1_birth_year),
        p2_birth_year = COALESCE($4, p2_birth_year),
        p1_retirement_date = $5,
        p2_retirement_date = $6,
        p1_ss_monthly_estimate = $7,
        p2_ss_monthly_estimate = $8,
        p1_ss_at_fra = $9,
        p2_ss_at_fra = $10,
        filing_status = COALESCE($11, filing_status),
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
    const result = await pool.query('SELECT * FROM account WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch account' });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const { name, account_type, owner_type, sort_order } = req.body;
    const trimmedName = name != null ? String(name).trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ error: 'Account name is required' });
    }
    const result = await pool.query(
      `INSERT INTO account (name, account_type, owner_type, sort_order)
       VALUES ($1, $2, COALESCE($3, 'joint'), COALESCE($4, 0))
       RETURNING *`,
      [trimmedName, account_type || 'taxable', owner_type || 'joint', sort_order != null ? parseInt(sort_order, 10) : 0]
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
    const { name, account_type, owner_type, sort_order } = req.body;
    const trimmedName = name != null ? String(name).trim() : null;
    const result = await pool.query(
      `UPDATE account SET
        name = COALESCE($1, name),
        account_type = COALESCE($2, account_type),
        owner_type = COALESCE($3, owner_type),
        sort_order = COALESCE($4, sort_order),
        modified = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        trimmedName,
        account_type != null ? String(account_type).trim() : null,
        owner_type != null ? String(owner_type).trim() : null,
        sort_order != null ? parseInt(sort_order, 10) : null,
        parseInt(req.params.id, 10),
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
    const result = await pool.query('DELETE FROM account WHERE id = $1 RETURNING *', [req.params.id]);
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
      `SELECT DISTINCT ON (ab.account_id) ab.*, a.name AS account_name, a.account_type, a.owner_type
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
  try {
    const result = await pool.query(
      `SELECT ab.* FROM account_balance ab WHERE ab.account_id = $1 ORDER BY ab.as_of DESC, ab.id DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching account balances:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch account balances' });
  }
});

app.post('/api/account-balances', async (req, res) => {
  try {
    const { account_id, as_of, balance } = req.body;
    const accountId = account_id != null ? parseInt(account_id, 10) : null;
    if (!accountId || !Number.isInteger(accountId)) {
      return res.status(400).json({ error: 'account_id is required' });
    }
    const asOfDate = as_of && String(as_of).trim() ? String(as_of).trim() : new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `INSERT INTO account_balance (account_id, as_of, balance)
       VALUES ($1, $2, COALESCE($3, 0))
       ON CONFLICT (account_id, as_of) DO UPDATE SET balance = EXCLUDED.balance, modified = CURRENT_TIMESTAMP
       RETURNING *`,
      [accountId, asOfDate, balance != null ? parseFloat(balance) : 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating account balance:', error);
    res.status(500).json({ error: error.message || 'Failed to create account balance' });
  }
});

app.put('/api/account-balances/:id', async (req, res) => {
  try {
    const { as_of, balance } = req.body;
    const result = await pool.query(
      `UPDATE account_balance SET
        as_of = COALESCE($1, as_of),
        balance = COALESCE($2, balance),
        modified = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [
        as_of && String(as_of).trim() ? String(as_of).trim() : null,
        balance != null ? parseFloat(balance) : null,
        parseInt(req.params.id, 10),
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account balance not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating account balance:', error);
    res.status(500).json({ error: error.message || 'Failed to update account balance' });
  }
});

app.delete('/api/account-balances/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM account_balance WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account balance not found' });
    }
    res.json({ message: 'Account balance deleted' });
  } catch (error) {
    console.error('Error deleting account balance:', error);
    res.status(500).json({ error: error.message || 'Failed to delete account balance' });
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
// IRS annual limits by year. Update annually; values for 2024–2026.

const SAVINGS_LIMITS_BY_YEAR = {
  2024: {
    ira: 7000,
    ira_catch_up: 1000,
    hsa_individual: 4150,
    hsa_family: 8300,
    hsa_catch_up: 1000,
    '401k_elective': 23000,
    '401k_catch_up': 7500,
  },
  2025: {
    ira: 7000,
    ira_catch_up: 1000,
    hsa_individual: 4300,
    hsa_family: 8550,
    hsa_catch_up: 1000,
    '401k_elective': 23500,
    '401k_catch_up': 7500,
  },
  2026: {
    ira: 7500,
    ira_catch_up: 1100,
    hsa_individual: 4400,
    hsa_family: 8750,
    hsa_catch_up: 1000,
    '401k_elective': 24500,
    '401k_catch_up': 8000,
  },
};

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
      const base = SAVINGS_LIMITS_BY_YEAR[yearParam] || SAVINGS_LIMITS_BY_YEAR[2025];
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
    for (const [yStr, base] of Object.entries(SAVINGS_LIMITS_BY_YEAR)) {
      const y = parseInt(yStr, 10);
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
// Helps set Federal, Medicare, and Social Security expense categories for retirement.
// SS (OASDI): not withheld on benefits → 0 in retirement.
// Medicare: payroll tax pre-retirement; Part B (and Part D) premiums after — use Part B table.
// Federal: still owed on taxable income (taxable SS + withdrawals, etc.); optional estimator below.

const MEDICARE_PART_B_MONTHLY_BY_YEAR = {
  2024: 174.70,
  2025: 185.00,
  2026: 193.00, // approximate; CMS publishes annually
  2027: 201.00,
  2028: 209.00,
  2029: 218.00,
  2030: 227.00,
};
function getPartBForYear(year) {
  const y = year != null ? parseInt(year, 10) : new Date().getFullYear();
  if (MEDICARE_PART_B_MONTHLY_BY_YEAR[y] != null) return MEDICARE_PART_B_MONTHLY_BY_YEAR[y];
  const years = Object.keys(MEDICARE_PART_B_MONTHLY_BY_YEAR).map(Number).sort((a, b) => a - b);
  const lastYear = years[years.length - 1];
  const firstYear = years[0];
  if (y <= firstYear) return MEDICARE_PART_B_MONTHLY_BY_YEAR[firstYear];
  const lastPremium = MEDICARE_PART_B_MONTHLY_BY_YEAR[lastYear];
  const annualIncrease = 0.05;
  return Math.round(lastPremium * Math.pow(1 + annualIncrease, y - lastYear) * 100) / 100;
}

const FEDERAL_BRACKETS_MFJ = [
  { max: 23850, rate: 0.10 },
  { max: 96950, rate: 0.12 },
  { max: 206700, rate: 0.22 },
  { max: 394600, rate: 0.24 },
  { max: 501050, rate: 0.32 },
  { max: 751600, rate: 0.35 },
  { max: Infinity, rate: 0.37 },
];
const STANDARD_DEDUCTION_MFJ_2025 = 30000;
const STANDARD_DEDUCTION_BY_YEAR = { 2024: 29200, 2025: 30000, 2026: 31000 };
function getStandardDeduction(year) {
  const y = year != null ? parseInt(year, 10) : 2025;
  return STANDARD_DEDUCTION_BY_YEAR[y] || STANDARD_DEDUCTION_MFJ_2025 + (y - 2025) * 1000;
}
function estimateFederalTax(taxableIncome, year, filingStatus) {
  const deduction = filingStatus === 'married_filing_jointly' ? getStandardDeduction(year) : 25000;
  const afterDeduction = Math.max(0, (taxableIncome || 0) - deduction);
  let tax = 0;
  let prev = 0;
  for (const b of FEDERAL_BRACKETS_MFJ) {
    const taxableInBracket = Math.max(0, Math.min(b.max, afterDeduction) - prev);
    if (taxableInBracket <= 0) break;
    tax += taxableInBracket * b.rate;
    if (afterDeduction <= b.max) break;
    prev = b.max;
  }
  return Math.round(tax * 100) / 100;
}

app.get('/api/retirement-tax-guide', async (req, res) => {
  try {
    const yearParam = req.query.year != null ? parseInt(String(req.query.year).trim(), 10) : null;
    const taxableIncomeParam = req.query.taxable_income != null ? parseFloat(String(req.query.taxable_income).trim()) : null;
    const filingParam = req.query.filing_status || 'married_filing_jointly';
    const year = Number.isFinite(yearParam) && yearParam >= 2024 && yearParam <= 2050 ? yearParam : new Date().getFullYear();

    const partBMonthly = getPartBForYear(year);
    const partBByYear = {};
    for (let y = 2024; y <= Math.min(year + 30, 2040); y++) {
      partBByYear[y] = getPartBForYear(y);
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
      const estimatedAnnual = estimateFederalTax(taxableIncomeParam, year, filingParam);
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

// ==================== PROJECTIONS (Stage 4 — net worth & income/expenses by year) ====================

/** Parse calendar year from a date: accepts Date object or YYYY-MM-DD string (node-pg can return either). */
function yearFromDate(value) {
  if (value == null) return null;
  if (typeof value.getFullYear === 'function') return value.getFullYear();
  const s = String(value).trim();
  const fourDigit = s.match(/^(\d{4})/);
  if (fourDigit) return parseInt(fourDigit[1], 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.getFullYear();
  return null;
}

function ageAtEoy(birthYear, year) {
  if (birthYear == null || !Number.isInteger(birthYear)) return null;
  return year - birthYear;
}

// SSA-style factors for FRA 67: 62 ≈ 70%, 67 = 100%, 70 ≈ 124%. Returns factor for a given age.
function ssFactorForAge(age) {
  if (age == null || !Number.isInteger(age)) return null;
  const a = Math.min(70, Math.max(62, age));
  if (a <= 67) return 0.70 + (a - 62) * (0.30 / 5);
  return 1.0 + (a - 67) * (0.24 / 3);
}

// SSA-style factors for FRA 67: 62 ≈ 70%, 67 = 100%, 70 ≈ 124%. Returns monthly benefit at retirement age or null.
function ssMonthlyAtRetirementAge(atFraMonthly, birthYear, retirementYear) {
  if (atFraMonthly == null || !Number.isFinite(atFraMonthly) || atFraMonthly <= 0) return null;
  const by = birthYear != null ? parseInt(birthYear, 10) : null;
  const ry = retirementYear != null ? parseInt(retirementYear, 10) : null;
  if (by == null || ry == null || !Number.isInteger(by) || !Number.isInteger(ry)) return null;
  let age = ry - by;
  if (age < 62) age = 62;
  if (age > 70) age = 70;
  const factor = ssFactorForAge(age);
  return factor != null ? Math.round(atFraMonthly * factor * 100) / 100 : null;
}

function buildPartyLimitsForYear(birthYear, base, year) {
  const age = ageAtEoy(birthYear, year);
  const iraCatchUp = age != null && age >= 50 ? (base.ira_catch_up || 0) : 0;
  const k401CatchUp = age != null && age >= 50 ? (base['401k_catch_up'] || 0) : 0;
  return {
    '401k_elective_limit': (base['401k_elective'] || 0) + k401CatchUp,
  };
}

app.get('/api/projections', async (req, res) => {
  try {
    const allowZeroRates = !!process.env.DEBUG;
    const yearsParam = req.query.years != null ? parseInt(String(req.query.years).trim(), 10) : 30;
    const growthPctParam = req.query.growth_pct != null ? parseFloat(String(req.query.growth_pct).trim()) : 5;
    const expenseColaParam = req.query.expense_cola_pct != null ? parseFloat(String(req.query.expense_cola_pct).trim()) : 2.5;
    const horizonYears = Number.isFinite(yearsParam) && yearsParam >= 1 && yearsParam <= 50 ? yearsParam : 30;
    const minGrowth = allowZeroRates ? 0 : 0.01;
    const minCola = allowZeroRates ? 0 : 0.01;
    const growthPct = Number.isFinite(growthPctParam) && growthPctParam >= minGrowth && growthPctParam <= 20 ? growthPctParam : 5;
    const expenseColaPct = Number.isFinite(expenseColaParam) && expenseColaParam >= minCola && expenseColaParam <= 10 ? expenseColaParam : 2.5;
    const expenseColaFactor = 1 + expenseColaPct / 100;

    const now = new Date();
    const startYear = now.getFullYear();

    const [householdRes, incomeRes, balancesRes, summaryRes] = await Promise.all([
      pool.query('SELECT p1_display_name, p2_display_name, p1_birth_year, p2_birth_year, p1_retirement_date, p2_retirement_date, p1_ss_at_fra, p2_ss_at_fra FROM household ORDER BY id LIMIT 1'),
      pool.query('SELECT * FROM income ORDER BY as_of DESC, id DESC LIMIT 1'),
      pool.query(
        `SELECT DISTINCT ON (ab.account_id) ab.balance, a.name AS account_name
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
    ]);

    const household = householdRes.rows[0] || null;
    const income = incomeRes.rows[0] || null;
    const p1BirthYear = household?.p1_birth_year != null ? parseInt(household.p1_birth_year, 10) : null;
    const p2BirthYear = household?.p2_birth_year != null ? parseInt(household.p2_birth_year, 10) : null;

    const p1RetirementYear = yearFromDate(household?.p1_retirement_date);
    const p2RetirementYear = yearFromDate(household?.p2_retirement_date);
    const retirementYear = (p1RetirementYear != null || p2RetirementYear != null)
      ? Math.max(p1RetirementYear ?? 0, p2RetirementYear ?? 0)
      : null;

    const p1AtFraRaw = household?.p1_ss_at_fra != null && household.p1_ss_at_fra !== '' ? parseFloat(household.p1_ss_at_fra) : null;
    const p2AtFraRaw = household?.p2_ss_at_fra != null && household.p2_ss_at_fra !== '' ? parseFloat(household.p2_ss_at_fra) : null;
    const p1SsFromAtFra = Number.isFinite(p1AtFraRaw) ? ssMonthlyAtRetirementAge(p1AtFraRaw, p1BirthYear, p1RetirementYear) : null;
    const p2SsFromAtFra = Number.isFinite(p2AtFraRaw) ? ssMonthlyAtRetirementAge(p2AtFraRaw, p2BirthYear, p2RetirementYear) : null;

    const p1SsMonthly = p1SsFromAtFra != null ? p1SsFromAtFra : 0;
    const grossP2 = income ? parseFloat(income.gross_salary_p2) || 0 : 0;
    const p2HasNoEarnings = grossP2 === 0 || income?.gross_salary_p2 == null || income.gross_salary_p2 === '';
    const p2AgeAtRetirement = p2BirthYear != null && p2RetirementYear != null ? Math.min(70, Math.max(62, p2RetirementYear - p2BirthYear)) : null;
    const p2UsesSpousal = p2HasNoEarnings && p2SsFromAtFra == null && Number.isFinite(p1AtFraRaw) && p1AtFraRaw > 0 && p2AgeAtRetirement != null;
    const p2SsMonthly = p2UsesSpousal
      ? Math.round(0.5 * p1AtFraRaw * ssFactorForAge(p2AgeAtRetirement) * 100) / 100
      : (p2SsFromAtFra != null ? p2SsFromAtFra : 0);
    const p1SsAnnual = p1SsMonthly * 12;
    const p2SsAnnual = p2SsMonthly * 12;

    let currentAnnual = 0;
    let retirementAnnual = 0;
    const p2HealthUntilMedicareMonthly = [];
    for (const row of summaryRes.rows) {
      const catType = row.category_type || 'regular';
      if (catType === 'p2_health_until_medicare') {
        const retVal = row.retirement_monthly != null ? parseFloat(row.retirement_monthly) : null;
        if (retVal != null && retVal > 0) {
          p2HealthUntilMedicareMonthly.push(retVal);
        }
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
    const target25xRetirement = Math.round(retirementAnnual * 25 * 100) / 100;

    let startingNetWorth = 0;
    for (const row of balancesRes.rows) {
      startingNetWorth += parseFloat(row.balance) || 0;
    }
    startingNetWorth = Math.round(startingNetWorth * 100) / 100;

    const grossP1 = income ? parseFloat(income.gross_salary) || 0 : 0;
    const grossP2Num = income ? parseFloat(income.gross_salary_p2) || 0 : 0;
    // Expenses switch to retirement amounts when the primary income provider retires (so if one party has 0 income, switch when the earner retires).
    const primaryEarnerRetirementYear = (grossP1 > 0 && grossP2Num === 0) ? p1RetirementYear
      : (grossP2Num > 0 && grossP1 === 0) ? p2RetirementYear
      : (grossP1 >= grossP2Num ? p1RetirementYear : p2RetirementYear);
    const expenseRetirementYear = primaryEarnerRetirementYear ?? p1RetirementYear ?? p2RetirementYear;
    const MEDICARE_AGE = 65;
    const p2MedicareYear = p2BirthYear != null ? p2BirthYear + MEDICARE_AGE : null;

    const raisePct = income && income.expected_raise_pct != null ? parseFloat(income.expected_raise_pct) / 100 : 0;
    const bonusQuarterly = income ? parseFloat(income.bonus_quarterly) || 0 : 0;
    const fourOOneKPctP1 = income && income.four_o_one_k_pct != null ? parseFloat(income.four_o_one_k_pct) / 100 : 0;
    const fourOOneKPctP2 = income && income.four_o_one_k_pct_p2 != null ? parseFloat(income.four_o_one_k_pct_p2) / 100 : 0;
    const matchPctP1 = income && income.four_o_one_k_match_pct != null ? parseFloat(income.four_o_one_k_match_pct) / 100 : 0;
    const matchPctP2 = income && income.four_o_one_k_match_pct_p2 != null ? parseFloat(income.four_o_one_k_match_pct_p2) / 100 : 0;

    const endYear = startYear + horizonYears;
    const byYear = [];
    let netWorth = startingNetWorth;
    const growthFactor = 1 + growthPct / 100;

    for (let y = startYear; y <= endYear; y++) {
      const p1Retired = p1RetirementYear != null && y >= p1RetirementYear;
      const p2Retired = p2RetirementYear != null && y >= p2RetirementYear;
      const isRetired = retirementYear != null && y >= retirementYear;
      const yearsFromStart = y - startYear;
      const raiseFactor = 1 + (yearsFromStart > 0 ? Math.pow(1 + raisePct, yearsFromStart) - 1 : 0);

      let salaryP1 = grossP1 * (y === startYear ? 1 : raiseFactor);
      let salaryP2 = grossP2Num * (y === startYear ? 1 : raiseFactor);
      const wageIncome = (p1Retired ? 0 : salaryP1) + (p2Retired ? 0 : salaryP2);
      const bonusAnnual = (expenseRetirementYear != null && y >= expenseRetirementYear) ? 0 : bonusQuarterly * 4;
      const ssColaYearsP1 = p1Retired && p1RetirementYear != null ? Math.max(0, y - p1RetirementYear) : 0;
      const ssColaYearsP2 = p2Retired && p2RetirementYear != null ? Math.max(0, y - p2RetirementYear) : 0;
      const annualSsP1 = p1Retired ? p1SsAnnual * Math.pow(expenseColaFactor, ssColaYearsP1) : 0;
      const annualSsP2 = p2Retired ? p2SsAnnual * Math.pow(expenseColaFactor, ssColaYearsP2) : 0;
      const totalSs = annualSsP1 + annualSsP2;
      const incomeAmount = Math.round((wageIncome + bonusAnnual + totalSs) * 100) / 100;
      const expensesUseRetirement = expenseRetirementYear != null && y >= expenseRetirementYear;
      const expenseBase = expensesUseRetirement ? retirementAnnual : currentAnnual;
      const expenseGrowthYears = expensesUseRetirement && expenseRetirementYear != null ? y - expenseRetirementYear : y - startYear;
      let expensesAmount = Math.round(expenseBase * Math.pow(expenseColaFactor, Math.max(0, expenseGrowthYears)) * 100) / 100;
      const inP2HealthBridge = p1RetirementYear != null && p2MedicareYear != null && y >= p1RetirementYear && y < p2MedicareYear;
      if (inP2HealthBridge && p2HealthUntilMedicareMonthly.length > 0) {
        const bridgeColaYears = y - p1RetirementYear;
        let bridgeAnnual = 0;
        for (const monthly of p2HealthUntilMedicareMonthly) {
          bridgeAnnual += monthly * 12 * Math.pow(expenseColaFactor, Math.max(0, bridgeColaYears));
        }
        expensesAmount = Math.round((expensesAmount + bridgeAnnual) * 100) / 100;
      }
      let savingsAmount = incomeAmount - expensesAmount;

      let contributions401k = 0;
      if (!isRetired) {
        const base = SAVINGS_LIMITS_BY_YEAR[y] || SAVINGS_LIMITS_BY_YEAR[2026] || SAVINGS_LIMITS_BY_YEAR[2025];
        const limP1 = buildPartyLimitsForYear(p1BirthYear, base, y);
        const limP2 = buildPartyLimitsForYear(p2BirthYear, base, y);
        const plannedP1 = Math.min(salaryP1 * fourOOneKPctP1 + salaryP1 * matchPctP1, limP1['401k_elective_limit'] || 1e9);
        const plannedP2 = Math.min(salaryP2 * fourOOneKPctP2 + salaryP2 * matchPctP2, limP2['401k_elective_limit'] || 1e9);
        contributions401k = (plannedP1 || 0) + (plannedP2 || 0);
      }

      netWorth = netWorth * growthFactor + savingsAmount;
      netWorth = Math.round(netWorth * 100) / 100;

      byYear.push({
        year: y,
        net_worth: netWorth,
        income: incomeAmount,
        expenses: expensesAmount,
        savings: savingsAmount,
        contributions_401k: Math.round(contributions401k * 100) / 100,
        is_retired: isRetired,
        p1_retired: p1Retired,
        p2_retired: p2Retired,
        income_ss_p1: Math.round(annualSsP1 * 100) / 100,
        income_ss_p2: Math.round(annualSsP2 * 100) / 100,
      });
    }

    let year_reaches_target = null;
    for (const row of byYear) {
      if (row.net_worth >= target25xRetirement) {
        year_reaches_target = row.year;
        break;
      }
    }

    res.json({
      start_year: startYear,
      end_year: endYear,
      growth_pct: growthPct,
      expense_cola_pct: expenseColaPct,
      target_25x_retirement: target25xRetirement,
      retirement_year: retirementYear,
      starting_net_worth: startingNetWorth,
      current_annual: Math.round(currentAnnual * 100) / 100,
      retirement_annual: Math.round(retirementAnnual * 100) / 100,
      by_year: byYear,
      year_reaches_target: year_reaches_target,
      household: household ? { p1_display_name: household.p1_display_name || 'P1', p2_display_name: household.p2_display_name || 'P2' } : null,
      projection_meta: {
        p1_retirement_year: p1RetirementYear,
        p2_retirement_year: p2RetirementYear,
        p1_ss_monthly_used: p1SsMonthly,
        p2_ss_monthly_used: p2SsMonthly,
        p2_uses_spousal: p2UsesSpousal,
        expense_retirement_year: expenseRetirementYear,
      },
    });
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
  };
  if (isReady) {
    res.status(200).json(payload);
  } else {
    res.status(503).json(payload);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  isReady = true;
});
