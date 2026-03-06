import React from 'react';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

const mockResolve = (data = []) => Promise.resolve({ data });
vi.mock('./api/api', () => ({
  getHousehold: () => mockResolve({}),
  updateHousehold: () => mockResolve({}),
  getIncome: () => mockResolve({}),
  updateIncome: () => mockResolve({}),
  getExpenseCategories: () => mockResolve([]),
  getExpenseLines: () => mockResolve([]),
  getMortgage: () => mockResolve({}),
  updateMortgage: () => mockResolve({}),
  getAccounts: () => mockResolve([]),
  getAccountBalances: () => mockResolve([]),
  getBudgetSummary: () => mockResolve({}),
  getProjections: () => mockResolve([]),
  getSavingsLimits: () => mockResolve([]),
  getRetirementTaxGuide: () => mockResolve({}),
  default: {},
}));

describe('App', () => {
  it('renders navbar with logo and links', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('RetirementHub')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Household')).toBeInTheDocument();
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('Savings limits')).toBeInTheDocument();
    expect(screen.getByText('Projections')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
  });

  it('renders HomePage at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /retirementhub/i })).toBeInTheDocument();
  });

  it('renders HouseholdPage at /household', async () => {
    render(
      <MemoryRouter initialEntries={['/household']}>
        <App />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /household/i });
  });

  it('renders HomePage for unknown path', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /retirementhub/i })).toBeInTheDocument();
  });
});
