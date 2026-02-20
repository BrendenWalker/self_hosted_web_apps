import React from 'react';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as api from '../api/api';
import ShoppingListPage from './ShoppingListPage';

vi.mock('../api/api');

describe('ShoppingListPage', () => {
  beforeEach(() => {
    vi.mocked(api.getAllShoppingList).mockResolvedValue({ data: [] });
    vi.mocked(api.getItems).mockResolvedValue({ data: [] });
    vi.mocked(api.getDepartments).mockResolvedValue({ data: [] });
  });

  it('loads data and renders tabs', async () => {
    render(
      <MemoryRouter>
        <ShoppingListPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(api.getAllShoppingList).toHaveBeenCalled();
      expect(api.getItems).toHaveBeenCalled();
      expect(api.getDepartments).toHaveBeenCalled();
    });
    expect(screen.getByRole('button', { name: /all items/i })).toBeInTheDocument();
  });

  it('shows shopping list items when loaded', async () => {
    vi.mocked(api.getAllShoppingList).mockResolvedValue({
      data: [{ name: 'Milk', quantity: '1', department_name: 'Dairy' }],
    });
    vi.mocked(api.getItems).mockResolvedValue({ data: [{ id: 1, name: 'Milk', department: 1 }] });
    vi.mocked(api.getDepartments).mockResolvedValue({ data: [{ id: 1, name: 'Dairy' }] });
    render(
      <MemoryRouter>
        <ShoppingListPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument();
    });
  });
});
