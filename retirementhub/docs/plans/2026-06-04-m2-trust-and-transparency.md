# Milestone 2 — Trust & Transparency

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every tax-related number in the UI carry its provenance (published / projected / user-edited) and add a single "Assumptions" panel that names what the model includes and excludes.

**Architecture:**
- One new presentational component, `<PrecisionBadge />`, used wherever a tax number is displayed.
- One new component, `<AssumptionsPanel />`, rendered on the Projections page (collapsed by default).
- Backend exposes the metadata needed for badges via a small extension to existing endpoints — no new endpoints needed.

**Tech Stack:** React, existing styling conventions.

**Prerequisite:** M1 complete (Tax Details page exists, `tax_*` tables seeded, endpoints expose `source` per row).

---

## File Structure

**Create:**
- `frontend/src/components/PrecisionBadge.jsx`
- `frontend/src/components/PrecisionBadge.test.jsx`
- `frontend/src/components/AssumptionsPanel.jsx`
- `frontend/src/components/AssumptionsPanel.test.jsx`

**Modify:**
- `backend/server.js` — projections response includes `tax_param_provenance` (which year, status, edited flags)
- `frontend/src/pages/ProjectionsPage.jsx` — render `AssumptionsPanel`, attach `PrecisionBadge` to tax dollar figures, horizon warning banner

---

## Task 1: Backend — expose provenance per projected year

**Files:**
- Modify: `backend/server.js` (projections endpoint)
- Modify: `backend/server.test.js`

- [ ] **Step 1: Add test**

```js
test('GET /api/projections includes tax_param_provenance per year', async () => {
  const res = await request(server).get('/api/projections');
  const row = res.body.years[0];
  expect(row.tax_param_provenance).toBeDefined();
  expect(row.tax_param_provenance.standard_deduction).toMatchObject({
    source: expect.stringMatching(/seeded|user_edited|projected/),
    year_used: expect.any(Number),
  });
});
```

- [ ] **Step 2: Implement**

In the projections handler, for each projected year build:

```js
const provenance = {
  standard_deduction: {
    source: stdDedSourceForYear,   // 'seeded' | 'user_edited' | 'projected'
    year_used: stdDedYearUsed,     // the DB year actually consulted
    inflation_applied: stdDedInflated, // true if projected forward
  },
  brackets: { /* same shape */ },
  medicare_part_b: { /* same shape */ },
};
```

The `taxParameters` service should be extended to return `{ value, source, year_used, inflation_applied }` from a new variant (e.g. `getStandardDeductionWithProvenance`). Keep the existing scalar-returning method working — internally call the rich variant and project.

- [ ] **Step 3: Update the snapshot from M1 (intentional change)**

```bash
cd backend && npm test -- snapshots.test.js -u
git add backend/__snapshots__/snapshots.test.js.snap
```

⚠️ Inspect the diff before `-u`. Only the new `tax_param_provenance` keys should appear; existing dollar values must be unchanged.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js backend/services/taxParameters.js backend/server.test.js
git commit -m "feat(api): include tax parameter provenance per projection year"
```

---

## Task 2: PrecisionBadge component

**Files:**
- Create: `frontend/src/components/PrecisionBadge.jsx`
- Create: `frontend/src/components/PrecisionBadge.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
test('renders Published badge for seeded source', () => {
  render(<PrecisionBadge source="seeded" yearUsed={2026} />);
  expect(screen.getByText(/Published/i)).toBeInTheDocument();
  expect(screen.getByText(/2026/)).toBeInTheDocument();
});

test('renders Projected badge with inflation note when inflation_applied', () => {
  render(<PrecisionBadge source="seeded" yearUsed={2026} inflationApplied />);
  expect(screen.getByText(/Projected/i)).toBeInTheDocument();
});

