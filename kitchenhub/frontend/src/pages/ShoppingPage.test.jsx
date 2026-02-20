import React from 'react';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as api from '../api/api';
import ShoppingPage from './ShoppingPage';

vi.mock('../api/api');

describe('ShoppingPage', () => {
  beforeEach(() => {
    vi.mocked(api.getStores).mockResolvedValue({
      data: [
        { id: -1, name: 'All' },
        { id: 1, name: 'Store A' },
      ],
    });
    vi.mocked(api.getShoppingList).mockResolvedValue({ data: [] });
  });

  it('renders and loads store selector and shopping list', async () => {
    render(
      <MemoryRouter>
        <ShoppingPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(api.getStores).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(api.getShoppingList).toHaveBeenCalled();
    });
    expect(screen.getByLabelText(/store/i)).toBeInTheDocument();
  });

  it('shows shopping list when store is selected', async () => {
    vi.mocked(api.getShoppingList).mockResolvedValue({
      data: [
        { name: 'Milk', quantity: '1', zone: 'Dairy', purchased: 0 },
      ],
    });
    render(
      <MemoryRouter>
        <ShoppingPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(api.getShoppingList).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument();
    });
  });
});
