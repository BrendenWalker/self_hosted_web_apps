import React, { useState, useEffect } from 'react';
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountBalances,
  getAccountBalancesHistory,
  upsertAccountBalance,
  deleteAccountBalance,
  getAccountTaxProfile,
  updateAccountTaxProfile,
} from '../api/api';
import { parseBalanceRowId, parsePositiveIntId } from '../utils/parseIds';
import { formatApiError, apiErrorDebug } from '../utils/formatApiError';

function sameAccountId(a, b) {
  const x = parsePositiveIntId(a);
  const y = parsePositiveIntId(b);
  return x != null && x === y;
}

const ACCOUNT_TYPES = [
  { value: 'savings', label: 'Savings' },
  { value: 'checking', label: 'Checking' },
  { value: 'hsa', label: 'HSA' },
  { value: 'ira_traditional', label: 'IRA (traditional)' },
  { value: 'ira_roth', label: 'IRA (Roth)' },
  { value: '401k_traditional', label: '401(k) (traditional)' },
  { value: '401k_roth', label: '401(k) (Roth)' },
  { value: 'taxable', label: 'Taxable (brokerage, etc.)' },
  { value: 'asset', label: 'Asset (vehicle, property value, etc.)' },
];

const OWNER_TYPES = [
  { value: 'p1', label: 'P1' },
  { value: 'p2', label: 'P2' },
  { value: 'joint', label: 'Joint' },
];

/** Traditional accounts subject to RMD rules in projections */
function isTraditionalRetirement(type) {
  return type === 'ira_traditional' || type === '401k_traditional';
}

const RMD_OWNER_OPTIONS = [
  { value: '', label: 'Same as owner' },
  { value: 'p1', label: 'P1 (RMD on P1)' },
  { value: 'p2', label: 'P2 (RMD on P2)' },
  { value: 'joint', label: 'Joint (50/50 RMD split)' },
];

