# Milestone 5 — Scenarios (Scoping Document)

**Status:** *Scoping only — not a bite-sized implementation plan.*

The strategic plan (`docs/implementation_plan.md`) intentionally deferred a detailed plan for Milestone 5. Scenarios are the largest body of net-new work in the project; an earlier proposal incorrectly treated them as cleanup of features that **do not exist** in the code today (see the reality-check table in the strategic plan). Before writing tasks, run a dedicated brainstorming session — see "How to start" below.

This document scopes the work so the eventual brainstorm starts from a shared baseline.

---

## What "Scenarios" means in this product

A scenario is a named set of household-level assumptions that overrides the household defaults for a single projection run. Today the projection uses one fixed set of inputs (retirement dates, SS estimates, growth rates, expense rows). Scenarios let the user run "what if I retire two years earlier?" or "what if I do Roth conversions from 62–66?" without destroying the baseline data.

A scenario should produce its own full per-year projection output and store it so two or more scenarios can be compared side-by-side.

---

## Why this is M5, not M1

| Reason | Detail |
|---|---|
| Largest single code surface | New tables, new engine modules, new builder UI, new comparison UI |
| Depends on M1 | Tax parameters must live in the DB so a scenario can override them (e.g. simulating a future bracket change) |
| Depends on M3 | Without regression tests, scenario engine bugs silently change projection numbers |
| Not required for "usable" | M1+M2+M3 already give a trustworthy single-projection tool — the MVP definition |

---

## Subsystems to design (each is a brainstorming subtopic)

### 5A. Data model

Tables to add:
- `scenario` — id, name, base_household_snapshot, created, modified, notes
- `scenario_assumption` — scenario_id, key (e.g. `p1_retirement_date`, `p1_ss_claim_age`, `roth_conversion_rule`), value (JSONB)
- `scenario_yearly_result` — scenario_id, year, materialized row (denormalized for fast comparison)

**Open questions:** do we snapshot the entire household at scenario creation, or compute "delta from current household" each run? (Recommendation: snapshot — otherwise comparison gets weird when the user edits household data after creating a scenario.)

### 5B. Withdrawal strategies

The original Phase 5 sketched four strategies: Conservative, Tax-Aware, Roth-Preservation, Custom. The current projection uses a single fixed waterfall. **Strategies must produce measurably different lifetime tax outcomes**; if Tax-Aware and Conservative produce the same number for a given household, the test should fail.

New module: `backend/services/withdrawalEngine.js` — pure functions of (account balances, target spend, year, household ages, brackets) → withdrawals per account.

### 5C. Roth conversion modeling

Modes: none, fixed-amount-per-year, fill-up-to-12%-bracket, fill-up-to-22%-bracket, fill-up-to-IRMAA-threshold, fill-up-to-custom-income-target.

New module: `backend/services/rothConversionEngine.js`.

### 5D. Scenario engine (orchestrator)

`backend/services/scenarioEngine.js` — given a scenario, calls projection engine with overrides applied, captures all per-year intermediate state, persists `scenario_yearly_result`.

### 5E. Scenario builder UI

Multi-step wizard (the original Phase 2). Steps: basics → retirement timing → SS claiming → spending → withdrawal strategy → Roth strategy → review.

### 5F. Scenario comparison UI

Grid with sortable columns (lifetime tax, ending net worth, peak RMD, etc.). Summary "card" callouts: lowest lifetime tax, highest ending net worth.

### 5G. Scenario explainability

`backend/services/scenarioExplanationService.js` — given two scenario results, produce structured narrative:

```json
{
  "summary": "Scenario B reduces lifetime taxes by $42,000 by converting IRA balances from 62 to 67.",
  "drivers": ["Roth conversions added $X in taxes 62-66", "Reduced RMDs cut $Y in taxes 73-90"],
  "warnings": ["IRMAA threshold crossed in 2028"]
}
```

---

## Open product questions for the brainstorm

1. **Scope cap.** Does M5 ship all of 5A–5G, or just 5A+5D+5F+5E ("MVP scenarios") with 5B/5C/5G as follow-on?
2. **Number of strategies.** Is "Tax-Aware vs Conservative" enough difference to justify the strategy machinery? Or should we ship one strategy (e.g. Tax-Aware) and skip the picker?
3. **Custom withdrawal ordering.** Skippable for first ship?
4. **Sensitivity to inflation/return assumptions.** A scenario currently inherits household-level growth rates. Should scenarios be able to override these too (e.g. "what if portfolio returns 3% instead of 5%")?
5. **State tax.** Still firmly **out of scope** per the strategic plan. Re-confirm during brainstorm.
6. **AI insights.** The source doc mentioned "AI insights" in Milestone 4. Skip — not aligned with the explainability-via-engine direction.

---

## How to start (when ready)

1. Run a dedicated brainstorming session:

```bash
# (separate session, fresh context)
/superpowers:brainstorm
```

   Frame it as: "Designing scenarios for RetirementHub. Strategic plan is in `docs/implementation_plan.md`; M1–M4 are shipped. Goal: a single scenarios feature that produces measurable difference vs baseline, with comparison UI."

2. Resolve the seven open questions above with the user.

3. Write the actual implementation plan: `docs/plans/YYYY-MM-DD-m5-scenarios.md`. Aim for it to follow the same task structure as M1.

4. Consider splitting into two plans if the brainstorm shows more than ~30 tasks:
   - `m5a-scenarios-foundation.md` — data model, engine, single strategy, basic compare grid
   - `m5b-scenarios-advanced.md` — strategy picker, Roth conversion modes, explainability, wizard polish

---

## Definition of Done — M5 (placeholder, finalize during brainstorm)

- [ ] Users can create at least one named scenario
- [ ] Scenarios produce different projection outputs than baseline when assumptions differ
- [ ] At least one withdrawal strategy and one Roth conversion mode are implemented and tested
- [ ] Scenario comparison shows two or more scenarios side by side on a single screen
- [ ] All scenario engines have ≥90% line coverage
- [ ] The `taxEngine` / `rmdEngine` / `taxParameters` from M1/M3 are reused — no duplicated tax math
