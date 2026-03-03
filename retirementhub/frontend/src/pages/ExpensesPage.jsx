import React, { useState, useEffect } from 'react';
import { getExpenseLines, updateExpenseLine, getMortgage, updateMortgage, getBudgetSummary } from '../api/api';

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

  useEffect(() => {
    load();
  }, []);

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
    <div>
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
        <h2>Expense categories</h2>
        <p style={{ marginBottom: '0.5rem', color: '#5a6b64', fontSize: '0.9rem' }}>
          Current monthly and retirement monthly. Amounts are stored by “as of” date so history is kept; the most recent snapshot is shown.
        </p>
        <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.85rem' }}>
          If you enter <strong>0</strong> for Retirement/mo, that category is not included in the retirement budget.
        </p>
        <div className="expense-table-wrap">
          <table className="expense-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Group</th>
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
