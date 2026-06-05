import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import YearDetailDrawer from './YearDetailDrawer';

describe('YearDetailDrawer', () => {
  test('shows nothing when year is null', () => {
    const { container } = render(<YearDetailDrawer year={null} row={null} onClose={() => {}} />);
    expect(container.querySelector('.year-drawer')).toBeNull();
  });

  test('renders year and key sections when row provided', () => {
    const row = {
      year: 2030,
      taxable_income_after_standard_deduction: 80000,
      federal_tax_total: 9000,
      federal_tax_brackets: [{ rate_pct: 22, income_in_band: 50000, tax: 5000 }],
      income: 100000,
      expenses: 60000,
      balances_by_bucket: { pre_tax: 1000 },
    };
    render(<YearDetailDrawer year={2030} row={row} onClose={vi.fn()} />);
    expect(screen.getByText(/2030/)).toBeInTheDocument();
    expect(screen.getByText(/Taxable income \(after deduction\)/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Federal tax' })).toBeInTheDocument();
  });
});
