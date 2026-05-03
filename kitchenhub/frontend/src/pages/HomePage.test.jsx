import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('renders welcome heading and subtitle', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /welcome to kitchenhub/i })).toBeInTheDocument();
    expect(screen.getByText(/manage your pantry|shopping lists|store layouts/i)).toBeInTheDocument();
  });

  it('renders quick link cards including meal planner before stores', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /^Shopping List/i })).toHaveAttribute('href', '/shopping');
    expect(screen.getByRole('link', { name: /^Items/i })).toHaveAttribute('href', '/list');
    expect(screen.getByRole('link', { name: /^Meal planner/i })).toHaveAttribute('href', '/recipes/upcoming');
    expect(screen.getByRole('link', { name: /stores & layouts/i })).toHaveAttribute('href', '/stores');
  });

  it('renders how it fits together and next steps', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /how it all fits together/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /next steps/i })).toBeInTheDocument();
  });
});
