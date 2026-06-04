# RetirementHub Implementation Plan

**Status:** Active strategic plan (2026-06-04). Task-level breakdown: [`docs/plans/`](./plans/). Index: [`docs/README.md`](./README.md).
**Goal:** Make RetirementHub a trustworthy, usable retirement decision-support tool for a single household, with user-owned IRS parameters and explainable projections.

---

## Reality Check vs. the Original Proposal

An earlier 12-phase proposal described several capabilities as already-implemented "cleanup" targets. After auditing the code:

| Source-doc claim                         | Actual state in repo                                                                 |
|------------------------------------------|--------------------------------------------------------------------------------------|
| Scenario comparison                      | **Not implemented.** No scenario tables, no scenario page in `App.jsx`.              |
| Roth conversions                         | **Not implemented.** No code path.                                                   |
| Tax-aware withdrawals / strategy picker  | **Not implemented.** Projections use a single fixed waterfall.                       |
| RMD projections                          | Implemented (`UNIFORM_LIFETIME_DIVISOR`, `rmdStartAgeFromBirthYear` in `server.js`). |
| Social Security timing                   | Static — uses retirement date + manual SS estimate on `household`.                   |
| Federal tax estimates                    | Implemented but values hardcoded (`FEDERAL_BRACKETS_MFJ`, etc.).                     |
| Lifetime tax comparison                  | Implicit in projection only; no comparison UI.                                       |

**Implication:** Phases 1, 3, 5, 6 of the original doc are *net-new feature work*, not cleanup. The MVP for "usable" should not depend on them landing first.

---

## Key Decisions Locked In

### 1. IRS values move to the database

All annually-updated IRS values are stored in Postgres, not in source. Rationale:

- Values change yearly; hardcoding forces a code release on every IRS update.
- Self-hosted single-household app — no concern about user error scaling.
- Auditable: user sees the same value the engine uses.
- Future-proofs against fast-moving rules (SECURE 3.0, post-TCJA bracket reset in 2026).

**What goes in the DB** (annually variable):

- Standard deduction by filing status / year (+ age 65 add-ons)
- Federal ordinary income tax brackets by filing status / year
- IRA / 401(k) / HSA contribution limits + catch-up amounts by year
- Medicare Part B base premium by year
- (Optional later) IRMAA brackets, capital gains brackets, NIIT threshold

**What stays in code** (effectively static):

- RMD Uniform Lifetime Table (last change: 2022; lives in `UNIFORM_LIFETIME_DIVISOR`)
- RMD start age by birth year (SECURE / SECURE 2.0 statute)
- Social Security taxation tiers from Pub. 915 ($25k / $32k / $34k / $44k — unchanged since 1993)

Rationale: putting truly static values in the DB just adds setup burden with no benefit.

### 2. Seed-and-edit, not blank-and-fill

Ship migrations with the current published IRS values (2024, 2025, 2026) so the app works out of the box. Users edit only when they want to. Each row carries a `source` field (`seeded` vs `user_edited`) and an effective-date so the UI can show provenance.

### 3. New "Tax Details" page

A single page listing all editable IRS parameters by year, grouped by category. Read mostly; edit-in-place per row. No wizard, no scenarios — just a table of values with a "reset to seeded default" action per row.

### 4. Defer scenario / Roth conversion / withdrawal-strategy work

These are the largest pieces of work in the source doc and the *least* required for "usable." MVP focuses on making the existing projection trustworthy and explainable. Scenarios become a follow-on milestone.

---

## MVP Definition of "Usable"

A user can:

1. See current projections without being told "Federal tax is approximate" with no way to inspect the inputs.
2. View and edit IRS parameters via the **Tax Details** page.
3. Trust that values used in projections match what they see on Tax Details.
4. Understand what is and isn't modeled (assumptions panel).
5. Re-run after IRS publishes new values without waiting for a code release.

Notably **not** required for MVP: scenarios, Roth conversion modeling, withdrawal strategy picker, scenario builder wizard, audit-trail exports.

---

## Phases (Refined)

The original 12 phases collapse into 5 milestones below. Each milestone is independently shippable.

### Milestone 1 — Tax Parameter Foundation (MVP-critical)

**Why first:** Every other tax-related improvement depends on having tax data in the database rather than the source tree.

**Deliverables:**

