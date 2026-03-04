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
    const { p1_display_name, p2_display_name, p1_birth_year, p2_birth_year, filing_status } = req.body;
    const result = await pool.query(
      `UPDATE household SET
        p1_display_name = COALESCE($1, p1_display_name),
        p2_display_name = COALESCE($2, p2_display_name),
        p1_birth_year = COALESCE($3, p1_birth_year),
        p2_birth_year = COALESCE($4, p2_birth_year),
        filing_status = COALESCE($5, filing_status),
        modified = CURRENT_TIMESTAMP
       WHERE id = (SELECT id FROM household LIMIT 1)
       RETURNING *`,
      [
        p1_display_name != null ? String(p1_display_name).trim() : null,
        p2_display_name != null ? String(p2_display_name).trim() : null,
        p1_birth_year != null ? parseInt(p1_birth_year, 10) : null,
        p2_birth_year != null ? parseInt(p2_birth_year, 10) : null,
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
    const { id, as_of, gross_salary, gross_salary_p2, expected_raise_pct, bonus_quarterly, four_o_one_k_pct, four_o_one_k_match_pct } = req.body;
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
          modified = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING *`,
        [
          as_of && String(as_of).trim() ? String(as_of).trim() : null,
          gross_salary != null ? parseFloat(gross_salary) : null,
          gross_salary_p2 != null ? parseFloat(gross_salary_p2) : null,
          expected_raise_pct != null ? parseFloat(expected_raise_pct) : null,
          bonus_quarterly != null ? parseFloat(bonus_quarterly) : null,
          four_o_one_k_pct != null ? parseFloat(four_o_one_k_pct) : null,
          four_o_one_k_match_pct != null ? parseFloat(four_o_one_k_match_pct) : null,
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

// ==================== EXPENSE LINES ====================
// Returns latest as_of per category; multiple rows per category allowed for history.

app.get('/api/expense-lines', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (el.expense_category_id) el.*, ec.name AS category_name, ec.category_group
       FROM expense_line el
       JOIN expense_category ec ON el.expense_category_id = ec.id
       ORDER BY el.expense_category_id, el.as_of DESC, el.id DESC`
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

      try {
        await pool.query(
          `INSERT INTO expense_line (expense_category_id, as_of, current_monthly, retirement_monthly, actual_annual)
           VALUES ($1, $2, 0, NULL, $3)
           ON CONFLICT (expense_category_id, as_of) DO UPDATE SET
             actual_annual = EXCLUDED.actual_annual,
             modified = CURRENT_TIMESTAMP`,
          [cat.id, asOf, amount]
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

// ==================== BUDGET SUMMARY (computed) ====================

app.get('/api/budget-summary', async (req, res) => {
  try {
    const linesResult = await pool.query(
      `SELECT el.current_monthly, el.retirement_monthly
       FROM (SELECT DISTINCT ON (expense_category_id) expense_category_id, current_monthly, retirement_monthly
             FROM expense_line ORDER BY expense_category_id, as_of DESC, id DESC) el
       JOIN expense_category ec ON el.expense_category_id = ec.id`
    );
    let currentAnnual = 0;
    let retirementAnnual = 0;
    for (const row of linesResult.rows) {
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
