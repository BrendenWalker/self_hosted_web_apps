# Milestone 3 — Regression Test Suite

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the pure tax math out of `server.js` into a dedicated `taxEngine` module and lock it under direct unit tests, so M4 (and eventually M5) cannot silently change projection numbers.

**Architecture:**
- New module `backend/services/taxEngine.js` contains only pure functions: bracket math, SS taxation tiers, RMD math. No DB access, no Express, no I/O.
- `taxParameters.js` (from M1) supplies bracket arrays; `taxEngine.js` consumes them.
- `server.js` projections handler becomes orchestration only — fetch params → call engine → format response.

**Tech Stack:** Jest (existing).

**Prerequisite:** M1 complete (`taxParameters.js` exists and is the source for IRS values).

---

## File Structure

**Create:**
- `backend/services/taxEngine.js` — pure tax math
- `backend/services/taxEngine.test.js` — unit tests
- `backend/services/rmdEngine.js` — RMD-specific math (split out for testability)
- `backend/services/rmdEngine.test.js`

**Modify:**
- `backend/server.js` — projections handler delegates math to the engines
- `backend/snapshots.test.js` — should pass unchanged (this milestone is risk-managed by it)

---

## Task 1: Extract `taxEngine.js` — bracket math

**Files:**
- Create: `backend/services/taxEngine.js`
- Create: `backend/services/taxEngine.test.js`

- [ ] **Step 1: Write failing tests for `ordinaryTaxFromBrackets`**

```js
const { ordinaryTaxFromBrackets } = require('./taxEngine');

const MFJ_2025 = [
  { lower_bound: 0,      rate: 0.10 },
  { lower_bound: 23850,  rate: 0.12 },
  { lower_bound: 96950,  rate: 0.22 },
  { lower_bound: 206700, rate: 0.24 },
  { lower_bound: 394600, rate: 0.32 },
  { lower_bound: 501050, rate: 0.35 },
  { lower_bound: 751600, rate: 0.37 },
];

test('zero income → zero tax', () => {
  expect(ordinaryTaxFromBrackets(0, MFJ_2025).total).toBe(0);
});

test('income inside first bracket', () => {
  expect(ordinaryTaxFromBrackets(10000, MFJ_2025).total).toBeCloseTo(1000, 2);
});

test('income exactly at first threshold uses only the 10% bracket', () => {
  expect(ordinaryTaxFromBrackets(23850, MFJ_2025).total).toBeCloseTo(2385, 2);
});

test('income one cent above first threshold puts the penny in the 12% bracket', () => {
  const r = ordinaryTaxFromBrackets(23850.01, MFJ_2025).total;
  expect(r).toBeCloseTo(2385 + 0.01 * 0.12, 4);
});

test('income across all brackets matches hand-computed total', () => {
  // 200000 income, MFJ:
  // 10% on 23850         = 2385
  // 12% on (96950-23850) = 8772
  // 22% on (200000-96950)= 22671
  // Total                = 33828
  expect(ordinaryTaxFromBrackets(200000, MFJ_2025).total).toBeCloseTo(33828, 2);
});

test('per-bracket breakdown income_in_band sums to total income', () => {
  const r = ordinaryTaxFromBrackets(200000, MFJ_2025);
  const summed = r.brackets.reduce((s, b) => s + b.income_in_band, 0);
  expect(summed).toBeCloseTo(200000, 2);
});
```

- [ ] **Step 2: Implement**

```js
// backend/services/taxEngine.js
'use strict';

function ordinaryTaxFromBrackets(taxableIncome, brackets) {
  if (!Array.isArray(brackets) || brackets.length === 0) return { total: 0, brackets: [] };
  let remaining = Math.max(0, taxableIncome || 0);
  let total = 0;
  const out = [];
  for (let i = 0; i < brackets.length; i++) {
    const low = brackets[i].lower_bound;
    const high = i + 1 < brackets.length ? brackets[i + 1].lower_bound : Infinity;
    const bandWidth = high === Infinity ? remaining : Math.max(0, high - low);
    const take = Math.min(remaining, bandWidth);
    if (take > 0) {
      const taxAmt = take * brackets[i].rate;
      total += taxAmt;
      out.push({
        rate_pct: Math.round(brackets[i].rate * 1000) / 10,
        income_in_band: Math.round(take * 100) / 100,
        tax: Math.round(taxAmt * 100) / 100,
      });
      remaining -= take;
    }
    if (remaining <= 0) break;
  }
  return { total: Math.round(total * 100) / 100, brackets: out };
}

module.exports = { ordinaryTaxFromBrackets };
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd backend && npm test -- taxEngine.test.js
```

- [ ] **Step 4: Refactor `server.js` to delegate bracket math**

In `federalOrdinaryTaxWithBreakdown` (now async after M1): replace the inline bracket loop with `ordinaryTaxFromBrackets(taxableIncome, brackets)`.

- [ ] **Step 5: Snapshot test must still pass**

```bash
cd backend && npm test -- snapshots.test.js
```

Expected: PASS, no diff.

- [ ] **Step 6: Commit**

```bash
git add backend/services/taxEngine.js backend/services/taxEngine.test.js backend/server.js
git commit -m "refactor(backend): extract bracket math into taxEngine + unit tests"
```

