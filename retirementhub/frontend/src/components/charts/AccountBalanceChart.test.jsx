import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import AccountBalanceChart from './AccountBalanceChart';
import { chartClickToYear } from '../../utils/chartClick';

const years = [
  {
    year: 2026,
    balances_by_bucket: { pre_tax: 100, roth: 50, taxable: 25, cash: 10, hsa: 5 },
  },
  {
    year: 2027,
    balances_by_bucket: { pre_tax: 105, roth: 55, taxable: 25, cash: 10, hsa: 6 },
  },
];

describe('AccountBalanceChart', () => {
  test('renders without crashing for two-year input', () => {
    render(<AccountBalanceChart years={years} />);
    expect(screen.getByText(/Account balances by bucket/i)).toBeInTheDocument();
  });

  test('chartClickToYear passes year to onYearClick handler', () => {
    const onYearClick = vi.fn();
    const y = chartClickToYear({ activeLabel: 2026 });
    if (y != null) onYearClick(y);
    expect(onYearClick).toHaveBeenCalledWith(2026);
  });
});
