import { vi, beforeEach, describe, it, expect } from 'vitest';
import {
  getStores,
  getStore,
  createStore,
  updateStore,
  deleteStore,
  getStoreZones,
  createStoreZone,
  deleteStoreZone,
  swapStoreZones,
  getDepartments,
  createDepartment,
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  getShoppingList,
  getAllShoppingList,
  addToShoppingList,
  updateShoppingListItem,
  markPurchased,
  removeFromShoppingList,
} from './api';

const { mockInstance } = vi.hoisted(() => {
  const noop = () => {};
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  return {
    mockInstance: {
      get,
      post,
      put,
      patch,
      delete: del,
      request: vi.fn(),
      interceptors: { request: { use: noop }, response: { use: noop } },
    },
  };
});

vi.mock('axios', () => ({
  default: { create: () => mockInstance },
}));

describe('api', () => {
  beforeEach(() => {
    mockInstance.get.mockResolvedValue({ data: [] });
    mockInstance.post.mockResolvedValue({ data: {} });
    mockInstance.put.mockResolvedValue({ data: {} });
    mockInstance.patch.mockResolvedValue({ data: {} });
    mockInstance.delete.mockResolvedValue({ data: {} });
  });

  it('getStores calls GET /stores', async () => {
    await getStores();
    expect(mockInstance.get).toHaveBeenCalledWith('/stores');
  });

  it('getStore calls GET /stores/:id', async () => {
    await getStore(1);
    expect(mockInstance.get).toHaveBeenCalledWith('/stores/1');
  });

  it('createStore calls POST /stores', async () => {
    await createStore({ name: 'Store A' });
    expect(mockInstance.post).toHaveBeenCalledWith('/stores', { name: 'Store A' });
  });

  it('updateStore calls PUT /stores/:id', async () => {
    await updateStore(1, { name: 'Store B' });
    expect(mockInstance.put).toHaveBeenCalledWith('/stores/1', { name: 'Store B' });
  });

  it('deleteStore calls DELETE /stores/:id', async () => {
    await deleteStore(1);
    expect(mockInstance.delete).toHaveBeenCalledWith('/stores/1');
  });

  it('getStoreZones calls GET /stores/:storeId/zones', async () => {
    await getStoreZones(1);
    expect(mockInstance.get).toHaveBeenCalledWith('/stores/1/zones');
  });

  it('createStoreZone calls POST /stores/:storeId/zones', async () => {
    await createStoreZone(1, { zonesequence: 1, zonename: 'Aisle', departmentid: 1 });
    expect(mockInstance.post).toHaveBeenCalledWith('/stores/1/zones', { zonesequence: 1, zonename: 'Aisle', departmentid: 1 });
  });

  it('deleteStoreZone calls DELETE with zone path', async () => {
    await deleteStoreZone(1, 2, 3);
    expect(mockInstance.delete).toHaveBeenCalledWith('/stores/1/zones/2/3');
  });

  it('swapStoreZones calls POST with seqA and seqB', async () => {
    await swapStoreZones(1, 1, 2);
    expect(mockInstance.post).toHaveBeenCalledWith('/stores/1/zones/swap', { seqA: 1, seqB: 2 });
  });

  it('getDepartments calls GET /departments', async () => {
    await getDepartments();
    expect(mockInstance.get).toHaveBeenCalledWith('/departments');
  });

  it('createDepartment calls POST /departments', async () => {
    await createDepartment({ name: 'Produce' });
    expect(mockInstance.post).toHaveBeenCalledWith('/departments', { name: 'Produce' });
  });

  it('getItems calls GET /items', async () => {
    await getItems();
    expect(mockInstance.get).toHaveBeenCalledWith('/items');
  });

  it('getItem calls GET /items/:id', async () => {
    await getItem(1);
    expect(mockInstance.get).toHaveBeenCalledWith('/items/1');
  });

  it('createItem calls POST /items', async () => {
    await createItem({ name: 'Milk', department: 1 });
    expect(mockInstance.post).toHaveBeenCalledWith('/items', { name: 'Milk', department: 1 });
  });

  it('updateItem calls PUT /items/:id', async () => {
    await updateItem(1, { name: 'Bread' });
    expect(mockInstance.put).toHaveBeenCalledWith('/items/1', { name: 'Bread' });
  });

  it('deleteItem calls DELETE /items/:id', async () => {
    await deleteItem(1);
    expect(mockInstance.delete).toHaveBeenCalledWith('/items/1');
  });

  it('getShoppingList calls GET with storeId and optional showPurchased', async () => {
    await getShoppingList(-1);
    expect(mockInstance.get).toHaveBeenCalledWith('/shopping-list/-1', { params: { showPurchased: false } });
    mockInstance.get.mockClear();
    await getShoppingList(1, true);
    expect(mockInstance.get).toHaveBeenCalledWith('/shopping-list/1', { params: { showPurchased: true } });
  });

  it('getAllShoppingList calls GET /shopping-list', async () => {
    await getAllShoppingList();
    expect(mockInstance.get).toHaveBeenCalledWith('/shopping-list');
  });

  it('addToShoppingList calls POST /shopping-list', async () => {
    await addToShoppingList({ name: 'Milk', quantity: '1' });
    expect(mockInstance.post).toHaveBeenCalledWith('/shopping-list', { name: 'Milk', quantity: '1' });
  });

  it('updateShoppingListItem encodes name and calls PUT', async () => {
    await updateShoppingListItem('Milk 2%', { quantity: '2' });
    expect(mockInstance.put).toHaveBeenCalledWith('/shopping-list/Milk%202%25', { quantity: '2' });
  });

  it('markPurchased calls PATCH with encoded name', async () => {
    await markPurchased('Milk', true);
    expect(mockInstance.patch).toHaveBeenCalledWith('/shopping-list/Milk/purchased', { purchased: true });
  });

  it('removeFromShoppingList calls DELETE with encoded name', async () => {
    await removeFromShoppingList('Milk');
    expect(mockInstance.delete).toHaveBeenCalledWith('/shopping-list/Milk');
  });
});
