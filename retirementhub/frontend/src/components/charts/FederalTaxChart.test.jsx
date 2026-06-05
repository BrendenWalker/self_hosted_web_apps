import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import FederalTaxChart from './FederalTaxChart';

describe('FederalTaxChart', () => {
  test('renders svg for bracket breakdown', () => {
    const years = [
      {
        year: 2026,
        federal_tax_brackets: [
          { rate_pct: 10, income_in_band: 10000, tax: 1000 },
          { rate_pct: 12, income_in_band: 20000, tax: 2400 },
        ],
      },
    ];
    render(<FederalTaxChart years={years} />);
    expect(screen.getByText(/Federal tax by bracket/i)).toBeInTheDocument();
  });
});
