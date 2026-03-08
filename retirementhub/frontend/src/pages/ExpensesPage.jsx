import React, { useState, useEffect } from 'react';
import { getExpenseLines, updateExpenseLine, getMortgage, updateMortgage, getBudgetSummary, getRetirementTaxGuide, patchExpenseCategory } from '../api/api';

const GROUP_LABELS = {
  discretionary: 'Discretionary',
  fixed: 'Fixed',
  insurance: 'Insurance',
  utilities: 'Utilities',
  tax: 'Tax',
  personal: 'Personal',
};

function formatNum(n) {
  if (n == null || n === '') return '';
  const x = typeof n === 'number' ? n : parseFloat(n);
  if (Number.isNaN(x)) return '';
  return x.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function ExpensesPage() {
  const [lines, setLines] = useState([]);
  const [mortgage, setMortgage] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [mortgageSaving, setMortgageSaving] = useState(false);
  const [mortgageForm, setMortgageForm] = useState({ monthly_payment: '', payoff_date: '' });
  const [taxGuide, setTaxGuide] = useState(null);
  const [taxGuideYear, setTaxGuideYear] = useState(new Date().getFullYear());
  const [taxableIncomeInput, setTaxableIncomeInput] = useState('');
  const [taxGuideApplying, setTaxGuideApplying] = useState(null);
  const [patchingCategoryId, setPatchingCategoryId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const loadTaxGuide = async (year, taxableIncome) => {
    try {
      const params = { year: year || taxGuideYear };
      if (taxableIncome !== undefined && taxableIncome !== '' && !Number.isNaN(parseFloat(taxableIncome))) {
        params.taxable_income = parseFloat(taxableIncome);
      }
      const res = await getRetirementTaxGuide(params);
      setTaxGuide(res.data);
    } catch (e) {
      setTaxGuide(null);
    }
  };

  useEffect(() => {
    loadTaxGuide(taxGuideYear, taxableIncomeInput);
  }, [taxGuideYear]);

  const load = async () => {
    try {
      setLoading(true);
      const [linesRes, mortgageRes, summaryRes] = await Promise.all([
        getExpenseLines(),
        getMortgage(),
        getBudgetSummary(),
      ]);
      setLines(linesRes.data || []);
      const m = mortgageRes.data;
      setMortgage(m);
      setMortgageForm({
        monthly_payment: m?.monthly_payment != null ? String(m.monthly_payment) : '',
        payoff_date: m?.payoff_date ? String(m.payoff_date).slice(0, 10) : '',
      });
      setSummary(summaryRes.data || null);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleLineChange = (id, field, value) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const saveLine = async (line) => {
    setMessage(null);
    setSavingId(line.id);
    try {
      await updateExpenseLine(line.id, {
        as_of: line.as_of && String(line.as_of).trim() ? String(line.as_of).trim().slice(0, 10) : undefined,
        current_monthly: line.current_monthly != null ? parseFloat(line.current_monthly) : 0,
        retirement_monthly: line.retirement_monthly !== '' && line.retirement_monthly != null ? parseFloat(line.retirement_monthly) : null,
        actual_annual: line.actual_annual !== '' && line.actual_annual != null ? parseFloat(line.actual_annual) : null,
      });
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save line');
    } finally {
      setSavingId(null);
    }
  };

  const findLineByCategoryName = (name) => lines.find((l) => (l.category_name || '').trim().toLowerCase() === (name || '').trim().toLowerCase());

  const setCategoryType = async (categoryId, categoryType) => {
    setMessage(null);
    setPatchingCategoryId(categoryId);
    try {
      await patchExpenseCategory(categoryId, { category_type: categoryType });
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update category type');
    } finally {
      setPatchingCategoryId(null);
    }
  };

  const applyTaxSuggestion = async (categoryName, retirementMonthly) => {
    const line = findLineByCategoryName(categoryName);
    if (!line) {
      setMessage(`No expense line found for category "${categoryName}". Add one first or match the name exactly.`);
      return;
    }
    setTaxGuideApplying(categoryName);
    setMessage(null);
    try {
      await updateExpenseLine(line.id, {
        as_of: line.as_of && String(line.as_of).trim() ? String(line.as_of).trim().slice(0, 10) : undefined,
        current_monthly: line.current_monthly != null ? parseFloat(line.current_monthly) : 0,
        retirement_monthly: retirementMonthly,
        actual_annual: line.actual_annual !== '' && line.actual_annual != null ? parseFloat(line.actual_annual) : null,
      });
      await load();
      await loadTaxGuide(taxGuideYear, taxableIncomeInput);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to apply suggestion');
    } finally {
      setTaxGuideApplying(null);
    }
  };

  const handleEstimateFederal = () => {
    loadTaxGuide(taxGuideYear, taxableIncomeInput);
  };

  const handleMortgageSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setMortgageSaving(true);
    try {
      await updateMortgage({
        monthly_payment: mortgageForm.monthly_payment === '' ? undefined : parseFloat(mortgageForm.monthly_payment),
        payoff_date: mortgageForm.payoff_date && mortgageForm.payoff_date.trim() ? mortgageForm.payoff_date.trim() : null,
      });
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save mortgage');
    } finally {
      setMortgageSaving(false);
    }
  };

  const byGroup = lines.reduce((acc, line) => {
    const g = line.category_group || 'fixed';
    if (!acc[g]) acc[g] = [];
    acc[g].push(line);
    return acc;
  }, {});

  const groupOrder = ['discretionary', 'fixed', 'insurance', 'utilities', 'tax', 'personal'];

  if (loading && lines.length === 0) {
    return <p className="loading-message">Loading expenses…</p>;
  }

  return (
    <div className="page-scroll">
      <h1 className="page-title">Expenses</h1>
      {message && <div className="error-message">{message}</div>}

      {summary && (
        <div className="card">
          <h2>Budget summary</h2>
          <div className="budget-summary-grid">
            <div>
              <span className="summary-label">Current annual</span>
              <span className="summary-value">${formatNum(summary.current_annual)}</span>
            </div>
            <div>
              <span className="summary-label">Retirement annual</span>
              <span className="summary-value">${formatNum(summary.retirement_annual)}</span>
            </div>
            <div>
              <span className="summary-label">25× current (target)</span>
              <span className="summary-value">${formatNum(summary.target_25x_current)}</span>
            </div>
            <div>
              <span className="summary-label">25× retirement (target)</span>
              <span className="summary-value">${formatNum(summary.target_25x_retirement)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Mortgage</h2>
        <form onSubmit={handleMortgageSubmit} className="form-row">
          <div className="form-group">
            <label htmlFor="monthly_payment">Monthly payment $</label>
            <input
              id="monthly_payment"
              type="number"
              step="0.01"
              min="0"
              value={mortgageForm.monthly_payment}
              onChange={(e) => setMortgageForm((p) => ({ ...p, monthly_payment: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="payoff_date">Payoff date</label>
            <input
              id="payoff_date"
              type="date"
              value={mortgageForm.payoff_date}
              onChange={(e) => setMortgageForm((p) => ({ ...p, payoff_date: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={mortgageSaving}>
              {mortgageSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Tax categories in retirement</h2>
        <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.9rem' }}>
          Adjust retirement/monthly for Federal, Medicare, and Social Security to reflect post-retirement rules. Use the notes and suggestions below; values come from IRS brackets and CMS Part B premiums.
        </p>
        {taxGuide && (
          <div className="tax-guide">
            <div className="tax-guide-block">
              <strong>Social Security (OASDI)</strong>
              <p className="tax-guide-note">{taxGuide.social_security?.note}</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyTaxSuggestion('Social Security', 0)}
                disabled={taxGuideApplying === 'Social Security'}
              >
                {taxGuideApplying === 'Social Security' ? '…' : 'Set retirement/mo to 0'}
              </button>
            </div>
            <div className="tax-guide-block">
              <strong>Medicare</strong>
              <p className="tax-guide-note">{taxGuide.medicare?.note}</p>
              <div className="form-row" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="tax-guide-year">Part B premium year</label>
                  <select id="tax-guide-year" value={taxGuideYear} onChange={(e) => setTaxGuideYear(parseInt(e.target.value, 10))}>
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <span style={{ marginLeft: '0.5rem' }}>
                  Suggested: ${formatNum(taxGuide.medicare?.retirement_monthly_suggested)}/mo
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyTaxSuggestion('Medicare', taxGuide.medicare?.retirement_monthly_suggested)}
                disabled={taxGuideApplying === 'Medicare'}
              >
                {taxGuideApplying === 'Medicare' ? '…' : 'Set Medicare retirement to suggested'}
              </button>
            </div>
            <div className="tax-guide-block">
              <strong>Federal income tax</strong>
              <p className="tax-guide-note">{taxGuide.federal?.note}</p>
              <div className="form-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="taxable-income">Taxable income (annual) $</label>
                  <input
                    id="taxable-income"
                    type="number"
                    step="100"
                    min="0"
                    placeholder="e.g. 50000"
                    value={taxableIncomeInput}
                    onChange={(e) => setTaxableIncomeInput(e.target.value)}
                  />
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleEstimateFederal}>
                  Estimate tax
                </button>
              </div>
              {taxGuide.federal?.estimated_monthly != null && (
                <p style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  Estimated: ${formatNum(taxGuide.federal.estimated_annual_tax)}/year → ${formatNum(taxGuide.federal.estimated_monthly)}/mo
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: '0.75rem' }}
                    onClick={() => applyTaxSuggestion('Federal', taxGuide.federal.estimated_monthly)}
                    disabled={taxGuideApplying === 'Federal'}
                  >
                    {taxGuideApplying === 'Federal' ? '…' : 'Set Federal retirement to this'}
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

      </div>

      <div className="card">
        <h2>Expense categories</h2>
        <p style={{ marginBottom: '0.5rem', color: '#5a6b64', fontSize: '0.9rem' }}>
          Current monthly and retirement monthly. Amounts are stored by “as of” date so history is kept; the most recent snapshot is shown.
        </p>
        <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.85rem' }}>
          If you enter <strong>0</strong> for Retirement/mo, that category is not included in the retirement budget.
          <strong> P2 health until Medicare:</strong> use for health insurance for P2 when P1 is already on Medicare but P2 is not yet 65. In Projections this amount is only included for those years (and gets COLA).
        </p>
        <div className="expense-table-wrap">
          <table className="expense-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Group</th>
                <th>In projections</th>
                <th>Current/mo $</th>
                <th>Retirement/mo $</th>
                <th>As of</th>
                <th>Actual annual $</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groupOrder.map((group) =>
                (byGroup[group] || []).map((line) => (
                  <tr key={line.id}>
                    <td>{line.category_name}</td>
                    <td>{GROUP_LABELS[line.category_group] || line.category_group}</td>
                    <td>
                      <select
                        value={line.category_type || 'regular'}
                        onChange={(e) => setCategoryType(line.expense_category_id, e.target.value)}
                        disabled={patchingCategoryId === line.expense_category_id}
                        title={line.category_type === 'p2_health_until_medicare' ? 'Only counted in Projections when P1 is on Medicare and P2 is under 65' : 'Counted every year in Projections'}
                      >
                        <option value="regular">Regular</option>
                        <option value="p2_health_until_medicare">P2 health until Medicare</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input-cell"
                        value={line.current_monthly != null ? line.current_monthly : ''}
                        onChange={(e) => handleLineChange(line.id, 'current_monthly', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input-cell"
                        placeholder="Same as current; 0 = not in retirement"
                        value={line.retirement_monthly != null ? line.retirement_monthly : ''}
                        onChange={(e) => handleLineChange(line.id, 'retirement_monthly', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="input-cell input-cell-date"
                        value={line.as_of ? String(line.as_of).slice(0, 10) : ''}
                        onChange={(e) => handleLineChange(line.id, 'as_of', e.target.value)}
                        title="As of date for this snapshot"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input-cell"
                        placeholder="Optional"
                        value={line.actual_annual != null ? line.actual_annual : ''}
                        onChange={(e) => handleLineChange(line.id, 'actual_annual', e.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => saveLine(line)}
                        disabled={savingId === line.id}
                      >
                        {savingId === line.id ? '…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
