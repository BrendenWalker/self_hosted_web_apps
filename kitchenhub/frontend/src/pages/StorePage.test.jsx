import React from 'react';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as api from '../api/api';
import StorePage from './StorePage';

vi.mock('../api/api');

describe('StorePage', () => {
  beforeEach(() => {
    vi.mocked(api.getStores).mockResolvedValue({
      data: [
        { id: -1, name: 'All' },
        { id: 1, name: 'Store A' },
      ],
    });
    vi.mocked(api.getStoreZones).mockResolvedValue({
      data: [
        { zonesequence: 1, zonename: 'Aisle 1', department_name: 'Produce' },
      ],
    });
    vi.mocked(api.getDepartments).mockResolvedValue({ data: [{ id: 1, name: 'Produce' }] });
  });

  it('loads stores and zones and renders', async () => {
    render(
      <MemoryRouter>
        <StorePage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(api.getStores).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(api.getStoreZones).toHaveBeenCalled();
    });
    expect(screen.getByRole('heading', { name: /store management/i })).toBeInTheDocument();
  });

  it('shows zone name when zones loaded', async () => {
    render(
      <MemoryRouter>
        <StorePage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(api.getStoreZones).toHaveBeenCalled();
    });
    // Zone name "Aisle 1" appears once; "Produce" appears in two lists so use unique text
    expect(await screen.findByText('Aisle 1')).toBeInTheDocument();
  });
});
