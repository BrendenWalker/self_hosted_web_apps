import React from 'react';
import { vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { screen } from '@testing-library/react';
import App from './App';

// Mock api so App and its pages don't call real endpoints
vi.mock('./api/api', () => ({
  getStores: () => Promise.resolve({ data: [] }),
  getStore: () => Promise.resolve({ data: {} }),
  getShoppingList: () => Promise.resolve({ data: [] }),
  getAllShoppingList: () => Promise.resolve({ data: [] }),
  getItems: () => Promise.resolve({ data: [] }),
  getDepartments: () => Promise.resolve({ data: [] }),
  getStoreZones: () => Promise.resolve({ data: [] }),
  createStore: () => Promise.resolve({ data: {} }),
  updateStore: () => Promise.resolve({ data: {} }),
  deleteStore: () => Promise.resolve({ data: {} }),
  createStoreZone: () => Promise.resolve({ data: {} }),
  deleteStoreZone: () => Promise.resolve({ data: {} }),
  swapStoreZones: () => Promise.resolve({ data: {} }),
  createDepartment: () => Promise.resolve({ data: {} }),
  getItem: () => Promise.resolve({ data: {} }),
  createItem: () => Promise.resolve({ data: {} }),
  updateItem: () => Promise.resolve({ data: {} }),
  deleteItem: () => Promise.resolve({ data: {} }),
  addToShoppingList: () => Promise.resolve({ data: {} }),
  updateShoppingListItem: () => Promise.resolve({ data: {} }),
  markPurchased: () => Promise.resolve({ data: {} }),
  removeFromShoppingList: () => Promise.resolve({ data: {} }),
  default: {},
}));

describe('main entry', () => {
  it('renders App inside BrowserRouter without crashing', async () => {
    const div = document.createElement('div');
    div.id = 'root';
    document.body.appendChild(div);
    const root = createRoot(div);
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    );
    // Wait for app to render (VersionFooter fetches, routes render)
    expect(await screen.findByText('KitchenHub')).toBeInTheDocument();
    expect(document.querySelector('.app')).toBeInTheDocument();
    root.unmount();
    document.body.removeChild(div);
  });
});
