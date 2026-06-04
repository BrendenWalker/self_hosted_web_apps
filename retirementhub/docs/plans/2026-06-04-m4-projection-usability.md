# Milestone 4 — Projection Usability

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make existing projection output answerable — users can click any year and see *why* taxes, withdrawals, or balances look the way they do.

**Architecture:**
- No new modeling. All data needed is already on the `/api/projections` response.
- Add four chart enhancements (account balance buckets, taxable income stack, federal tax bracket bars, spending source stack) using existing `recharts` library.
- Add a per-year detail drawer: click any chart's year axis → side panel renders that year's full row from the projection response.
- Add a CSV export button that downloads the per-year table.

**Tech Stack:** React, recharts (already a dependency), client-side CSV generation.

**Prerequisite:** M1, M2 ideally M3 complete. M4 can ship on top of M2 without M3, but M3's regression net protects it.

---

## File Structure

**Create:**
- `frontend/src/components/charts/AccountBalanceChart.jsx` (+ test)
- `frontend/src/components/charts/TaxableIncomeChart.jsx` (+ test)
- `frontend/src/components/charts/FederalTaxChart.jsx` (+ test)
- `frontend/src/components/charts/SpendingSourceChart.jsx` (+ test)
- `frontend/src/components/YearDetailDrawer.jsx` (+ test)
- `frontend/src/utils/csvExport.js` (+ test)

**Modify:**
- `frontend/src/pages/ProjectionsPage.jsx` — render the four new charts, wire drawer, add export button
- `backend/server.js` — only if the projections response is missing a field needed for spending-source or balance-bucket detail (audit first; do not add fields speculatively)

---

## Task 1: Audit `/api/projections` payload

**Files:** none (read-only)

- [ ] **Step 1: Inspect a real response**

```bash
curl -s http://localhost:8100/api/projections | jq '.years[0]'
```

Confirm these fields exist on each `years[i]`:
- `account_balances` keyed by account type (pre_tax, roth, taxable, cash, hsa, asset) OR a per-account list with type
- `wage_income`, `bonus`, `social_security_taxable_portion`, `rmd_total`
- `federal_tax_brackets` (array of {rate_pct, income_in_band, tax})
- `spending_from_*` keys (social_security, rmd, wages, savings) — or equivalent

- [ ] **Step 2: If any of the four charts cannot be built from existing fields, file a small backend task FIRST.** Examples likely needed:
  - `account_balance_by_bucket`: { pre_tax, roth, taxable, cash, hsa, asset }
  - `spending_source`: { social_security, rmd, wages_bonus, savings_withdrawal, p2_health_bridge }

  Add these to the existing per-year row in the projections handler. Snapshot tests must be updated (`-u`) intentionally; inspect the diff to confirm only additions.

- [ ] **Step 3: Commit the backend extensions (if any)**

```bash
git add backend/server.js backend/__snapshots__/snapshots.test.js.snap
git commit -m "feat(api): expose account-balance buckets and spending-source breakdown per year"
```

---

## Task 2: AccountBalanceChart (stacked area by bucket)

**Files:**
- Create: `frontend/src/components/charts/AccountBalanceChart.jsx`
- Create: `frontend/src/components/charts/AccountBalanceChart.test.jsx`

- [ ] **Step 1: Render test**

```jsx
import { render, screen } from '@testing-library/react';
import AccountBalanceChart from './AccountBalanceChart';

const years = [
  { year: 2026, account_balance_by_bucket: { pre_tax: 100, roth: 50, taxable: 25, cash: 10, hsa: 5 } },
  { year: 2027, account_balance_by_bucket: { pre_tax: 105, roth: 55, taxable: 25, cash: 10, hsa: 6 } },
];

test('renders without crashing for two-year input', () => {
  const { container } = render(<AccountBalanceChart years={years} />);
  expect(container.querySelector('svg')).toBeInTheDocument();
});

test('calls onYearClick with the year when an x-axis tick is activated', () => {
  const onYearClick = jest.fn();
  // recharts emits events through Tooltip / ClickArea; use the wrapper's onClick prop.
  render(<AccountBalanceChart years={years} onYearClick={onYearClick} />);
  // …trigger the chart's onClick with the synthetic event recharts exposes.
});
```