- New tables (one migration: `012_tax_parameters.sql`):
  - `tax_year(year PK, status TEXT CHECK status IN ('published','projected'), inflation_pct NUMERIC, notes TEXT)`
  - `tax_standard_deduction(year FK, filing_status, amount, age65_add_on, source, modified)`
  - `tax_bracket(year FK, filing_status, ordinal, lower_bound, rate, source, modified)` (PK: year+filing_status+ordinal)
  - `tax_contribution_limit(year FK, kind ENUM('ira','401k_elective','hsa_individual','hsa_family'), base_amount, catch_up_amount, source, modified)`
  - `tax_medicare_part_b(year FK, monthly_premium, source, modified)`
- Seed data for 2024, 2025, 2026 matching values currently hardcoded in `server.js` (verified diff against IRS Rev. Proc. + CMS).
- Backend service `backend/services/taxParameters.js` with:
  - `getStandardDeduction(year, filingStatus, p1Age, p2Age)`
  - `getFederalBrackets(year, filingStatus)`
  - `getContributionLimits(year)`
  - `getMedicarePartB(year)`
  - All look up DB rows; if missing, project forward from latest published year using `inflation_pct` (default 2.0%).
- Refactor: replace inline constants in `server.js` (lines ~980, 1130, 1151–1164, 1307, 1352) with service calls. **Behavior must be identical** for existing test cases — add a snapshot test of `/api/projections` and `/api/savings-limits` before the refactor.
- New endpoints:
  - `GET  /api/tax-parameters?year=<y>` — returns all params for a year
  - `GET  /api/tax-parameters/years` — list of years with status
  - `PUT  /api/tax-parameters/standard-deduction/:year/:filing_status`
  - `PUT  /api/tax-parameters/bracket/:year/:filing_status/:ordinal`
  - `PUT  /api/tax-parameters/contribution-limit/:year/:kind`
  - `PUT  /api/tax-parameters/medicare-part-b/:year`
  - `POST /api/tax-parameters/:year/reset` — wipe user edits, restore seeded values for a year
- Frontend page `frontend/src/pages/TaxDetailsPage.jsx` linked in `App.jsx` nav as "Tax details" (between "Savings limits" and "Projections").
  - Year selector at top.
  - Four cards: Standard Deduction, Tax Brackets, Contribution Limits, Medicare Part B.
  - Inline edit per row. Each row shows: current value, badge (`seeded` / `edited`), tooltip with `source` text and last-modified date.
  - "Reset year to defaults" button per year.
- Display rule everywhere a tax number appears in the UI: show the year + status (e.g. `2026 published` or `2031 projected (2.0%/yr from 2026)`).

**Success criteria:**

- All existing projection numbers are unchanged after the refactor (snapshot test).
- User can edit a 2026 bracket value, see it reflected in `/projections` on next load, and reset to seeded default.
- IRS announces new 2027 numbers → user adds rows on Tax Details, no code change required.

---

### Milestone 2 — Trust & Transparency (MVP-critical)

**Why second:** Without disclosures, even correct numbers feel like a black box. Small, code-only changes.

**Deliverables:**

- Assumptions panel component, surfaced on Projections page (collapsed by default):
  - **Included:** federal income tax, standard deduction, ordinary brackets, RMDs (Uniform Lifetime), SS taxation (Pub. 915), Medicare Part B
  - **Not included:** state income tax, NIIT, AMT, IRMAA, tax credits, capital gains rates, estate tax, tax lots
  - **Source of truth:** link to `/tax-details` for each row, with year + status
- Precision labels next to every dollar figure in projections: `Published IRS Value` / `Projected (2.0%/yr)` / `User-edited`.
- Warning banner when projection horizon extends past the latest year with `published` tax data: "Beyond 2026 uses projected values. Edit on Tax Details to override."

**Success criteria:**

- New user opens Projections, scrolls down, can name three things the model excludes without leaving the page.
- Every dollar amount in a tax-related row carries a provenance label.

---

### Milestone 3 — Regression Test Suite (MVP-critical)

**Why third:** Locks in correctness before any new modeling features get added. Without it, Milestones 4+ silently break Milestone 1's numbers.

**Deliverables:**

- Backend test file `backend/services/taxParameters.test.js`:
  - Lookup hits for each year present in seed data
  - Projection for a year beyond seed data uses inflation
  - User edit overrides seed value
  - Reset removes user edits
