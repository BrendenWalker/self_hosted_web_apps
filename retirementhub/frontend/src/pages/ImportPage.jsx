import React, { useState } from 'react';
import {
  importExpensesCsv,
  importAccountBalancesCsv,
} from '../api/api';

const EXPENSE_SAMPLE_3COL = `category_name,category_group,actual_annual
Fuel,fixed,2213.63
Mad Money,discretionary,13998.41
Travel,discretionary,469.60`;

const EXPENSE_SAMPLE_2COL = `Discretionary:Home Improvement,389.73
Discretionary:Mad Money:Educational,159.00
Fixed:Auto Fuel,2213.63`;

const BALANCE_SAMPLE = `account_name,balance
Ally Savings,12500.00
Livelyme,3200.50`;

export default function ImportPage() {
  const defaultAsOf = () => {
    const y = new Date().getFullYear();
    return `${y}-12-31`;
  };
  const [expenseFile, setExpenseFile] = useState(null);
  const [expenseAsOf, setExpenseAsOf] = useState(defaultAsOf());
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseResult, setExpenseResult] = useState(null);

  const [balanceFile, setBalanceFile] = useState(null);
  const [balanceAsOf, setBalanceAsOf] = useState(defaultAsOf());
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceResult, setBalanceResult] = useState(null);

  const [message, setMessage] = useState(null);

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseFile) {
      setMessage('Please select a CSV file');
      return;
    }
    if (!expenseAsOf || !expenseAsOf.trim()) {
      setMessage('Please select an As of date');
      return;
    }
    setMessage(null);
    setExpenseResult(null);
    setExpenseLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', expenseFile);
      formData.append('as_of', expenseAsOf.trim());
      const res = await importExpensesCsv(formData);
      setExpenseResult(res.data);
      setExpenseFile(null);
      e.target.reset();
      setExpenseAsOf(defaultAsOf());
    } catch (err) {
      setMessage(err.response?.data?.error || 'Import failed');
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleBalanceSubmit = async (e) => {
    e.preventDefault();
    if (!balanceFile) {
      setMessage('Please select a CSV file');
      return;
    }
    if (!balanceAsOf || !balanceAsOf.trim()) {
      setMessage('Please select an As of date');
      return;
    }
    setMessage(null);
    setBalanceResult(null);
    setBalanceLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', balanceFile);
      formData.append('as_of', balanceAsOf.trim());
      const res = await importAccountBalancesCsv(formData);
      setBalanceResult(res.data);
      setBalanceFile(null);
      e.target.reset();
      setBalanceAsOf(defaultAsOf());
    } catch (err) {
      setMessage(err.response?.data?.error || 'Import failed');
    } finally {
      setBalanceLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Import data</h1>
      <p style={{ marginBottom: '1.5rem', color: '#5a6b64', fontSize: '0.95rem' }}>
        Upload CSV files generated from your GnuCash (or similar) end-of-year reports to populate expense totals and account balances. Use the samples below as a template.
      </p>
      {message && <div className="error-message">{message}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2>Import expense totals</h2>
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#5a6b64' }}>
          Format is detected by column count. <strong>Two columns</strong>: category path and amount (e.g. <code>Discretionary:Home Improvement,389.73</code> or <code>Group:Sub:Name,amount</code> — text before the first <code>:</code> is category group, text after the last <code>:</code> is category name; if there is no <code>:</code>, the value is used for both). <strong>Three or more columns</strong>: <code>category_name</code>, <code>category_group</code>, <code>actual_annual</code>. Category group must be one of: discretionary, fixed, insurance, utilities, tax, personal. Categories are created automatically if they don’t exist. Select the <strong>As of date</strong> (e.g. end of year).
        </p>
        <form onSubmit={handleExpenseSubmit} className="form-row">
          <div className="form-group">
            <label htmlFor="expense_file">CSV file</label>
            <input
              id="expense_file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setExpenseFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="expense_as_of">As of date</label>
            <input
              id="expense_as_of"
              type="date"
              value={expenseAsOf}
              onChange={(e) => setExpenseAsOf(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={expenseLoading}>
              {expenseLoading ? 'Importing…' : 'Import expenses'}
            </button>
          </div>
        </form>
        {expenseResult && (
          <div className="import-result" style={{ marginTop: '1rem', padding: '0.75rem', background: '#f0f7f4', borderRadius: 4 }}>
            <strong>Result:</strong> {expenseResult.imported} imported
            {expenseResult.categories_created != null && expenseResult.categories_created > 0 && (
              <>, {expenseResult.categories_created} new categor{expenseResult.categories_created === 1 ? 'y' : 'ies'} created</>
            )}
            {expenseResult.skipped > 0 && (<>; {expenseResult.skipped} skipped</>)}
            {expenseResult.errors > 0 && (<>; {expenseResult.errors} errors</>)}.
            {expenseResult.details?.categories_created?.length > 0 && (
              <div style={{ marginTop: 0.5, fontSize: '0.9rem' }}>New categories: {expenseResult.details.categories_created.join(', ')}</div>
            )}
            {expenseResult.details?.skipped?.length > 0 && (
              <div style={{ marginTop: 0.5, fontSize: '0.9rem' }}>Skipped: {expenseResult.details.skipped.map((s) => s.category).join(', ')}</div>
            )}
            {expenseResult.details?.errors?.length > 0 && (
              <div style={{ marginTop: 0.5, fontSize: '0.9rem', color: '#c00' }}>Errors: {expenseResult.details.errors.map((e) => `${e.category}: ${e.reason}`).join('; ')}</div>
            )}
          </div>
        )}
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.9rem' }}>Sample CSV (two formats)</summary>
          <p style={{ marginTop: 0.5, fontSize: '0.85rem', color: '#5a6b64' }}>Three columns (with header):</p>
          <pre style={{ marginTop: 0.25, padding: '0.5rem', background: '#f5f5f5', fontSize: '0.85rem', overflow: 'auto' }}>{EXPENSE_SAMPLE_3COL}</pre>
          <p style={{ marginTop: 0.5, fontSize: '0.85rem', color: '#5a6b64' }}>Two columns (no header — group:name or group:sub:name, amount):</p>
          <pre style={{ marginTop: 0.25, padding: '0.5rem', background: '#f5f5f5', fontSize: '0.85rem', overflow: 'auto' }}>{EXPENSE_SAMPLE_2COL}</pre>
        </details>
      </div>

      <div className="card">
        <h2>Import account balances</h2>
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#5a6b64' }}>
          Use this for end-of-year balances from your <strong>Transaction Report</strong> (savings/accounts). CSV columns: <code>account_name</code>, <code>balance</code>. Select the <strong>As of date</strong> below (e.g. end of year). If an account name does not exist, it will be created as a Savings account (you can change type on the Accounts page).
        </p>
        <form onSubmit={handleBalanceSubmit} className="form-row">
          <div className="form-group">
            <label htmlFor="balance_file">CSV file</label>
            <input
              id="balance_file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setBalanceFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="balance_as_of">As of date</label>
            <input
              id="balance_as_of"
              type="date"
              value={balanceAsOf}
              onChange={(e) => setBalanceAsOf(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={balanceLoading}>
              {balanceLoading ? 'Importing…' : 'Import balances'}
            </button>
          </div>
        </form>
        {balanceResult && (
          <div className="import-result" style={{ marginTop: '1rem', padding: '0.75rem', background: '#f0f7f4', borderRadius: 4 }}>
            <strong>Result:</strong> {balanceResult.imported} balances imported, {balanceResult.accounts_created} new accounts created, {balanceResult.errors} errors.
            {balanceResult.details?.accounts_created?.length > 0 && (
              <div style={{ marginTop: 0.5, fontSize: '0.9rem' }}>New accounts: {balanceResult.details.accounts_created.join(', ')}</div>
            )}
            {balanceResult.details?.errors?.length > 0 && (
              <div style={{ marginTop: 0.5, fontSize: '0.9rem', color: '#c00' }}>Errors: {balanceResult.details.errors.map((e) => `${e.account}: ${e.reason}`).join('; ')}</div>
            )}
          </div>
        )}
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.9rem' }}>Sample CSV</summary>
          <pre style={{ marginTop: 0.5, padding: '0.5rem', background: '#f5f5f5', fontSize: '0.85rem', overflow: 'auto' }}>{BALANCE_SAMPLE}</pre>
        </details>
      </div>
    </div>
  );
}
