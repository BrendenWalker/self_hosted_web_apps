# Milestone 1 — Tax Parameter Foundation

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all annually variable IRS values out of `backend/server.js` into PostgreSQL, expose a "Tax Details" page where the user can view/edit them, with the refactor proven behavior-identical to the current implementation.

**Architecture:**
- New tables in Postgres for standard deduction, brackets, contribution limits, Medicare Part B, indexed by `(year, filing_status, …)` with a `source` column tracking `seeded` vs `user_edited`.
- New service `backend/services/taxParameters.js` is the only thing in the backend that reads these tables. All current inline constants in `server.js` are replaced with service calls.
- A new React page `TaxDetailsPage.jsx` provides edit-in-place over the parameter rows for a selected year, with per-year reset to seeded defaults.
- A snapshot test of three endpoints (`/api/projections`, `/api/savings-limits`, `/api/retirement-tax-guide`) is captured **before** the refactor and used as the regression gate.

**Tech Stack:** Postgres, Node/Express, Jest + supertest (backend), React + Vitest (frontend), recharts (existing).

**Prerequisite:** Read `docs/implementation_plan.md` (strategic plan) for context on the seeded-and-editable design choice.

---

## File Structure

**Create:**
- `database/migrations/012_tax_parameters.sql` — schema + seed
- `backend/services/taxParameters.js` — DB-backed parameter lookups
- `backend/services/taxParameters.test.js` — unit tests for the service
- `backend/snapshots.test.js` — endpoint snapshot regression tests
- `frontend/src/pages/TaxDetailsPage.jsx` — the new page
- `frontend/src/pages/TaxDetailsPage.test.jsx` — basic render/interaction tests

**Modify:**
- `backend/server.js` — replace inline constants with service calls; add new endpoints
- `frontend/src/api/api.js` — add tax-parameters client methods
- `frontend/src/App.jsx` — add Tax Details route + nav link
- `README.md` — document new migration

---

## Task 1: Lock current behavior with a snapshot test (do FIRST, before any refactor)

**Files:**
- Create: `backend/snapshots.test.js`

- [ ] **Step 1: Write the snapshot test against the unchanged server**

```js
// backend/snapshots.test.js
const request = require('supertest');

// Mock pool identical pattern to server.test.js — see that file for createMockPool / asyncQueryHandler.
// Use a FIXED household: P1 born 1960, P2 born 1962, MFJ, retired 2025/2027.
// Use FIXED account balances and FIXED expense rows so projection output is deterministic.

// (Copy createMockPool + a custom queryHandler that returns fixed fixture rows for:
//  household, income, account, account_balance, expense_line, expense_category, mortgage.)

jest.mock('../../common/database/db-config', () => ({
  createDbPool: () => mockPool,
  testConnection: () => {},
}));

describe('Endpoint snapshots (regression guard)', () => {
  let server;
  beforeAll(() => { server = require('./server').startServer(0); });
  afterAll((done) => server.close(done));

  test('GET /api/savings-limits matches snapshot', async () => {
    const res = await request(server).get('/api/savings-limits');
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  test('GET /api/retirement-tax-guide?year=2026&taxable_income=120000 matches snapshot', async () => {
    const res = await request(server).get('/api/retirement-tax-guide?year=2026&taxable_income=120000');
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });

  test('GET /api/projections matches snapshot', async () => {
    const res = await request(server).get('/api/projections');
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run the test, capturing the baseline snapshots**

```bash
cd backend && npm test -- snapshots.test.js
```

Expected: PASS. A new `backend/__snapshots__/snapshots.test.js.snap` file is written. **Inspect it** to confirm the numbers look right (sanity check: federal_tax brackets for 2025 should match `FEDERAL_ORDINARY_BRACKETS_2025` in server.js).

- [ ] **Step 3: Commit the baseline**

```bash
git add backend/snapshots.test.js backend/__snapshots__/snapshots.test.js.snap
git commit -m "test: lock current tax/projection output with snapshots"
```

---

## Task 2: Schema migration + seed

**Files:**
- Create: `database/migrations/012_tax_parameters.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 012_tax_parameters.sql
-- Move annually variable IRS values from code into DB. See docs/implementation_plan.md (M1).