- Backend test file `backend/services/taxEngine.test.js` (extract pure tax functions out of `server.js` into a `taxEngine.js` service if not already done in Milestone 1):
  - Standard deduction (each filing status, each age combination)
  - Bracket math at exact thresholds (off-by-one tests)
  - SS taxation tiers (under t0, between t0 and t1, above t1, max 85% cap)
  - Medicare Part B for known years + projected
- Snapshot test for `/api/projections` against a fixed household fixture — diff blocks any unintended numeric drift.
- CI guard (add to `package.json` test script): `npm test` runs all of the above; failing tests block.

**Success criteria:**

- `cd backend && npm test` runs in under 5 seconds and covers every pure function moved out of `server.js`.
- A deliberate one-cent change to a 2025 bracket fails the snapshot test loudly.

---

### Milestone 4 — Projection Usability (Quality of life)

**Why fourth:** Builds on the trusted foundation. No new modeling — only making existing outputs more useful.

**Deliverables:**

- Chart improvements (Projections page):
  - Account balance stacked by bucket: Pre-Tax, Roth, Taxable, Cash, HSA, Asset (already mostly present — verify and label)
  - Taxable income stack: Wages, Bonus, Social Security (taxable portion), RMD
  - Federal tax bar chart with bracket-level breakdown (data already exists in `federal_tax_brackets` on the projections response)
  - Spending source stack: Social Security, RMD, Wages/Bonus, Savings withdrawals
- Per-year detail drawer: click any year on a chart → side panel showing the row's full breakdown (taxable income components, deduction, brackets hit, RMD per account owner, ending balances by account).
- CSV export of the per-year table.

**Success criteria:**

- A user can answer "why did taxes spike in 2034?" by opening the detail drawer for that year.
- The CSV import-round-trips into a spreadsheet for offline analysis.

---

### Milestone 5 — Scenarios (Net-new feature, post-MVP)

**Why last:** This is the largest body of work and the source doc's biggest scope misestimate. Treat it as its own project after the MVP ships. Spec it separately when starting.

**Out-of-scope notes** for this plan — but worth recording as the eventual shape:

- New tables: `scenario`, `scenario_assumption`, `scenario_yearly_result`.
- Engine modules: `withdrawalEngine`, `rothConversionEngine`, `scenarioEngine` (orchestrator), `scenarioExplanationService`.
- UI: scenario list page → scenario builder wizard → scenario detail → scenario comparison grid.
- Withdrawal strategies: Conservative, Tax-Aware, Roth-Preservation, Custom — only ship after we have a regression test proving each produces measurably different lifetime tax outcomes (Phase 5 concern from source doc).

When that work starts, draft a fresh plan from a scenario-only brainstorming session. Do not try to design it now.

---

## Work Cut from the Original Doc

- **Phase 1 — Simple vs Advanced mode split.** With scenarios deferred, the page is not yet dense enough to need a mode toggle. Revisit when Milestone 5 lands.
- **Phase 2 — Scenario builder wizard.** Belongs to Milestone 5.
- **Phase 3 — Scenario explainability engine.** Belongs to Milestone 5.
- **Phase 5 — Withdrawal strategy alignment.** Net-new modeling work; belongs to Milestone 5.
- **Phase 6 — Scenario comparison improvements.** Belongs to Milestone 5.
- **Phase 10 — Scenario audit trail.** Belongs to Milestone 5. (Per-year drawer in Milestone 4 covers the audit need for the single existing projection.)
- **Phase 11 — Warning system.** Folded into Milestone 2's assumptions panel for the warnings that apply today (`projection horizon past published years`). Scenario-specific warnings ship with Milestone 5.
- **Phase 12 — Service layer cleanup.** Folded into Milestone 1 (extract `taxEngine.js`, `taxParameters.js`). The other proposed services don't need to exist until Milestone 5.

---

## Migration & Setup Notes

- Add migration `012_tax_parameters.sql` to `database/migrations/`.
- Update `README.md` setup section to document the new migration (existing pattern: numbered conditional migrations).
- No breaking change for existing users: seed values match current hardcoded values exactly, so projections produce identical numbers immediately after migration.

---

## Order of Operations Summary

