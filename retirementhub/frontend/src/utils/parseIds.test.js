import { describe, it, expect } from 'vitest';
import { parseBalanceRowId, parsePositiveIntId } from './parseIds';

describe('parseIds', () => {
  it('rejects decimal strings as ids', () => {
    expect(parsePositiveIntId('3230.69')).toBeNull();
  });

  it('does not use balance amount as balance row id', () => {
    expect(parseBalanceRowId({ id: '3230.69', balance: '3230.69' })).toBeNull();
    expect(parseBalanceRowId({ balance_id: 5, balance: '3230.69' })).toBe(5);
  });
});
