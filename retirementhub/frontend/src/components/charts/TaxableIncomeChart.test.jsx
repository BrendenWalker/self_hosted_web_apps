import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import TaxableIncomeChart from './TaxableIncomeChart';

describe('TaxableIncomeChart', () => {
  test('renders svg for stacked income sources', () => {
    const years = [
      {
        year: 2026,
        income_wages: 80000,
        income_bonus: 5000,
        taxable_ss_estimate: 12000,
        rmd: 0,
      },
    ];
    render(<TaxableIncomeChart years={years} />);
    expect(screen.getByText(/Taxable income by source/i)).toBeInTheDocument();
  });
});
