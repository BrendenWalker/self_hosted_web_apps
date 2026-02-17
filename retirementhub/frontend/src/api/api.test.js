import { vi, beforeEach, describe, it, expect } from 'vitest';
import {
  getHousehold,
  updateHousehold,
  getIncome,
  getAccounts,
  getAccountBalances,
  getProjections,
  getSavingsLimits,
  getExpenseCategories,
  getExpenseLines,
} from './api';

const { mockInstance } = vi.hoisted(() => {
  const noop = () => {};
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  return {
    mockInstance: {
      get,
      post,
      put,
      patch,
      delete: del,
      request: vi.fn(),
      interceptors: { request: { use: noop }, response: { use: noop } },
    },
  };
});

vi.mock('axios', () => ({
  default: { create: () => mockInstance },
}));

describe('api', () => {
  beforeEach(() => {
    mockInstance.get.mockResolvedValue({ data: {} });
    mockInstance.post.mockResolvedValue({ data: {} });
    mockInstance.put.mockResolvedValue({ data: {} });
    mockInstance.patch.mockResolvedValue({ data: {} });
    mockInstance.delete.mockResolvedValue({ data: {} });
  });

  it('getHousehold calls GET /household', async () => {
    await getHousehold();
    expect(mockInstance.get).toHaveBeenCalledWith('/household');
  });

  it('updateHousehold calls PUT /household', async () => {
    await updateHousehold({ p1_display_name: 'Alice' });
    expect(mockInstance.put).toHaveBeenCalledWith('/household', { p1_display_name: 'Alice' });
  });

  it('getIncome calls GET /income', async () => {
    await getIncome();
    expect(mockInstance.get).toHaveBeenCalledWith('/income');
  });

  it('getAccounts calls GET /accounts', async () => {
    await getAccounts();
    expect(mockInstance.get).toHaveBeenCalledWith('/accounts');
  });

  it('getAccountBalances calls GET /account-balances', async () => {
    await getAccountBalances();
    expect(mockInstance.get).toHaveBeenCalledWith('/account-balances');
  });

  it('getProjections calls GET /projections with params', async () => {
    await getProjections(30, 5, 2.5);
    expect(mockInstance.get).toHaveBeenCalledWith('/projections', {
      params: { years: 30, growth_pct: 5, expense_cola_pct: 2.5 },
    });
  });

  it('getSavingsLimits calls GET /savings-limits with year', async () => {
    await getSavingsLimits(2025);
    expect(mockInstance.get).toHaveBeenCalledWith('/savings-limits', { params: { year: 2025 } });
  });

  it('getSavingsLimits without year calls GET /savings-limits', async () => {
    await getSavingsLimits();
    expect(mockInstance.get).toHaveBeenCalledWith('/savings-limits');
  });

  it('getExpenseCategories calls GET /expense-categories', async () => {
    await getExpenseCategories();
    expect(mockInstance.get).toHaveBeenCalledWith('/expense-categories');
  });

  it('getExpenseLines calls GET /expense-lines', async () => {
    await getExpenseLines();
    expect(mockInstance.get).toHaveBeenCalledWith('/expense-lines');
  });
});
