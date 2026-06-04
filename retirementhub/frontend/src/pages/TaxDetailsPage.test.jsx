import React from 'react';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TaxDetailsPage from './TaxDetailsPage';

vi.mock('../api/api', () => ({
  taxParameters: {
    listYears: () =>
      Promise.resolve({
        years: [
          { year: 2025, status: 'published' },
          { year: 2026, status: 'published' },
        ],
      }),
    getYear: () =>
      Promise.resolve({
        year: 2026,
        standard_deduction: [
          {
            filing_status: 'married_filing_jointly',
            amount: '31000',
            age65_add_on: '1550',
            source: 'seeded',
          },
        ],
        brackets: [
          {
            filing_status: 'married_filing_jointly',
            ordinal: 0,
            lower_bound: '0',
            rate: '0.1',
            source: 'seeded',
          },
        ],
        contribution_limits: [
          { kind: 'ira', base_amount: '7500', catch_up_amount: '1100', source: 'seeded' },
        ],
        medicare_part_b: { monthly_premium: '193', source: 'seeded' },
      }),
    updateStandardDeduction: vi.fn(),
    updateBracket: vi.fn(),
    updateContributionLimit: vi.fn(),
    updateMedicarePartB: vi.fn(),
    resetYear: vi.fn(),
    createYear: vi.fn(),
  },
}));

describe('TaxDetailsPage', () => {
  test('renders year selector and four section cards', async () => {
    render(<TaxDetailsPage />);
    await waitFor(() => expect(screen.getByText(/Tax Details/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/Year/i)).toBeInTheDocument();
    expect(screen.getByText(/Standard Deduction/i)).toBeInTheDocument();
    expect(screen.getByText(/Tax Brackets/i)).toBeInTheDocument();
    expect(screen.getByText(/Contribution Limits/i)).toBeInTheDocument();
    expect(screen.getByText(/Medicare Part B/i)).toBeInTheDocument();
  });
});
