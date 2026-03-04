import axios from 'axios';

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

export const getMortgage = () => api.get('/mortgage');
export const updateMortgage = (data) => api.put('/mortgage', data);

export const getAccounts = () => api.get('/accounts');
export const getAccount = (id) => api.get(`/accounts/${id}`);
export const createAccount = (data) => api.post('/accounts', data);
export const updateAccount = (id, data) => api.put(`/accounts/${id}`, data);
export const deleteAccount = (id) => api.delete(`/accounts/${id}`);

export const getAccountBalances = () => api.get('/account-balances');
export const getAccountBalancesHistory = (accountId) => api.get(`/accounts/${accountId}/balances`);
export const upsertAccountBalance = (data) => api.post('/account-balances', data);
export const updateAccountBalance = (id, data) => api.put(`/account-balances/${id}`, data);
export const deleteAccountBalance = (id) => api.delete(`/account-balances/${id}`);

export const getBudgetSummary = () => api.get('/budget-summary');

export const getSavingsLimits = (year) =>
  year != null ? api.get('/savings-limits', { params: { year } }) : api.get('/savings-limits');

export const importExpensesCsv = (formData) => api.post('/import/expenses', formData);
export const importAccountBalancesCsv = (formData) => api.post('/import/account-balances', formData);

export default api;