function formatAssetAnnualChange(pct) {
  if (pct == null || pct === '') return 'no annual change set';
  const n = Number(pct);
  if (!Number.isFinite(n) || n === 0) return '0% change / yr';
  if (n > 0) return `${n}% dep. / yr`;
  return `${Math.abs(n)}% appr. / yr`;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [errorDebug, setErrorDebug] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    account_type: 'taxable',
    owner_type: 'joint',
    expected_depreciation_pct: '',
    rmd_owner_type: '',
    liquidate_in_retirement: false,
  });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    account_type: 'taxable',
    owner_type: 'joint',
    expected_depreciation_pct: '',
    rmd_owner_type: '',
    liquidate_in_retirement: false,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [balanceFormAccountId, setBalanceFormAccountId] = useState(null);
  const [balanceFormBalanceId, setBalanceFormBalanceId] = useState(null);
  const [balanceForm, setBalanceForm] = useState({ as_of: '', balance: '' });
  const [balancesByAccount, setBalancesByAccount] = useState({});
  const [expandedHistoryAccountId, setExpandedHistoryAccountId] = useState(null);
  const [balanceHistory, setBalanceHistory] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [taxProfileForm, setTaxProfileForm] = useState({
    cost_basis: '',
    unrealized_gain_percent: '',
    dividend_yield: '',
    qualified_dividend_percent: '100',
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [accountsRes, balancesRes] = await Promise.all([
        getAccounts(),
        getAccountBalances().catch(() => ({ data: [] })),
      ]);
      setAccounts(accountsRes.data || []);
      const byAcc = {};
      (balancesRes.data || []).forEach((b) => {
        const accountKey = parsePositiveIntId(b.account_id);
        if (accountKey == null) return;
        byAcc[accountKey] = {
          balance_id: parseBalanceRowId(b),
          balance: b.balance,
          as_of: b.as_of,
        };
      });
      setBalancesByAccount(byAcc);
      setMessage(null);
      setErrorDebug(null);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const name = addForm.name?.trim();
    if (!name) {
      setMessage('Account name is required');
      return;
    }
    setMessage(null);
    setSaving(true);
    try {
      const payload = {
        name,
        account_type: addForm.account_type,
        owner_type: addForm.owner_type,
      };
      if (addForm.account_type === 'asset') {
        const raw = addForm.expected_depreciation_pct?.trim();
        payload.expected_depreciation_pct = raw === '' ? null : parseFloat(raw);
        payload.liquidate_in_retirement = !!addForm.liquidate_in_retirement;
      }
      if (isTraditionalRetirement(addForm.account_type)) {
        const raw = addForm.rmd_owner_type?.trim();
        payload.rmd_owner_type = raw === '' || raw == null ? null : raw;
      }
      await createAccount(payload);
      setAddForm({
        name: '',
        account_type: 'taxable',
        owner_type: 'joint',
        expected_depreciation_pct: '',
        rmd_owner_type: '',
        liquidate_in_retirement: false,
      });
      setShowAdd(false);
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = async (acc) => {
    setEditingId(acc.id);
    setEditForm({
      name: acc.name,
      account_type: acc.account_type,
      owner_type: acc.owner_type,
      expected_depreciation_pct:
        acc.expected_depreciation_pct != null ? String(acc.expected_depreciation_pct) : '',
      rmd_owner_type: acc.rmd_owner_type != null ? String(acc.rmd_owner_type) : '',
      liquidate_in_retirement: !!acc.liquidate_in_retirement,
    });
    if (acc.account_type === 'taxable') {
      try {
        const res = await getAccountTaxProfile(acc.id);
        const tp = res.data;
        setTaxProfileForm({
          cost_basis: tp?.cost_basis != null ? String(tp.cost_basis) : '',
          unrealized_gain_percent:
            tp?.unrealized_gain_percent != null ? String(tp.unrealized_gain_percent) : '',
          dividend_yield:
            tp?.dividend_yield != null ? String(Number(tp.dividend_yield) * 100) : '',
          qualified_dividend_percent:
            tp?.qualified_dividend_percent != null ? String(tp.qualified_dividend_percent) : '100',
        });
      } catch {
        setTaxProfileForm({
          cost_basis: '',
          unrealized_gain_percent: '30',
          dividend_yield: '2',
          qualified_dividend_percent: '100',
        });
      }
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const name = editForm.name?.trim();
    if (!name) {
      setMessage('Account name is required');
      return;
    }
    setMessage(null);
    setSaving(true);
    try {
      const payload = {
        name,
        account_type: editForm.account_type,
        owner_type: editForm.owner_type,
      };
      if (editForm.account_type === 'asset') {
        const raw = editForm.expected_depreciation_pct?.trim();
        payload.expected_depreciation_pct = raw === '' ? null : parseFloat(raw);
        payload.liquidate_in_retirement = !!editForm.liquidate_in_retirement;
      }
      if (isTraditionalRetirement(editForm.account_type)) {
        const raw = editForm.rmd_owner_type?.trim();
        payload.rmd_owner_type = raw === '' || raw == null ? null : raw;
      }
      await updateAccount(editingId, payload);
      if (editForm.account_type === 'taxable') {
        const divRaw = taxProfileForm.dividend_yield?.trim();
        await updateAccountTaxProfile(editingId, {
          cost_basis:
            taxProfileForm.cost_basis?.trim() !== ''
              ? parseFloat(taxProfileForm.cost_basis)
              : null,
          unrealized_gain_percent:
            taxProfileForm.unrealized_gain_percent?.trim() !== ''
              ? parseFloat(taxProfileForm.unrealized_gain_percent)
              : null,
          dividend_yield:
            divRaw !== '' && Number.isFinite(parseFloat(divRaw))
              ? parseFloat(divRaw) / 100
              : null,
          qualified_dividend_percent:
            taxProfileForm.qualified_dividend_percent?.trim() !== ''
              ? parseFloat(taxProfileForm.qualified_dividend_percent)
              : 100,
        });
      }
      setEditingId(null);
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setMessage(null);
    setDeletingId(id);
    try {
      await deleteAccount(id);
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setDeletingId(null);
    }
  };

  const closeBalanceForm = () => {
    setBalanceFormAccountId(null);
    setBalanceFormBalanceId(null);
  };

  const openBalanceForm = (acc, balanceRow = null) => {
    if (sameAccountId(balanceFormAccountId, acc.id) && balanceRow == null && balanceFormBalanceId == null) {
      closeBalanceForm();
      return;
    }
    const accountKey = parsePositiveIntId(acc.id);
    const b = balanceRow ?? (accountKey != null ? balancesByAccount[accountKey] : null);
    const today = new Date().toISOString().slice(0, 10);
    setBalanceFormAccountId(parsePositiveIntId(acc.id));
    setBalanceFormBalanceId(balanceRow ? parseBalanceRowId(balanceRow) : null);
    setBalanceForm({
      as_of: b?.as_of ? String(b.as_of).slice(0, 10) : today,
      balance: b != null && b.balance != null ? String(b.balance) : '',
    });
    if (expandedHistoryAccountId != null && !sameAccountId(expandedHistoryAccountId, acc.id)) {
      setExpandedHistoryAccountId(null);
    }
  };

  const toggleHistory = async (accountIdRaw) => {
    const accountId = parsePositiveIntId(accountIdRaw);
    if (accountId == null) return;
    if (expandedHistoryAccountId === accountId) {
      setExpandedHistoryAccountId(null);
      return;
    }
    closeBalanceForm();
    setExpandedHistoryAccountId(accountId);
    if (!balanceHistory[accountId]) {
      setHistoryLoading(true);
      try {
        const res = await getAccountBalancesHistory(accountId);
        setBalanceHistory((prev) => ({ ...prev, [accountId]: res.data || [] }));
      } catch (err) {
        setMessage(formatApiError(err, 'Failed to load balance history'));
        setErrorDebug(apiErrorDebug(err));
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const handleBalanceDelete = async (balanceRow, accountId) => {
    setMessage(null);
    const balanceRowId = parseBalanceRowId(balanceRow);
    if (balanceRowId == null) {
      setMessage('Cannot delete: invalid balance record id');
      return;
    }
    try {
      await deleteAccountBalance(balanceRowId);
      const res = await getAccountBalancesHistory(accountId);
      setBalanceHistory((prev) => ({ ...prev, [accountId]: res.data || [] }));
      await load();
    } catch (err) {
      setMessage(formatApiError(err, 'Failed to delete balance'));
      setErrorDebug(apiErrorDebug(err));
    }
  };

  const handleBalanceSubmit = async (e, accountIdFromCard) => {
    e.preventDefault();
    const accountId =
      parsePositiveIntId(accountIdFromCard) ?? parsePositiveIntId(balanceFormAccountId);
    if (!accountId) {
      setMessage('Invalid account');
      return;
    }
    setMessage(null);
    setSaving(true);
    const payload = {
      as_of: balanceForm.as_of || new Date().toISOString().slice(0, 10),
      balance: balanceForm.balance === '' ? 0 : parseFloat(balanceForm.balance),
    };
    if (!Number.isFinite(payload.balance) || payload.balance < 0) {
      setMessage('Balance must be a non-negative number');
      setSaving(false);
      return;
    }
    try {
      await upsertAccountBalance({
        account_id: accountId,
        ...payload,
      });
      closeBalanceForm();
      if (expandedHistoryAccountId === accountId) {
        const res = await getAccountBalancesHistory(accountId);
        setBalanceHistory((prev) => ({ ...prev, [accountId]: res.data || [] }));
      }
      await load();
    } catch (err) {
      setMessage(formatApiError(err, 'Failed to save balance'));
      setErrorDebug(apiErrorDebug(err));
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = (value) => ACCOUNT_TYPES.find((t) => t.value === value)?.label || value;
  const ownerLabel = (value) => OWNER_TYPES.find((o) => o.value === value)?.label || value;

  if (loading && accounts.length === 0) {
    return <p className="loading-message">Loading accounts…</p>;
  }

  return (
    <div className="page-scroll">
      <h1 className="page-title">Accounts</h1>
      <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.95rem' }}>
        Add any number of accounts: savings, checking, HSA, IRA (traditional or Roth), 401(k) (traditional or Roth), taxable, and assets (e.g. vehicle or property value). For traditional IRA and traditional 401(k), set <strong>RMD owner</strong> so each person’s required distributions use the correct balance (or choose “same as owner”). For assets, set expected annual change (positive = depreciation, negative = appreciation) and optionally allow liquidation in retirement to cover expense shortfalls. Record balances with an “as of” date; the latest balance per account is used for projections and history is kept.
      </p>
      {message && <div className="error-message">{message}</div>}
      {errorDebug && (
        <pre className="error-debug-panel" aria-label="Error debug details">
          {JSON.stringify(errorDebug, null, 2)}
        </pre>
      )}

      <div className="card">
        <div className="card-header-row">
          <h2>Your accounts</h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAdd(!showAdd)}
          >
            {showAdd ? 'Cancel' : 'Add account'}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAddSubmit} className="accounts-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="add_name">Name</label>
                <input
                  id="add_name"
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Main 401(k)"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="add_type">Type</label>
                <select
                  id="add_type"
                  value={addForm.account_type}
                  onChange={(e) => setAddForm((p) => ({ ...p, account_type: e.target.value }))}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="add_owner">Owner</label>
                <select
                  id="add_owner"
                  value={addForm.owner_type}
                  onChange={(e) => setAddForm((p) => ({ ...p, owner_type: e.target.value }))}
                >
                  {OWNER_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {isTraditionalRetirement(addForm.account_type) && (
                <div className="form-group">
                  <label htmlFor="add_rmd_owner">RMD owner</label>
                  <select
                    id="add_rmd_owner"
                    value={addForm.rmd_owner_type}
                    onChange={(e) => setAddForm((p) => ({ ...p, rmd_owner_type: e.target.value }))}
                    title="Which person’s RMD rules apply to this balance (joint = split 50/50). Same as owner uses the Owner field."
                  >
                    {RMD_OWNER_OPTIONS.map((o) => (
                      <option key={o.value || 'inherit'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {addForm.account_type === 'asset' && (
                <div className="form-group">
                  <label htmlFor="add_depreciation">Expected annual change (% / year)</label>
                  <input
                    id="add_depreciation"
                    type="number"
                    min={-100}
                    max={100}
                    step={0.1}
                    value={addForm.expected_depreciation_pct}
                    onChange={(e) => setAddForm((p) => ({ ...p, expected_depreciation_pct: e.target.value }))}
                    placeholder="e.g. 10 or -3"
                    title="Positive = depreciation, negative = appreciation. Used in projections each year."
                  />
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Positive depreciates; negative appreciates (e.g. −3 = 3% growth).
                  </span>
                </div>
              )}
              {addForm.account_type === 'asset' && (
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!addForm.liquidate_in_retirement}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, liquidate_in_retirement: e.target.checked }))
                      }
                    />
                    Liquidate in retirement
                  </label>
                  <span className="muted" style={{ fontSize: '0.85rem', display: 'block' }}>
                    When checked, this asset can be sold in retirement to cover living expense shortfalls after savings withdrawals.
                  </span>
                </div>
              )}
              <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>
          </form>
        )}

        {accounts.length === 0 && !showAdd ? (
          <p className="muted">No accounts yet. Click “Add account” to create one.</p>
        ) : (
          <ul className="accounts-list">
            {accounts.map((acc) => (
              <li key={acc.id} className="accounts-list-item">
                {editingId === acc.id ? (
                  <form onSubmit={handleEditSubmit} className="accounts-form-inline">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      className="input-cell"
                    />
                    <select
                      value={editForm.account_type}
                      onChange={(e) => setEditForm((p) => ({ ...p, account_type: e.target.value }))}
                    >
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <select
                      value={editForm.owner_type}
                      onChange={(e) => setEditForm((p) => ({ ...p, owner_type: e.target.value }))}
                    >
                      {OWNER_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {isTraditionalRetirement(editForm.account_type) && (
                      <select
                        value={editForm.rmd_owner_type}
                        onChange={(e) => setEditForm((p) => ({ ...p, rmd_owner_type: e.target.value }))}
                        title="RMD owner"
                        className="input-cell"
                        style={{ maxWidth: '11rem' }}
                      >
                        {RMD_OWNER_OPTIONS.map((o) => (
                          <option key={o.value || 'inherit'} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                    {editForm.account_type === 'asset' && (
                      <input
                        type="number"
                        min={-100}
                        max={100}
                        step={0.1}
                        value={editForm.expected_depreciation_pct}
                        onChange={(e) => setEditForm((p) => ({ ...p, expected_depreciation_pct: e.target.value }))}
                        placeholder="% / yr"
                        className="input-cell"
                        title="Positive = depreciation, negative = appreciation"
                        style={{ maxWidth: '6rem' }}
                      />
                    )}
                    {editForm.account_type === 'asset' && (
                      <label className="checkbox-label" title="Liquidate in retirement">
                        <input
                          type="checkbox"
                          checked={!!editForm.liquidate_in_retirement}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, liquidate_in_retirement: e.target.checked }))
                          }
                        />
                        Liquidate in retirement
                      </label>
                    )}
                    {editForm.account_type === 'taxable' && (
                      <span className="tax-profile-inline" title="Tax profile for projections">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={taxProfileForm.unrealized_gain_percent}
                          onChange={(e) =>
                            setTaxProfileForm((p) => ({ ...p, unrealized_gain_percent: e.target.value }))
                          }
                          placeholder="Gain %"
                          className="input-cell"
                          style={{ maxWidth: '5rem' }}
                        />
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={0.1}
                          value={taxProfileForm.dividend_yield}
                          onChange={(e) =>
                            setTaxProfileForm((p) => ({ ...p, dividend_yield: e.target.value }))
                          }
                          placeholder="Div %"
                          className="input-cell"
                          style={{ maxWidth: '5rem' }}
                        />
                      </span>
                    )}
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="account-name">{acc.name}</span>
                    <span className="account-meta">
                      {typeLabel(acc.account_type)} · {ownerLabel(acc.owner_type)}
                      {isTraditionalRetirement(acc.account_type) && (
                        <>
                          {' · '}
                          {acc.rmd_owner_type != null && acc.rmd_owner_type !== ''
                            ? `RMD: ${acc.rmd_owner_type === 'joint' ? 'joint 50/50' : ownerLabel(acc.rmd_owner_type)}`
                            : `RMD: same as owner (${ownerLabel(acc.owner_type)})`}
                        </>
                      )}
                      {acc.account_type === 'asset' && (
                        <>
                          {' · '}
                          {formatAssetAnnualChange(acc.expected_depreciation_pct)}
                          {acc.liquidate_in_retirement ? ' · liquidate in retirement' : ''}
                        </>
                      )}
                    </span>
                    {balancesByAccount[parsePositiveIntId(acc.id)] != null && (
                      <span className="account-balance">
                        ${Number(balancesByAccount[parsePositiveIntId(acc.id)].balance).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} as of {String(balancesByAccount[parsePositiveIntId(acc.id)].as_of).slice(0, 10)}
                      </span>
                    )}
                    <div className="account-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openBalanceForm(acc)}
                      >
                        {sameAccountId(balanceFormAccountId, acc.id) && balanceFormBalanceId == null
                          ? 'Cancel balance'
                          : balancesByAccount[parsePositiveIntId(acc.id)] != null
                            ? 'Update balance'
                            : 'Add balance'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleHistory(acc.id)}
                      >
                        {sameAccountId(expandedHistoryAccountId, acc.id) ? 'Hide history' : 'View history'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEdit(acc)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDelete(acc.id)}
                        disabled={deletingId === acc.id}
                      >
                        {deletingId === acc.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </>
                )}
                {sameAccountId(balanceFormAccountId, acc.id) && (
                  <div className="balance-form-section">
                    <h4 className="balance-form-title">
                      {balanceFormBalanceId != null ? 'Edit balance' : 'Record balance'} — {acc.name}
                    </h4>
                    <p className="balance-form-subtitle muted">
                      {typeLabel(acc.account_type)} · {ownerLabel(acc.owner_type)}
                    </p>
                    <form onSubmit={(e) => handleBalanceSubmit(e, acc.id)} className="balance-form-inline">
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor={`balance-as-of-${acc.id}`}>As of</label>
                          <input
                            id={`balance-as-of-${acc.id}`}
                            type="date"
                            value={balanceForm.as_of}
                            onChange={(e) => setBalanceForm((p) => ({ ...p, as_of: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor={`balance-amount-${acc.id}`}>Balance ($)</label>
                          <input
                            id={`balance-amount-${acc.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={balanceForm.balance}
                            onChange={(e) => setBalanceForm((p) => ({ ...p, balance: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                        <div className="form-group balance-form-actions">
                          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={closeBalanceForm}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                )}
                {sameAccountId(expandedHistoryAccountId, acc.id) && (
                  <div className="balance-history-section">
                    <h4 className="balance-history-title">Balance history</h4>
                    {historyLoading ? (
                      <p className="muted">Loading…</p>
                    ) : (
                      <>
                        <ul className="balance-history-list">
                          {(balanceHistory[parsePositiveIntId(acc.id)] || []).map((row) => (
                            <li key={row.balance_id ?? row.id} className="balance-history-item">
                              <span className="balance-history-date">{String(row.as_of).slice(0, 10)}</span>
                              <span className="balance-history-amount">
                                ${Number(row.balance).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </span>
                              <span className="balance-history-actions">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => openBalanceForm(acc, row)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleBalanceDelete(row, parsePositiveIntId(acc.id))}
                                >
                                  Delete
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                        {(balanceHistory[parsePositiveIntId(acc.id)] || []).length === 0 && (
                          <p className="muted">No balance snapshots yet. Use &quot;Add balance&quot; or &quot;Update balance&quot; to record one.</p>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openBalanceForm(acc)}
                        >
                          Add snapshot
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