- [ ] **Step 2: Implement**

A stacked `<AreaChart>` with one `<Area>` per bucket in fixed order (pre_tax, roth, taxable, cash, hsa). Title above the chart. `onClick={(e) => onYearClick(e?.activeLabel)}` on the chart wrapper.

- [ ] **Step 3: Run tests — PASS**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/charts/AccountBalanceChart.jsx frontend/src/components/charts/AccountBalanceChart.test.jsx
git commit -m "feat(frontend): stacked account balance chart by bucket"
```

---

## Task 3: TaxableIncomeChart

**Files:**
- Create: `frontend/src/components/charts/TaxableIncomeChart.jsx` (+ test)

- [ ] **Step 1: Render test (one stack key per source)**

Expect bars/areas for: Wages, Bonus, Social Security (taxable portion), RMD.

- [ ] **Step 2: Implement using `<BarChart>` stacked**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/charts/TaxableIncomeChart.jsx frontend/src/components/charts/TaxableIncomeChart.test.jsx
git commit -m "feat(frontend): taxable income chart stacked by source"
```

---

## Task 4: FederalTaxChart (bracket breakdown)

**Files:**
- Create: `frontend/src/components/charts/FederalTaxChart.jsx` (+ test)

- [ ] **Step 1: Implement**

For each year, take `federal_tax_brackets` and render as a stacked bar with one segment per bracket (10%, 12%, 22%, etc.). Color brackets consistently across years (e.g. cool → warm by rate).

- [ ] **Step 2: Tooltip should show, per bracket: rate %, income in band, tax owed**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/charts/FederalTaxChart.jsx frontend/src/components/charts/FederalTaxChart.test.jsx
git commit -m "feat(frontend): federal tax chart with per-bracket breakdown"
```

---

## Task 5: SpendingSourceChart

**Files:**
- Create: `frontend/src/components/charts/SpendingSourceChart.jsx` (+ test)

- [ ] **Step 1: Implement**

Stacked area: Social Security, RMD, Wages/Bonus, Savings Withdrawal, P2 Health Bridge (if applicable).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/charts/SpendingSourceChart.jsx frontend/src/components/charts/SpendingSourceChart.test.jsx
git commit -m "feat(frontend): spending source chart stacked by funding origin"
```

---

## Task 6: YearDetailDrawer

**Files:**
- Create: `frontend/src/components/YearDetailDrawer.jsx` (+ test)

- [ ] **Step 1: Render test**

```jsx
test('shows nothing when year is null', () => {
  const { container } = render(<YearDetailDrawer year={null} row={null} onClose={() => {}} />);
  expect(container.querySelector('.year-drawer')).toBeNull();
});

test('renders year and key sections when row provided', () => {
  const row = { year: 2030, taxable_income: 80000, federal_tax_total: 9000, /* … */ };
  render(<YearDetailDrawer year={2030} row={row} onClose={() => {}} />);
  expect(screen.getByText(/2030/)).toBeInTheDocument();
  expect(screen.getByText(/Taxable Income/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement**

Slide-in panel on the right. Sections:
1. **Income** — wages, bonus, SS gross, SS taxable, RMD, withdrawals
2. **Deductions & taxable income** — standard deduction (with PrecisionBadge), taxable income after deduction
3. **Federal tax** — per-bracket table
4. **Spending** — totals by source
5. **Ending balances** — per account
6. **Notes / warnings** — any warnings for this year (M2 / future M5)

Close button + ESC key handler.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/YearDetailDrawer.jsx frontend/src/components/YearDetailDrawer.test.jsx
git commit -m "feat(frontend): per-year detail drawer"
```

