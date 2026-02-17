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

  it('renders quick link cards to shopping, list, and stores', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /in-store shopping/i })).toHaveAttribute('href', '/shopping');
    expect(screen.getByRole('link', { name: /shopping list & items/i })).toHaveAttribute('href', '/list');
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