| Milestone | Approx. effort | Ships independently? | Required for "usable"? |
|-----------|----------------|----------------------|------------------------|
| M1 — Tax parameter foundation | Medium (1 migration, 1 service, 1 page, refactor) | Yes | **Yes** |
| M2 — Trust & transparency     | Small (UI labels + panel)                         | Yes | **Yes** |
| M3 — Regression tests         | Small–medium (mostly extraction + test writing)   | Yes | **Yes** |
| M4 — Projection usability     | Medium (charts + drawer + CSV)                    | Yes | No (but high value) |
| M5 — Scenarios                | Large (new spec required)                         | Yes, separately | No |

Ship M1 → M2 → M3 together as one "usable v1" release. M4 follows. M5 is its own project.

---

## Open Questions

1. **Filing-status coverage on Tax Details:** ship with `single` + `married_filing_jointly` only (matching current code), or include all four IRS filing statuses up front? Recommend MFJ + single first; defer MFS/HoH unless the household record uses them.
2. **Inflation projection rate:** keep the current hardcoded 2.0%/year in `taxParameterInflationFactor`, or expose it on Tax Details as an editable household assumption? Recommend exposing it — it's a model assumption the user should be able to see and change.
3. **History vs. as-of edits:** when the user edits a 2026 bracket value, do we keep the seeded value as history (so they can diff their override) or replace it? Recommend replace + keep `source` flag — historical IRS values are recoverable from IRS publications if needed; in-DB history adds complexity for negligible value.

---

## Original 12 phases → milestones (reference)

The retired source doc used phases 1–12. This plan absorbs or defers each as follows:

| Original phase | Disposition | Milestone / notes |
|----------------|-------------|-------------------|
| 1 — Simple vs Advanced modes | **Cut** until scenarios exist | — |
| 2 — Scenario builder wizard | Deferred | M5 |
| 3 — Scenario explainability | Deferred | M5 |
| 4 — Tax parameter refactor | **Done in plan** (DB not per-year JS files) | M1 |
| 5 — Withdrawal strategy alignment | Deferred (net-new modeling) | M5 |
| 6 — Scenario comparison | Deferred | M5 |
| 7 — Trust & transparency | **In plan** (capital gains *not* listed as included — not modeled today) | M2 |
| 8 — Regression test suite | **In plan** (engines that do not exist yet: withdrawal, Roth, scenario — ship with M5) | M3 (+ M5 for scenario engines) |
| 9 — Chart usability | **Partial** | M4 (see deferred chart list below) |
| 10 — Scenario audit trail | **Partial** | M4 per-year drawer + CSV; JSON export and scenario-specific audit → M5 |
| 11 — Warning system | **Partial** | M2 horizon + assumptions; scenario/IRMAA/spending warnings → M5 |
| 12 — Service layer cleanup | **Partial** | M1 `taxParameters`, M3 `taxEngine` / `rmdEngine`; remaining services → M5 |

**Deferred from phase 9 (not in M4):** Roth conversion chart, dedicated RMD chart — require Roth conversion and strategy modeling (M5). Net-worth / feasibility charts already on Projections.

**Deferred from original “Milestone 4 — Polish”:** tax efficiency / RMD risk / flexibility scores, AI insights, onboarding — out of scope unless re-scoped in an M5 brainstorm.

---

## Plan coverage checklist

| Milestone | Strategic section | Executable plan |
|-----------|-------------------|-----------------|
| M1 | § Milestone 1 | `plans/2026-06-04-m1-tax-parameter-foundation.md` (12 tasks) |
| M2 | § Milestone 2 | `plans/2026-06-04-m2-trust-and-transparency.md` (5 tasks) |
| M3 | § Milestone 3 | `plans/2026-06-04-m3-regression-tests.md` (4 tasks) |
| M4 | § Milestone 4 | `plans/2026-06-04-m4-projection-usability.md` (8 tasks) |
| M5 | § Milestone 5 | `plans/2026-06-04-m5-scenarios-scoping.md` (scoping only) |

**Small gaps to close during implementation (not blockers):**

- Open question #2 (*inflation_pct* editable on Tax Details): add a task to M1 or a follow-up patch when resolving the question.
- M3 strategic text mentions `taxParameters` edit/reset tests; M1 already covers read-path tests — add API-level edit/reset regression in M1 Task 8 or M3 if not redundant with server tests.