---

## Task 2: Extract SS taxation tiers

**Files:**
- Modify: `backend/services/taxEngine.js`
- Modify: `backend/services/taxEngine.test.js`

- [ ] **Step 1: Tests**

```js
const { taxableSocialSecurity } = require('./taxEngine');

test('zero benefits → zero', () => {
  expect(taxableSocialSecurity(50000, 0, 'married_filing_jointly')).toBe(0);
});

test('MFJ below tier 0 (combined ≤ 32k) → zero taxable', () => {
  // halfSs=10000, combined=20000+10000=30000 < 32000
  expect(taxableSocialSecurity(20000, 20000, 'married_filing_jointly')).toBe(0);
});

test('MFJ between t0 and t1 → up to 50% of excess', () => {
  // halfSs=10000, combined=30000+10000=40000, between 32k and 44k
  // min(0.5*20000, 0.5*(40000-32000)) = min(10000, 4000) = 4000
  expect(taxableSocialSecurity(30000, 20000, 'married_filing_jointly')).toBeCloseTo(4000, 2);
});

test('MFJ above t1 → capped at 85% of benefit', () => {
  expect(taxableSocialSecurity(200000, 20000, 'married_filing_jointly')).toBeCloseTo(17000, 2);
});

test('single uses single thresholds (25k/34k)', () => { /* … */ });
```

- [ ] **Step 2: Move `estimateTaxableSocialSecurityAnnual` from `server.js` into `taxEngine.js` as `taxableSocialSecurity`. Update `server.js` import.**

- [ ] **Step 3: Run tests + snapshot**

```bash
cd backend && npm test
```

Expected: all PASS, no snapshot diff.

- [ ] **Step 4: Commit**

```bash
git add backend/services/taxEngine.js backend/services/taxEngine.test.js backend/server.js
git commit -m "refactor(backend): extract SS taxation into taxEngine + unit tests"
```

---

## Task 3: Extract RMD math into `rmdEngine.js`

**Files:**
- Create: `backend/services/rmdEngine.js`
- Create: `backend/services/rmdEngine.test.js`

- [ ] **Step 1: Tests**

```js
const { rmdStartAge, uniformLifetimeDivisor, rmdForAccount } = require('./rmdEngine');

test('birth year 1949 → RMD age 72', () => expect(rmdStartAge(1949)).toBe(72));
test('birth year 1955 → RMD age 73', () => expect(rmdStartAge(1955)).toBe(73));
test('birth year 1965 → RMD age 75', () => expect(rmdStartAge(1965)).toBe(75));

test('divisor at 73 is 26.5… (matches Pub 590-B 2022 table — verify exact)', () => {
  expect(uniformLifetimeDivisor(73)).toBeCloseTo(25.5, 1);
});

test('divisor below RMD start age returns null', () => {
  expect(uniformLifetimeDivisor(71)).toBeNull();
});

test('rmdForAccount(100000, age 73, mfj) → 100000 / 25.5', () => {
  expect(rmdForAccount(100000, 73)).toBeCloseTo(100000 / 25.5, 2);
});

test('rmdForAccount below start age → 0', () => {
  expect(rmdForAccount(100000, 65)).toBe(0);
});
```

- [ ] **Step 2: Move `UNIFORM_LIFETIME_DIVISOR`, `uniformLifetimeDivisor`, `rmdStartAgeFromBirthYear` from `server.js` into `rmdEngine.js`. Add `rmdForAccount(balance, age)` as a thin wrapper.**

- [ ] **Step 3: Run tests + snapshot**

Expected: PASS, no snapshot diff.

- [ ] **Step 4: Commit**

```bash
git add backend/services/rmdEngine.js backend/services/rmdEngine.test.js backend/server.js
git commit -m "refactor(backend): extract RMD math into rmdEngine + unit tests"
```

---

## Task 4: CI guard — fail loudly on any regression

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Make sure `npm test` runs all of the above and is wired into existing CI**

The current `"test": "jest --runInBand"` already does this. Verify snapshot tests are committed and run.

- [ ] **Step 2: Add a test:ci convention that fails on outdated snapshots**

```json
"test:ci": "jest --runInBand --ci --coverage --reporters=default --reporters=jest-junit --ci"
```

The `--ci` flag causes Jest to fail (not update) on snapshot mismatches — this is the gate.

- [ ] **Step 3: Verify**

```bash
cd backend && npm run test:ci
```

Expected: PASS, with coverage report showing `taxEngine.js` and `rmdEngine.js` at 100% line coverage. If lower, add tests until 100%.

- [ ] **Step 4: Commit**

```bash
git add backend/package.json
git commit -m "test: lock CI to fail on snapshot drift"
```

---

## Definition of Done — M3

- [ ] `backend/services/taxEngine.js` contains the bracket math and SS taxation; **no DB code, no Express code**
- [ ] `backend/services/rmdEngine.js` contains the RMD math
- [ ] Each engine has 100% line coverage in `npm run test:ci`
- [ ] `server.js` projections handler is purely orchestration — no inline tax math
- [ ] A deliberate one-cent edit to any bracket value breaks the snapshot test
- [ ] `npm test` runs in under 5 seconds locally
