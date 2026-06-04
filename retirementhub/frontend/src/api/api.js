import axios from 'axios';
import { parsePositiveIntId } from '../utils/parseIds';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Let the browser set Content-Type (with boundary) for FormData; default json breaks multipart
api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

export const getHousehold = () => api.get('/household');
export const updateHousehold = (data) => api.put('/household', data);

export const getIncome = () => api.get('/income');
export const updateIncome = (data) => api.put('/income', data);

export const getExpenseCategories = () => api.get('/expense-categories');
export const getExpenseLines = () => api.get('/expense-lines');
export const createExpenseLine = (data) => api.post('/expense-lines', data);
export const updateExpenseLine = (id, data) => api.put(`/expense-lines/${id}`, data);
export const patchExpenseCategory = (id, data) => api.patch(`/expense-categories/${id}`, data);

export const getMortgage = () => api.get('/mortgage');
export const updateMortgage = (data) => api.put('/mortgage', data);

export const getAccounts = () => api.get('/accounts');
export const getAccount = (id) => {
  const accountId = parsePositiveIntId(id);
  if (!accountId) return Promise.reject(new Error('Invalid account id'));
  return api.get(`/accounts/${accountId}`);
};
export const createAccount = (data) => api.post('/accounts', data);
export const updateAccount = (id, data) => {
  const accountId = parsePositiveIntId(id);
  if (!accountId) return Promise.reject(new Error('Invalid account id'));
  return api.put(`/accounts/${accountId}`, data);
};
export const deleteAccount = (id) => {
  const accountId = parsePositiveIntId(id);
  if (!accountId) return Promise.reject(new Error('Invalid account id'));
  return api.delete(`/accounts/${accountId}`);
};

export const getAccountBalances = () => api.get('/account-balances');
export const getAccountBalancesHistory = (accountId) => {
  const aid = parsePositiveIntId(accountId);
  if (!aid) return Promise.reject(new Error('Invalid account id'));
  return api.get(`/accounts/${aid}/balances`);
};
export const upsertAccountBalance = (data) => {
  const accountId = parsePositiveIntId(data?.account_id);
  if (!accountId) {
    return Promise.reject(
      new Error('account_id must be a whole number (not the balance dollar amount)')
    );
  }
  return api.post('/account-balances', {
    account_id: accountId,
    as_of: data?.as_of,
    balance: data?.balance,
  });
};
/** @deprecated Use upsertAccountBalance — always POST upsert by account + date. */
export const updateAccountBalance = (_id, data) =>
  upsertAccountBalance({
    account_id: data?.account_id,
    as_of: data?.as_of,
    balance: data?.balance,
  });
export const deleteAccountBalance = (id) => {
  const balanceRowId = parsePositiveIntId(id);
  if (!balanceRowId) return Promise.reject(new Error('Invalid balance record id'));
  return api.delete(`/account-balances/${balanceRowId}`);
};

export const getBudgetSummary = () => api.get('/budget-summary');

export const getRetirementTaxGuide = (params) => api.get('/retirement-tax-guide', { params: params || {} });

/** Optional query params: scenario_id, years, growth_pct, expense_growth_pct, ssi_growth_pct */
export const getProjections = (params) =>
  params != null && typeof params === 'object' && Object.keys(params).length > 0
    ? api.get('/projections', { params })
    : api.get('/projections');

export const getScenarios = () => api.get('/scenarios');
export const createScenario = (data) => api.post('/scenarios', data);
export const updateScenario = (id, data) => api.put(`/scenarios/${id}`, data);
export const updateScenarioAssumptions = (id, data) => api.put(`/scenarios/${id}/assumptions`, data);
export const deleteScenario = (id) => api.delete(`/scenarios/${id}`);
export const compareScenarios = (ids) => api.get('/scenarios/compare', { params: { ids: ids.join(',') } });

export const getAccountTaxProfile = (accountId) => {
  const aid = parsePositiveIntId(accountId);
  if (!aid) return Promise.reject(new Error('Invalid account id'));
  return api.get(`/accounts/${aid}/tax-profile`);
};
export const updateAccountTaxProfile = (accountId, data) => {
  const aid = parsePositiveIntId(accountId);
  if (!aid) return Promise.reject(new Error('Invalid account id'));
  return api.put(`/accounts/${aid}/tax-profile`, data);
};

export const getSavingsLimits = (year) =>
  year != null ? api.get('/savings-limits', { params: { year } }) : api.get('/savings-limits');

export const taxParameters = {
  listYears: () => api.get('/tax-parameters/years').then((r) => r.data),
  createYear: (body) => api.post('/tax-parameters/years', body).then((r) => r.data),
  getYear: (year) => api.get('/tax-parameters', { params: { year } }).then((r) => r.data),
  updateStandardDeduction: (year, fs, body) =>
    api.put(`/tax-parameters/standard-deduction/${year}/${fs}`, body).then((r) => r.data),
  updateBracket: (year, fs, ordinal, body) =>
    api.put(`/tax-parameters/bracket/${year}/${fs}/${ordinal}`, body).then((r) => r.data),
  updateContributionLimit: (year, kind, body) =>
    api.put(`/tax-parameters/contribution-limit/${year}/${kind}`, body).then((r) => r.data),
  updateMedicarePartB: (year, body) =>
    api.put(`/tax-parameters/medicare-part-b/${year}`, body).then((r) => r.data),
  resetYear: (year) =>
    api
      .post(`/tax-parameters/${year}/reset?confirm=true`, { confirm: true })
      .then((r) => r.data),
};

export const importExpensesCsv = (formData) => api.post('/import/expenses', formData);
export const importAccountBalancesCsv = (formData) => api.post('/import/account-balances', formData);

export const getHealth = () => api.get('/health');

export default api;
