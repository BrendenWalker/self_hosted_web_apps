import React from 'react';
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

const mockResolve = (data = []) => Promise.resolve({ data });
vi.mock('./api/api', () => ({
  getStores: () => mockResolve([]),
  getStore: () => mockResolve({}),
  getShoppingList: () => mockResolve([]),
  getAllShoppingList: () => mockResolve([]),
  getItems: () => mockResolve([]),
  getDepartments: () => mockResolve([]),
  getStoreZones: () => mockResolve([]),
  createStore: () => mockResolve({}),
  updateStore: () => mockResolve({}),
  deleteStore: () => mockResolve({}),
  createStoreZone: () => mockResolve({}),
  deleteStoreZone: () => mockResolve({}),
  swapStoreZones: () => mockResolve({}),
  createDepartment: () => mockResolve({}),
  getItem: () => mockResolve({}),
  createItem: () => mockResolve({}),
  updateItem: () => mockResolve({}),
  deleteItem: () => mockResolve({}),
  addToShoppingList: () => mockResolve({}),
  updateShoppingListItem: () => mockResolve({}),
  markPurchased: () => mockResolve({}),
  removeFromShoppingList: () => mockResolve({}),
  default: {},
}));

describe('App', () => {
  it('renders navbar with logo and links', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('KitchenHub')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('In-Store')).toBeInTheDocument();
    expect(screen.getByText('Shopping List')).toBeInTheDocument();
    expect(screen.getByText('Stores')).toBeInTheDocument();
  });

  it('renders HomePage at /', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /welcome to kitchenhub/i })).toBeInTheDocument();
  });

  it('renders ShoppingPage at /shopping', async () => {
    render(
      <MemoryRouter initialEntries={['/shopping']}>
        <App />
      </MemoryRouter>
    );
    // Page has a single h1 "Shopping List" and the store selector label
    expect(await screen.findByRole('heading', { name: 'Shopping List' })).toBeInTheDocument();
    expect(screen.getByLabelText('Store:')).toBeInTheDocument();
  });

  it('renders ShoppingListPage at /list', async () => {
    render(
      <MemoryRouter initialEntries={['/list']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('button', { name: /all items/i })).toBeInTheDocument();
  });

  it('renders StorePage at /stores', async () => {
    render(
      <MemoryRouter initialEntries={['/stores']}>
        <App />
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /store management/i });
  });

  it('renders HomePage for unknown path', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /welcome to kitchenhub/i })).toBeInTheDocument();
  });
});
