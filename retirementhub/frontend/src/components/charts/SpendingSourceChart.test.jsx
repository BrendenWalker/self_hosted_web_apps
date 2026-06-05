import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import SpendingSourceChart from './SpendingSourceChart';

describe('SpendingSourceChart', () => {
  test('renders svg when spending sources present', () => {
    const years = [
      {
        year: 2026,
        spending_sources: { social_security: 24000, traditional_ira: 5000 },
        income_wages: 0,
        rmd: 5000,
      },
    ];
    render(<SpendingSourceChart years={years} />);
    expect(screen.getByText(/Spending funded by source/i)).toBeInTheDocument();
  });
});
