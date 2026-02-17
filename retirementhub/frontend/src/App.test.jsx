import React from 'react';
import { vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: 'RetirementHub' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Household' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Income' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Accounts' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Savings limits' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Projections' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Expenses' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Import' })).toBeInTheDocument();
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