CREATE TABLE IF NOT EXISTS tax_year (
    year                INTEGER PRIMARY KEY CHECK (year >= 2020 AND year <= 2100),
    status              VARCHAR(20) NOT NULL CHECK (status IN ('published','projected')),
    inflation_pct       DECIMAL(5,2) NOT NULL DEFAULT 2.00,
    notes               TEXT,
    modified            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_standard_deduction (
    year                INTEGER NOT NULL REFERENCES tax_year(year) ON DELETE CASCADE,
    filing_status       VARCHAR(40) NOT NULL
        CHECK (filing_status IN ('single','married_filing_jointly','married_filing_separately','head_of_household')),
    amount              DECIMAL(12,2) NOT NULL,
    age65_add_on        DECIMAL(12,2) NOT NULL DEFAULT 0,
    source              VARCHAR(20) NOT NULL DEFAULT 'seeded' CHECK (source IN ('seeded','user_edited')),
    modified            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (year, filing_status)
);

CREATE TABLE IF NOT EXISTS tax_bracket (
    year                INTEGER NOT NULL REFERENCES tax_year(year) ON DELETE CASCADE,
    filing_status       VARCHAR(40) NOT NULL
        CHECK (filing_status IN ('single','married_filing_jointly','married_filing_separately','head_of_household')),
    ordinal             INTEGER NOT NULL CHECK (ordinal >= 0),
    lower_bound         DECIMAL(14,2) NOT NULL,
    rate                DECIMAL(6,4) NOT NULL CHECK (rate >= 0 AND rate < 1),
    source              VARCHAR(20) NOT NULL DEFAULT 'seeded' CHECK (source IN ('seeded','user_edited')),
    modified            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (year, filing_status, ordinal)
);

CREATE TABLE IF NOT EXISTS tax_contribution_limit (
    year                INTEGER NOT NULL REFERENCES tax_year(year) ON DELETE CASCADE,
    kind                VARCHAR(40) NOT NULL
        CHECK (kind IN ('ira','401k_elective','hsa_individual','hsa_family')),
    base_amount         DECIMAL(12,2) NOT NULL,
    catch_up_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
    source              VARCHAR(20) NOT NULL DEFAULT 'seeded' CHECK (source IN ('seeded','user_edited')),
    modified            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (year, kind)
);

CREATE TABLE IF NOT EXISTS tax_medicare_part_b (
    year                INTEGER PRIMARY KEY REFERENCES tax_year(year) ON DELETE CASCADE,
    monthly_premium     DECIMAL(10,2) NOT NULL,
    source              VARCHAR(20) NOT NULL DEFAULT 'seeded' CHECK (source IN ('seeded','user_edited')),
    modified            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ SEED — values match server.js constants as of 2026-06-04 ============

INSERT INTO tax_year (year, status, inflation_pct, notes) VALUES
    (2024, 'published', 2.00, 'IRS Rev. Proc. 2023-34'),
    (2025, 'published', 2.00, 'IRS Rev. Proc. 2024-40'),
    (2026, 'published', 2.00, 'IRS Rev. Proc. 2025-32 / TCJA post-sunset values')
ON CONFLICT (year) DO NOTHING;

-- Standard deduction (MFJ + single only per M1 scope; add MFS/HoH later if needed)
INSERT INTO tax_standard_deduction (year, filing_status, amount, age65_add_on) VALUES
    (2024, 'married_filing_jointly', 29200, 1550),
    (2025, 'married_filing_jointly', 30000, 1550),  -- matches STANDARD_DEDUCTION_BY_YEAR + projections-side 31500 needs reconciling, see note below
    (2026, 'married_filing_jointly', 31000, 1550),
    (2024, 'single',                 14600, 1950),
    (2025, 'single',                 15000, 1950),
    (2026, 'single',                 15750, 1950)
ON CONFLICT (year, filing_status) DO NOTHING;
-- NOTE: server.js has two slightly different 2025 MFJ standard deductions
--   getStandardDeduction() returns 30000
--   standardDeductionEstimate() base2025.married_filing_jointly = 31500
-- This is a pre-existing bug. The seeded value of 30000 matches IRS Rev. Proc. 2024-40.
-- Task 5 below fixes both call sites to use the DB value.

-- Brackets (MFJ + single only)
-- 2025 MFJ
INSERT INTO tax_bracket (year, filing_status, ordinal, lower_bound, rate) VALUES
    (2025, 'married_filing_jointly', 0,      0.00, 0.10),
    (2025, 'married_filing_jointly', 1,  23850.00, 0.12),
    (2025, 'married_filing_jointly', 2,  96950.00, 0.22),
    (2025, 'married_filing_jointly', 3, 206700.00, 0.24),
    (2025, 'married_filing_jointly', 4, 394600.00, 0.32),
    (2025, 'married_filing_jointly', 5, 501050.00, 0.35),
    (2025, 'married_filing_jointly', 6, 751600.00, 0.37)
ON CONFLICT DO NOTHING;
-- 2025 single
INSERT INTO tax_bracket (year, filing_status, ordinal, lower_bound, rate) VALUES
    (2025, 'single', 0,      0.00, 0.10),
    (2025, 'single', 1,  11925.00, 0.12),
    (2025, 'single', 2,  48475.00, 0.22),
    (2025, 'single', 3, 103350.00, 0.24),
    (2025, 'single', 4, 197300.00, 0.32),
    (2025, 'single', 5, 250525.00, 0.35),
    (2025, 'single', 6, 626350.00, 0.37)
ON CONFLICT DO NOTHING;
-- (Add 2024 and 2026 rows by copying 2025 and adjusting per published IRS tables.
--  Keep this migration self-contained; do not query external sources at runtime.)

-- Contribution limits
INSERT INTO tax_contribution_limit (year, kind, base_amount, catch_up_amount) VALUES
    (2024, 'ira',            7000, 1000),
    (2024, '401k_elective', 23000, 7500),
    (2024, 'hsa_individual', 4150, 1000),
    (2024, 'hsa_family',     8300, 1000),
    (2025, 'ira',            7000, 1000),
    (2025, '401k_elective', 23500, 7500),
    (2025, 'hsa_individual', 4300, 1000),
    (2025, 'hsa_family',     8550, 1000),
    (2026, 'ira',            7500, 1100),
    (2026, '401k_elective', 24500, 8000),
    (2026, 'hsa_individual', 4400, 1000),
    (2026, 'hsa_family',     8750, 1000)
ON CONFLICT DO NOTHING;

-- Medicare Part B
INSERT INTO tax_medicare_part_b (year, monthly_premium) VALUES
    (2024, 174.70),
    (2025, 185.00),
    (2026, 193.00)
ON CONFLICT (year) DO NOTHING;
```

- [ ] **Step 2: Run the migration**

```bash
psql -U postgres -d retirementhub -f database/migrations/012_tax_parameters.sql
```

Expected: no errors. Then verify:

```bash
psql -U postgres -d retirementhub -c "SELECT year, filing_status, amount FROM tax_standard_deduction ORDER BY year, filing_status;"
```

Expected output: 6 rows (2024–2026 × MFJ/single).

- [ ] **Step 3: Commit**

```bash
git add database/migrations/012_tax_parameters.sql
git commit -m "feat(db): add tax parameter tables + 2024-2026 seed"
```

---

## Task 3: Tax parameter service — read path

**Files:**
- Create: `backend/services/taxParameters.js`
- Create: `backend/services/taxParameters.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// backend/services/taxParameters.test.js
const tp = require('./taxParameters');

function makePool(rowsByQuery) {
  return {
    query: jest.fn((sql) => {
      for (const [pattern, rows] of Object.entries(rowsByQuery)) {
        if (sql.includes(pattern)) return Promise.resolve({ rows });
      }
      return Promise.resolve({ rows: [] });
    }),
  };
}

describe('taxParameters service', () => {
  test('getStandardDeduction returns DB value for a published year', async () => {
    const pool = makePool({
      'FROM tax_standard_deduction': [{ amount: '30000', age65_add_on: '1550' }],
    });
    const v = await tp.getStandardDeduction(pool, 2025, 'married_filing_jointly', 60, 60);
    expect(v).toBe(30000);
  });

  test('getStandardDeduction adds age65 add-on for each qualifying spouse (MFJ)', async () => {
    const pool = makePool({
      'FROM tax_standard_deduction': [{ amount: '30000', age65_add_on: '1550' }],
    });
    const v = await tp.getStandardDeduction(pool, 2025, 'married_filing_jointly', 66, 66);
    expect(v).toBe(33100); // 30000 + 1550 + 1550
  });

  test('getStandardDeduction inflates forward when year not in DB', async () => {
    const pool = makePool({
      "SELECT year FROM tax_year WHERE status='published' ORDER BY year DESC LIMIT 1": [{ year: 2026 }],
      'FROM tax_standard_deduction': [{ amount: '31000', age65_add_on: '1550' }],
      'FROM tax_year WHERE year = $1': [{ inflation_pct: '2.00' }],
    });
    const v = await tp.getStandardDeduction(pool, 2030, 'married_filing_jointly', 60, 60);
    // 31000 * 1.02^4 ≈ 33555.39
    expect(v).toBeCloseTo(33555.39, 1);
  });

  test('getFederalBrackets returns ordered bracket array', async () => { /* … */ });
  test('getContributionLimits returns all four kinds for a year', async () => { /* … */ });
  test('getMedicarePartB falls back to last published year + growth when year missing', async () => { /* … */ });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
cd backend && npm test -- taxParameters.test.js
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the service**

```js
// backend/services/taxParameters.js
'use strict';

async function getLatestPublishedYear(pool) {
  const r = await pool.query(
    "SELECT year FROM tax_year WHERE status='published' ORDER BY year DESC LIMIT 1"
  );
  return r.rows[0]?.year ?? null;
}

async function getInflationPct(pool, year) {
  const r = await pool.query('SELECT inflation_pct FROM tax_year WHERE year = $1', [year]);
  return r.rows[0] ? parseFloat(r.rows[0].inflation_pct) : 2.0;
}

function inflationFactor(baseYear, targetYear, pct) {
  const delta = Math.max(0, targetYear - baseYear);
  return Math.pow(1 + pct / 100, delta);
}

async function getStandardDeduction(pool, year, filingStatus, p1Age, p2Age) {
  const fs = filingStatus || 'married_filing_jointly';
  let row = (await pool.query(
    'SELECT amount, age65_add_on FROM tax_standard_deduction WHERE year = $1 AND filing_status = $2',
    [year, fs]
  )).rows[0];

  let amount, addOn;
  if (row) {
    amount = parseFloat(row.amount);
    addOn = parseFloat(row.age65_add_on);
  } else {
    // Inflate from latest published
    const base = await getLatestPublishedYear(pool);
    if (base == null) throw new Error('No published tax year available');
    const baseRow = (await pool.query(
      'SELECT amount, age65_add_on FROM tax_standard_deduction WHERE year = $1 AND filing_status = $2',
      [base, fs]
    )).rows[0];
    if (!baseRow) throw new Error(`No standard deduction for ${fs} in base year ${base}`);
    const pct = await getInflationPct(pool, base);
    const f = inflationFactor(base, year, pct);
    amount = parseFloat(baseRow.amount) * f;
    addOn = parseFloat(baseRow.age65_add_on) * f;
  }

  let total = amount;
  if (fs === 'married_filing_jointly') {
    if (p1Age != null && p1Age >= 65) total += addOn;
    if (p2Age != null && p2Age >= 65) total += addOn;
  } else if (p1Age != null && p1Age >= 65) {
    total += addOn;
  }
  return Math.round(total * 100) / 100;
}

async function getFederalBrackets(pool, year, filingStatus) {
  const fs = filingStatus || 'married_filing_jointly';
  const direct = await pool.query(
    'SELECT ordinal, lower_bound, rate FROM tax_bracket WHERE year=$1 AND filing_status=$2 ORDER BY ordinal',
    [year, fs]
  );
  if (direct.rows.length) {
    return direct.rows.map((r) => ({
      ordinal: r.ordinal,
      lower_bound: parseFloat(r.lower_bound),
      rate: parseFloat(r.rate),
    }));
  }
  const base = await getLatestPublishedYear(pool);
  if (base == null) throw new Error('No published tax year available');
  const baseRows = await pool.query(
    'SELECT ordinal, lower_bound, rate FROM tax_bracket WHERE year=$1 AND filing_status=$2 ORDER BY ordinal',
    [base, fs]
  );
  const pct = await getInflationPct(pool, base);
  const f = inflationFactor(base, year, pct);
  return baseRows.rows.map((r) => ({
    ordinal: r.ordinal,
    lower_bound: parseFloat(r.lower_bound) * f,
    rate: parseFloat(r.rate),
  }));
}

async function getContributionLimits(pool, year) {
  const direct = await pool.query(
    'SELECT kind, base_amount, catch_up_amount FROM tax_contribution_limit WHERE year=$1',
    [year]
  );
  if (direct.rows.length) {
    return Object.fromEntries(direct.rows.map((r) => [r.kind, {
      base: parseFloat(r.base_amount),
      catch_up: parseFloat(r.catch_up_amount),
    }]));
  }
  // Inflate from latest published (contribution limits round to nearest $500 by IRS rule, but inline projection just inflates)
  const base = await getLatestPublishedYear(pool);
  const baseRows = await pool.query(
    'SELECT kind, base_amount, catch_up_amount FROM tax_contribution_limit WHERE year=$1', [base]
  );
  const pct = await getInflationPct(pool, base);
  const f = inflationFactor(base, year, pct);
  return Object.fromEntries(baseRows.rows.map((r) => [r.kind, {
    base: Math.round(parseFloat(r.base_amount) * f),
    catch_up: Math.round(parseFloat(r.catch_up_amount) * f),
  }]));
}

async function getMedicarePartB(pool, year) {
  const direct = (await pool.query('SELECT monthly_premium FROM tax_medicare_part_b WHERE year=$1', [year])).rows[0];
  if (direct) return parseFloat(direct.monthly_premium);
  const base = await getLatestPublishedYear(pool);
  const baseRow = (await pool.query('SELECT monthly_premium FROM tax_medicare_part_b WHERE year=$1', [base])).rows[0];
  if (!baseRow) throw new Error('No Medicare Part B baseline');
  // Part B has historically grown ~5%/yr — keep that for now; could move to its own knob later.
  return Math.round(parseFloat(baseRow.monthly_premium) * Math.pow(1.05, year - base) * 100) / 100;
}

module.exports = {
  getStandardDeduction,
  getFederalBrackets,
  getContributionLimits,
  getMedicarePartB,
  // exposed for testing
  inflationFactor,
};
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd backend && npm test -- taxParameters.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/taxParameters.js backend/services/taxParameters.test.js
git commit -m "feat(backend): add taxParameters service with DB lookups + inflation projection"
```

---

## Task 4: Refactor `/api/savings-limits` to use the service

**Files:**
- Modify: `backend/server.js` (replace `SAVINGS_LIMITS_BY_YEAR` block, lines ~977–1085)

- [ ] **Step 1: Confirm snapshot baseline is current**

```bash
cd backend && npm test -- snapshots.test.js
```

Expected: PASS (this is your pre-refactor proof).

- [ ] **Step 2: Replace the inline constant with service calls**

In `server.js`:
1. Delete the `SAVINGS_LIMITS_BY_YEAR` object (lines ~980–1008).
2. Inside `app.get('/api/savings-limits', …)`, replace `const base = SAVINGS_LIMITS_BY_YEAR[…]` with:

```js
const taxParams = require('./services/taxParameters');
// inside handler
const limits = await taxParams.getContributionLimits(pool, yearParam);
const base = {
  ira: limits.ira?.base ?? 0,
  ira_catch_up: limits.ira?.catch_up ?? 0,
  '401k_elective': limits['401k_elective']?.base ?? 0,
  '401k_catch_up': limits['401k_elective']?.catch_up ?? 0,
  hsa_individual: limits.hsa_individual?.base ?? 0,
  hsa_family: limits.hsa_family?.base ?? 0,
  hsa_catch_up: limits.hsa_individual?.catch_up ?? 0,
};
```

For the "all years" branch (no `yearParam`), loop over `[2024, 2025, 2026]` (or query `SELECT year FROM tax_year ORDER BY year`) and call `getContributionLimits` for each.

- [ ] **Step 3: Run snapshot test — must still pass identically**

```bash
cd backend && npm test -- snapshots.test.js
```

Expected: PASS, no snapshot diff. **If diff:** the refactor changed behavior. Investigate before continuing.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "refactor(backend): savings-limits reads from taxParameters service"
```

---

## Task 5: Refactor `/api/retirement-tax-guide` to use the service

**Files:**
- Modify: `backend/server.js` (lines ~1130–1222)

- [ ] **Step 1: Replace `MEDICARE_PART_B_MONTHLY_BY_YEAR` + `STANDARD_DEDUCTION_BY_YEAR` + `FEDERAL_BRACKETS_MFJ`**

Replace `getStandardDeduction(year)` and `getPartBForYear(year)` and `estimateFederalTax(taxableIncome, year, filingStatus)` to call the service. Note: `estimateFederalTax` becomes async; propagate `await` to the handler.

- [ ] **Step 2: Delete the three inline constants** once nothing references them.

- [ ] **Step 3: Snapshot test must still pass**

```bash
cd backend && npm test -- snapshots.test.js
```

Expected: PASS, no diff.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "refactor(backend): retirement-tax-guide reads from taxParameters service"
```

---

## Task 6: Refactor `/api/projections` to use the service

**Files:**
- Modify: `backend/server.js` (lines ~1290–1372 — `FEDERAL_ORDINARY_BRACKETS_2025`, `taxParameterInflationFactor`, `standardDeductionEstimate`, `federalOrdinaryTaxWithBreakdown`)

This is the biggest refactor. `federalOrdinaryTaxWithBreakdown` becomes async because it needs `getFederalBrackets`.

- [ ] **Step 1: Convert tax helpers to async + service-backed**

```js
// Replace federalOrdinaryTaxWithBreakdown with:
async function federalOrdinaryTaxWithBreakdown(pool, taxableIncome, filingStatus, year) {
  const brackets = await taxParams.getFederalBrackets(pool, year, filingStatus);
  // Convert to thresholds[] + rates[] in the same shape the current code expects.
  // (Keep the bracket-math loop body identical so the output structure is unchanged.)
  ...
}

// Replace standardDeductionEstimate with:
async function standardDeductionEstimate(pool, filingStatus, year, p1Age, p2Age) {
  return await taxParams.getStandardDeduction(pool, year, filingStatus, p1Age, p2Age);
}
```

- [ ] **Step 2: Propagate `await` through the projections handler**

The handler builds rows in a `for` loop. Make the loop `async for`-style with awaited calls. The two helpers are called once per year.

- [ ] **Step 3: Delete the inline `FEDERAL_ORDINARY_BRACKETS_2025` constant and `taxParameterInflationFactor`** — the service owns inflation projection now.

- [ ] **Step 4: Snapshot test must still pass exactly**

```bash
cd backend && npm test -- snapshots.test.js
```

Expected: PASS, no diff. **This is the hardest gate of M1.** If any year diffs by a cent, audit the difference before moving on. The seed values were chosen to make this match.

- [ ] **Step 5: Commit**

```bash
git add backend/server.js
git commit -m "refactor(backend): projections reads tax params from service"
```

---

## Task 7: Read endpoint — `GET /api/tax-parameters`

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/server.test.js` (add tests)

- [ ] **Step 1: Write the failing test**

```js
test('GET /api/tax-parameters/years returns list with status', async () => {
  const res = await request(server).get('/api/tax-parameters/years');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.years)).toBe(true);
  expect(res.body.years[0]).toHaveProperty('year');
  expect(res.body.years[0]).toHaveProperty('status');
});

test('GET /api/tax-parameters?year=2026 returns all categories', async () => {
  const res = await request(server).get('/api/tax-parameters?year=2026');
  expect(res.status).toBe(200);
  expect(res.body.year).toBe(2026);
  expect(res.body.standard_deduction).toBeDefined();
  expect(res.body.brackets).toBeDefined();
  expect(res.body.contribution_limits).toBeDefined();
  expect(res.body.medicare_part_b).toBeDefined();
});
```

(Add a mock pool branch in `defaultQueryHandler` that returns the seeded rows.)

- [ ] **Step 2: Implement the endpoints**

```js
app.get('/api/tax-parameters/years', async (req, res) => {
  try {
    const r = await pool.query('SELECT year, status, inflation_pct, notes FROM tax_year ORDER BY year');
    res.json({ years: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tax-parameters', async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    if (!Number.isInteger(year)) return res.status(400).json({ error: 'year required' });
    const sd = (await pool.query(
      'SELECT filing_status, amount, age65_add_on, source, modified FROM tax_standard_deduction WHERE year=$1 ORDER BY filing_status',
      [year]
    )).rows;
    const br = (await pool.query(
      'SELECT filing_status, ordinal, lower_bound, rate, source, modified FROM tax_bracket WHERE year=$1 ORDER BY filing_status, ordinal',
      [year]
    )).rows;
    const cl = (await pool.query(
      'SELECT kind, base_amount, catch_up_amount, source, modified FROM tax_contribution_limit WHERE year=$1 ORDER BY kind',
      [year]
    )).rows;
    const mp = (await pool.query(
      'SELECT monthly_premium, source, modified FROM tax_medicare_part_b WHERE year=$1', [year]
    )).rows[0] || null;
    res.json({
      year,
      standard_deduction: sd,
      brackets: br,
      contribution_limits: cl,
      medicare_part_b: mp,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npm test
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js backend/server.test.js
git commit -m "feat(api): GET /api/tax-parameters and /years"
```

---

## Task 8: Write endpoints — `PUT` per kind + `POST /:year/reset`

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/server.test.js`

- [ ] **Step 1: Write tests**

```js
test('PUT updates standard deduction and flips source to user_edited', async () => {
  const res = await request(server)
    .put('/api/tax-parameters/standard-deduction/2026/married_filing_jointly')
    .send({ amount: 32000, age65_add_on: 1550 });
  expect(res.status).toBe(200);
  expect(res.body.source).toBe('user_edited');
});

test('POST reset wipes user edits for a year', async () => {
  const res = await request(server).post('/api/tax-parameters/2026/reset');
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Implement endpoints**

Four PUT routes (standard-deduction, bracket, contribution-limit, medicare-part-b). Each does an UPDATE with `source='user_edited', modified=NOW()` and `RETURNING *`. Return 404 if no row matched.

`POST /api/tax-parameters/:year/reset` is **explicitly destructive of user edits** — re-run the seed values for that year. Implementation: keep a small in-code map of seeded defaults (so reset doesn't require re-running the migration), and `INSERT … ON CONFLICT … DO UPDATE` per row for the requested year.

⚠️ **Confirm with the user before this endpoint mutates anything.** The handler should return a no-op-with-warning if the user has no edits for that year. Consider adding `?confirm=true` as a query-param gate.

- [ ] **Step 3: Run tests**

```bash
cd backend && npm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js backend/server.test.js
git commit -m "feat(api): PUT tax-parameter rows + reset endpoint"
```

---

## Task 9: Frontend API client additions

**Files:**
- Modify: `frontend/src/api/api.js`

- [ ] **Step 1: Add methods**

```js
export const taxParameters = {
  listYears: () => axios.get('/api/tax-parameters/years').then((r) => r.data),
  getYear: (year) => axios.get(`/api/tax-parameters?year=${year}`).then((r) => r.data),
  updateStandardDeduction: (year, fs, body) =>
    axios.put(`/api/tax-parameters/standard-deduction/${year}/${fs}`, body).then((r) => r.data),
  updateBracket: (year, fs, ordinal, body) =>
    axios.put(`/api/tax-parameters/bracket/${year}/${fs}/${ordinal}`, body).then((r) => r.data),
  updateContributionLimit: (year, kind, body) =>
    axios.put(`/api/tax-parameters/contribution-limit/${year}/${kind}`, body).then((r) => r.data),
  updateMedicarePartB: (year, body) =>
    axios.put(`/api/tax-parameters/medicare-part-b/${year}`, body).then((r) => r.data),
  resetYear: (year) =>
    axios.post(`/api/tax-parameters/${year}/reset?confirm=true`).then((r) => r.data),
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/api.js
git commit -m "feat(frontend): api client for tax-parameters"
```

---

## Task 10: TaxDetailsPage skeleton

**Files:**
- Create: `frontend/src/pages/TaxDetailsPage.jsx`
- Create: `frontend/src/pages/TaxDetailsPage.test.jsx`

- [ ] **Step 1: Write a basic render test**

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import TaxDetailsPage from './TaxDetailsPage';
// vi.mock the api module so it returns fixed data.

test('renders year selector and four section cards', async () => {
  render(<TaxDetailsPage />);
  await waitFor(() => expect(screen.getByText(/Tax Details/i)).toBeInTheDocument());
  expect(screen.getByLabelText(/Year/i)).toBeInTheDocument();
  expect(screen.getByText(/Standard Deduction/i)).toBeInTheDocument();
  expect(screen.getByText(/Tax Brackets/i)).toBeInTheDocument();
  expect(screen.getByText(/Contribution Limits/i)).toBeInTheDocument();
  expect(screen.getByText(/Medicare Part B/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd frontend && npm test -- TaxDetailsPage
```

- [ ] **Step 3: Implement the page**

Structure (~150 lines):
- `useEffect` on mount → `taxParameters.listYears()` to populate dropdown.
- `useEffect` on year change → `taxParameters.getYear(year)` to populate cards.
- Four section components inline: `StandardDeductionCard`, `BracketsCard`, `ContributionLimitsCard`, `MedicarePartBCard`. Each takes the relevant slice + an `onSave(row)` callback.
- Each row renders: value (editable), source badge (`seeded` or `edited`), modified timestamp, a save button next to the edited input (no auto-save).
- "Reset year to defaults" button at top of the year view — opens a confirm dialog.

Per-row source badge styling:
- `seeded` → muted grey pill
- `user_edited` → amber pill with the modified date

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TaxDetailsPage.jsx frontend/src/pages/TaxDetailsPage.test.jsx
git commit -m "feat(frontend): Tax Details page with edit-in-place + reset"
```

---

## Task 11: Wire route + nav link

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Import + add route + nav link**

```jsx
import TaxDetailsPage from './pages/TaxDetailsPage';

// in nav-links, between "Savings limits" and "Projections":
<Link to="/tax-details" className="nav-link">Tax details</Link>

// in Routes:
<Route path="/tax-details" element={<TaxDetailsPage />} />
```

- [ ] **Step 2: Verify in dev**

```bash
cd frontend && npm run dev
# Visit http://localhost:3010/tax-details — confirm page renders.
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): add Tax details nav link + route"
```

---

## Task 12: README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add migration note to the "Database Setup" section**

```markdown
If your database was created before tax parameters, run:

\`\`\`bash
psql -U postgres -d retirementhub -f retirementhub/database/migrations/012_tax_parameters.sql
\`\`\`
```

Also add a brief "Tax Details" entry to the "Later stages" list at the bottom: "**Tax details:** IRS standard deduction, brackets, contribution limits, and Medicare Part B premiums live in the database. Edit per year on the Tax details page. Defaults are seeded for 2024–2026 from published IRS values."

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document migration 012 and Tax details page"
```

---

## Definition of Done — M1

- [ ] Migration 012 runs cleanly on a fresh DB and on an existing DB
- [ ] Snapshot tests pass before AND after the full refactor (no numeric drift)
- [ ] `backend/server.js` no longer contains `SAVINGS_LIMITS_BY_YEAR`, `MEDICARE_PART_B_MONTHLY_BY_YEAR`, `FEDERAL_BRACKETS_MFJ`, `STANDARD_DEDUCTION_BY_YEAR`, or `FEDERAL_ORDINARY_BRACKETS_2025`
- [ ] `npm test` passes in both `backend/` and `frontend/`
- [ ] Tax details page is reachable from nav, shows 2024/2025/2026 with seeded badges, lets the user edit a row and see the source flip to `user_edited`
- [ ] Editing a 2026 bracket and reloading `/projections` produces a different number using the edited value
- [ ] Reset button restores seeded values

---

## Risks / Watch-outs

- **The two divergent 2025 MFJ standard deductions** (30000 vs 31500 in current code) get unified by the seed. The snapshot baseline is captured BEFORE the refactor, so if the refactor produces 30000 where the old code produced 31500, the snapshot test will fail. **Resolution:** create the baseline with the seed value as the source of truth — meaning fix the bug in a small commit BEFORE Task 1's snapshot capture, OR document the diff as intentional in the snapshot update. Choose explicitly; don't let the snapshot silently encode the bug.
- **Async propagation** in the projections handler is the highest-risk change. Run the snapshot test after every small edit, not just at the end.
- **Reset endpoint** mutates user data — never call it without an explicit user action (confirm dialog).