test('renders User-edited badge in amber for user_edited source', () => {
  const { container } = render(<PrecisionBadge source="user_edited" yearUsed={2026} />);
  expect(screen.getByText(/User-edited/i)).toBeInTheDocument();
  expect(container.querySelector('.badge-amber')).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement**

```jsx
// PrecisionBadge.jsx
import React from 'react';

export default function PrecisionBadge({ source, yearUsed, inflationApplied, modified }) {
  let label, tone;
  if (source === 'user_edited') {
    label = `User-edited (${yearUsed})`;
    tone = 'amber';
  } else if (inflationApplied) {
    label = `Projected from ${yearUsed}`;
    tone = 'grey';
  } else {
    label = `Published ${yearUsed}`;
    tone = 'green';
  }
  return (
    <span
      className={`precision-badge badge-${tone}`}
      title={modified ? `Last modified ${modified}` : undefined}
    >
      {label}
    </span>
  );
}
```

Add minimal CSS in `App.css` for `.precision-badge`, `.badge-green`, `.badge-grey`, `.badge-amber`.

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd frontend && npm test -- PrecisionBadge
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PrecisionBadge.jsx frontend/src/components/PrecisionBadge.test.jsx frontend/src/App.css
git commit -m "feat(frontend): PrecisionBadge component for tax-value provenance"
```

---

## Task 3: AssumptionsPanel component

**Files:**
- Create: `frontend/src/components/AssumptionsPanel.jsx`
- Create: `frontend/src/components/AssumptionsPanel.test.jsx`

- [ ] **Step 1: Write a render test**

```jsx
test('lists included and excluded items', () => {
  render(<AssumptionsPanel />);
  // Open the collapsed panel
  fireEvent.click(screen.getByText(/Assumptions & limitations/i));
  expect(screen.getByText(/Federal income tax/i)).toBeInTheDocument();
  expect(screen.getByText(/State income tax/i)).toBeInTheDocument();
  expect(screen.getByText(/Not included/i)).toBeInTheDocument();
});

test('has a link to Tax details', () => {
  render(<AssumptionsPanel />);
  fireEvent.click(screen.getByText(/Assumptions & limitations/i));
  expect(screen.getByRole('link', { name: /Tax details/i })).toHaveAttribute('href', '/tax-details');
});
```

- [ ] **Step 2: Implement**

Static two-column list. Collapsed by default; expand on header click. Content:

**Included** — federal income tax (ordinary brackets), standard deduction, RMDs (Uniform Lifetime), Social Security taxation (Pub. 915 tiers), Medicare Part B.
**Not included** — state income tax, NIIT, AMT, IRMAA surcharges, capital gains rates, tax credits, estate tax, tax lots, Roth conversion modeling, withdrawal strategy variants.

Footer link: "Edit IRS values on the [Tax details](/tax-details) page."

- [ ] **Step 3: Run tests — expect PASS**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AssumptionsPanel.jsx frontend/src/components/AssumptionsPanel.test.jsx
git commit -m "feat(frontend): AssumptionsPanel component"
```

---

## Task 4: Wire into Projections page

**Files:**
- Modify: `frontend/src/pages/ProjectionsPage.jsx`

- [ ] **Step 1: Render the panel below the chart area**

```jsx
import AssumptionsPanel from '../components/AssumptionsPanel';
// near bottom of page
<AssumptionsPanel />
```

- [ ] **Step 2: Attach `<PrecisionBadge />` next to tax-related dollar figures**

Specifically:
- Standard deduction column in the per-year table → `<PrecisionBadge source={row.tax_param_provenance.standard_deduction.source} yearUsed={…} inflationApplied={…} />`
- Federal tax column → same with `.brackets`
- Medicare Part B column → same with `.medicare_part_b`

- [ ] **Step 3: Manual check in dev**

```bash
cd frontend && npm run dev
```

Navigate to Projections. Confirm badges appear inline next to tax columns. Edit a 2026 bracket on Tax Details → reload Projections → 2026 row's bracket badge should now read "User-edited (2026)".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjectionsPage.jsx
git commit -m "feat(frontend): show precision badges and assumptions panel on Projections"
```

---

## Task 5: Horizon-past-published warning banner

**Files:**
- Modify: `frontend/src/pages/ProjectionsPage.jsx`

- [ ] **Step 1: Write the logic**

Compute `latestPublishedYear` from `tax_param_provenance` (max `year_used` where `inflation_applied === false`). If `projection_horizon_end_year > latestPublishedYear`, render:

```jsx
<div className="banner banner-info">
  Beyond {latestPublishedYear} this projection uses inflation-adjusted estimates.
  <Link to="/tax-details">Add or edit values on Tax details</Link> to override.
</div>
```

- [ ] **Step 2: Add a test** (optional but cheap given component is small)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ProjectionsPage.jsx
git commit -m "feat(frontend): warn when projections extend past published tax years"
```

---

## Definition of Done — M2

- [ ] Every tax-related dollar figure in the projections table has a `<PrecisionBadge />` next to it
- [ ] AssumptionsPanel is reachable on Projections, lists at least 5 included items and 5 excluded items, links to `/tax-details`
- [ ] Horizon banner appears when the projection runs past the last published tax year
- [ ] `npm test` passes in both backend and frontend
- [ ] A user can name three excluded items by reading the Projections page (no help needed)
