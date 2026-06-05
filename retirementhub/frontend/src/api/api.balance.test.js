import { vi, beforeEach, describe, it, expect } from 'vitest';
import { upsertAccountBalance, updateAccountBalance, deleteAccountBalance } from './api';

const { mockInstance } = vi.hoisted(() => {
  const noop = () => {};
  const post = vi.fn();
  const put = vi.fn();
  const del = vi.fn();
  return {
    mockInstance: {
      get: vi.fn(),
      post,
      put,
      patch: vi.fn(),
      delete: del,
      request: vi.fn(),
      interceptors: { request: { use: noop }, response: { use: noop } },
    },
  };
});

vi.mock('axios', () => ({
  default: { create: () => mockInstance },
}));

describe('account balance api', () => {
  beforeEach(() => {
    mockInstance.post.mockClear();
    mockInstance.put.mockClear();
    mockInstance.delete.mockClear();
    mockInstance.post.mockResolvedValue({ data: {} });
    mockInstance.put.mockResolvedValue({ data: {} });
    mockInstance.delete.mockResolvedValue({ data: {} });
  });

  it('upsertAccountBalance POSTs with integer account_id', async () => {
    await upsertAccountBalance({ account_id: 3, as_of: '2025-01-01', balance: 3230.69 });
    expect(mockInstance.post).toHaveBeenCalledWith('/account-balances', {
      account_id: 3,
      as_of: '2025-01-01',
      balance: 3230.69,
    });
    expect(mockInstance.put).not.toHaveBeenCalled();
  });

  it('upsertAccountBalance rejects decimal account_id', async () => {
    await expect(upsertAccountBalance({ account_id: '3230.69', balance: 1 })).rejects.toThrow(
      /whole number/
    );
    expect(mockInstance.post).not.toHaveBeenCalled();
  });

  it('updateAccountBalance delegates to POST upsert (never PUT)', async () => {
    await updateAccountBalance(99, {
      account_id: 3,
      as_of: '2025-01-01',
      balance: 3230.69,
    });
    expect(mockInstance.post).toHaveBeenCalledWith('/account-balances', {
      account_id: 3,
      as_of: '2025-01-01',
      balance: 3230.69,
    });
    expect(mockInstance.put).not.toHaveBeenCalled();
  });

  it('deleteAccountBalance rejects decimal id', async () => {
    await expect(deleteAccountBalance('3230.69')).rejects.toThrow(/Invalid balance/);
    expect(mockInstance.delete).not.toHaveBeenCalled();
  });
});