---

## Task 7: CSV export

**Files:**
- Create: `frontend/src/utils/csvExport.js` (+ test)

- [ ] **Step 1: Test**

```js
import { yearsToCsv } from './csvExport';

test('produces header + one row per year', () => {
  const csv = yearsToCsv([
    { year: 2026, taxable_income: 100, federal_tax_total: 12 },
    { year: 2027, taxable_income: 110, federal_tax_total: 14 },
  ]);
  const lines = csv.trim().split('\n');
  expect(lines.length).toBe(3); // header + 2
  expect(lines[0]).toMatch(/year/);
});

test('escapes commas and quotes in values', () => {
  const csv = yearsToCsv([{ year: 2026, note: 'has "quotes", commas' }]);
  expect(csv).toContain('"has ""quotes"", commas"');
});
```

- [ ] **Step 2: Implement** a minimal RFC-4180-conformant writer (one helper, ~30 lines). Do not add a CSV library.

- [ ] **Step 3: Wire a button on Projections page** that triggers a Blob download:

```jsx
function downloadProjectionsCsv(years) {
  const blob = new Blob([yearsToCsv(years)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `retirementhub-projection-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/csvExport.js frontend/src/utils/csvExport.test.js frontend/src/pages/ProjectionsPage.jsx
git commit -m "feat(frontend): CSV export of projection years"
```

---

## Task 8: Wire it all into ProjectionsPage

**Files:**
- Modify: `frontend/src/pages/ProjectionsPage.jsx`

- [ ] **Step 1: Layout**

```
[Existing controls — horizon, growth rate, etc.]
[Existing net-worth-over-time chart]
[Tabs: Balances | Taxable Income | Federal Tax | Spending Sources]   ← four new charts
[Existing per-year table]
[CSV export button]
[AssumptionsPanel (from M2)]

[YearDetailDrawer — slides in when a chart year is clicked or a table row is clicked]
```

- [ ] **Step 2: Click-to-drawer**

```jsx
const [selectedYear, setSelectedYear] = useState(null);
const selectedRow = selectedYear ? years.find((y) => y.year === selectedYear) : null;
<AccountBalanceChart years={years} onYearClick={setSelectedYear} />
<YearDetailDrawer year={selectedYear} row={selectedRow} onClose={() => setSelectedYear(null)} />
```

- [ ] **Step 3: Manual verification in dev**

```bash
cd frontend && npm run dev
```

Visit Projections, click a year on each chart, confirm drawer opens with that year's data. Click table row → same. Export CSV → open in spreadsheet → numbers should match the table.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectionsPage.jsx
git commit -m "feat(frontend): Projections page with charts, drawer, CSV export"
```

---

## Definition of Done — M4

- [ ] Four new charts (balance buckets, taxable income, federal tax brackets, spending sources) all render against the existing projection response
- [ ] Clicking a year on any chart opens a side drawer with full per-year detail
- [ ] CSV export downloads with the same numbers as the on-screen table
- [ ] No new modeling logic introduced — `taxEngine` / `rmdEngine` / `taxParameters` untouched
- [ ] `npm test` passes in both backend and frontend
- [ ] A user can answer "why did taxes spike in year X?" by opening the drawer

---

## Out of scope for M4 (see strategic plan)

- **Roth conversion chart** and **dedicated RMD chart** — need Roth conversion and withdrawal-strategy modeling (M5).
- **JSON export** — defer to M5 scenario audit trail unless a user asks for it on the single baseline projection.
- **Simple vs Advanced mode split** — defer until scenario UI exists (M5).

---

## Risks / Watch-outs

- **Recharts version pinning** — confirm the installed version supports stacked AreaChart click events. If the version in `package.json` is older, prefer BarChart for the stacks rather than upgrading recharts in this milestone.
- **CSV row order** — fix column order in `csvExport.js` so diffs across exports are stable (e.g. by date or by manual key list, not by `Object.keys` of the first row).
