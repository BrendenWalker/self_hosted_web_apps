import React, { useState, useEffect } from 'react';
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountBalances,
  getAccountBalancesHistory,
  upsertAccountBalance,
  updateAccountBalance,
  deleteAccountBalance,
} from '../api/api';

const ACCOUNT_TYPES = [
  { value: 'savings', label: 'Savings' },
  { value: 'checking', label: 'Checking' },
  { value: 'hsa', label: 'HSA' },
  { value: 'ira_traditional', label: 'IRA (traditional)' },
  { value: 'ira_roth', label: 'IRA (Roth)' },
  { value: '401k_traditional', label: '401(k) (traditional)' },
  { value: '401k_roth', label: '401(k) (Roth)' },
  { value: 'taxable', label: 'Taxable (brokerage, etc.)' },
];

const OWNER_TYPES = [
  { value: 'p1', label: 'P1' },
  { value: 'p2', label: 'P2' },
  { value: 'joint', label: 'Joint' },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', account_type: 'taxable', owner_type: 'joint' });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', account_type: 'taxable', owner_type: 'joint' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [balanceFormAccountId, setBalanceFormAccountId] = useState(null);
  const [balanceFormBalanceId, setBalanceFormBalanceId] = useState(null);
  const [balanceForm, setBalanceForm] = useState({ as_of: '', balance: '' });
  const [balancesByAccount, setBalancesByAccount] = useState({});
  const [expandedHistoryAccountId, setExpandedHistoryAccountId] = useState(null);
  const [balanceHistory, setBalanceHistory] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);

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
        byAcc[b.account_id] = { id: b.id, balance: b.balance, as_of: b.as_of };
      });
      setBalancesByAccount(byAcc);
      setMessage(null);
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
      await createAccount({
        name,
        account_type: addForm.account_type,
        owner_type: addForm.owner_type,
      });
      setAddForm({ name: '', account_type: 'taxable', owner_type: 'joint' });
      setShowAdd(false);
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (acc) => {
    setEditingId(acc.id);
    setEditForm({
      name: acc.name,
      account_type: acc.account_type,
      owner_type: acc.owner_type,
    });
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
      await updateAccount(editingId, {
        name,
        account_type: editForm.account_type,
        owner_type: editForm.owner_type,
      });
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

  const openBalanceForm = (acc, balanceRow = null) => {
    const b = balanceRow ?? balancesByAccount[acc.id];
    const today = new Date().toISOString().slice(0, 10);
    setBalanceFormAccountId(acc.id);
    setBalanceFormBalanceId(balanceRow?.id ?? null);
    setBalanceForm({
      as_of: b?.as_of ? String(b.as_of).slice(0, 10) : today,
      balance: b != null && b.balance != null ? String(b.balance) : '',
    });
  };

  const toggleHistory = async (accountId) => {
    if (expandedHistoryAccountId === accountId) {
      setExpandedHistoryAccountId(null);
      return;
    }
    setExpandedHistoryAccountId(accountId);
    if (!balanceHistory[accountId]) {
      setHistoryLoading(true);
      try {
        const res = await getAccountBalancesHistory(accountId);
        setBalanceHistory((prev) => ({ ...prev, [accountId]: res.data || [] }));
      } catch (err) {
        setMessage(err.response?.data?.error || 'Failed to load balance history');
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const handleBalanceDelete = async (balanceId, accountId) => {
    setMessage(null);
    try {
      await deleteAccountBalance(balanceId);
      const res = await getAccountBalancesHistory(accountId);
      setBalanceHistory((prev) => ({ ...prev, [accountId]: res.data || [] }));
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to delete balance');
    }
  };

  const handleBalanceSubmit = async (e) => {
    e.preventDefault();
    if (!balanceFormAccountId) return;
    setMessage(null);
    setSaving(true);
    const accountId = balanceFormAccountId;
    const balanceId = balanceFormBalanceId;
    try {
      if (balanceId != null) {
        await updateAccountBalance(balanceId, {
          as_of: balanceForm.as_of || new Date().toISOString().slice(0, 10),
          balance: balanceForm.balance === '' ? 0 : parseFloat(balanceForm.balance),
        });
      } else {
        await upsertAccountBalance({
          account_id: accountId,
          as_of: balanceForm.as_of || new Date().toISOString().slice(0, 10),
          balance: balanceForm.balance === '' ? 0 : parseFloat(balanceForm.balance),
        });
      }
      setBalanceFormAccountId(null);
      setBalanceFormBalanceId(null);
      if (expandedHistoryAccountId === accountId) {
        const res = await getAccountBalancesHistory(accountId);
        setBalanceHistory((prev) => ({ ...prev, [accountId]: res.data || [] }));
      }
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save balance');
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
        Add any number of accounts: savings, checking, HSA, IRA (traditional or Roth), 401(k) (traditional or Roth), and taxable. Record balances with an “as of” date; the latest balance per account is used for projections and history is kept.
      </p>
      {message && <div className="error-message">{message}</div>}

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
                    <span className="account-meta">{typeLabel(acc.account_type)} · {ownerLabel(acc.owner_type)}</span>
                    {balancesByAccount[acc.id] != null && (
                      <span className="account-balance">
                        ${Number(balancesByAccount[acc.id].balance).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} as of {String(balancesByAccount[acc.id].as_of).slice(0, 10)}
                      </span>
                    )}
                    <div className="account-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openBalanceForm(acc)}
                      >
                        {balancesByAccount[acc.id] != null ? 'Update balance' : 'Add balance'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleHistory(acc.id)}
                      >
                        {expandedHistoryAccountId === acc.id ? 'Hide history' : 'View history'}
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
                {expandedHistoryAccountId === acc.id && (
                  <div className="balance-history-section">
                    <h4 className="balance-history-title">Balance history</h4>
                    {historyLoading ? (
                      <p className="muted">Loading…</p>
                    ) : (
                      <>
                        <ul className="balance-history-list">
                          {(balanceHistory[acc.id] || []).map((row) => (
                            <li key={row.id} className="balance-history-item">
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
                                  onClick={() => handleBalanceDelete(row.id, acc.id)}
                                >
                                  Delete
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                        {(balanceHistory[acc.id] || []).length === 0 && (
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

        {balanceFormAccountId != null && (
          <form onSubmit={handleBalanceSubmit} className="balance-form card">
            <h3>{balanceFormBalanceId != null ? 'Edit balance' : 'Balance (as of date)'}</h3>
            <div className="form-row">
              <div className="form-group">
                <label>As of</label>
                <input
                  type="date"
                  value={balanceForm.as_of}
                  onChange={(e) => setBalanceForm((p) => ({ ...p, as_of: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Balance $</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={balanceForm.balance}
                  onChange={(e) => setBalanceForm((p) => ({ ...p, balance: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>Save</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setBalanceFormAccountId(null);
                    setBalanceFormBalanceId(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
