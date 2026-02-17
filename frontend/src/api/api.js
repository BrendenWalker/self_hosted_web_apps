import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Stores
export const getStores = () => api.get('/stores');
export const getStore = (id) => api.get(`/stores/${id}`);
export const createStore = (data) => api.post('/stores', data);
export const updateStore = (id, data) => api.put(`/stores/${id}`, data);
export const deleteStore = (id) => api.delete(`/stores/${id}`);

// Store Zones
export const getStoreZones = (storeId) => api.get(`/stores/${storeId}/zones`);
export const createStoreZone = (storeId, data) => api.post(`/stores/${storeId}/zones`, data);
export const deleteStoreZone = (storeId, zoneSequence, departmentId) => 
  api.delete(`/stores/${storeId}/zones/${zoneSequence}/${departmentId}`);

// Departments
export const getDepartments = () => api.get('/departments');
export const createDepartment = (data) => api.post('/departments', data);

// Items
export const getItems = () => api.get('/items');
export const getItem = (id) => api.get(`/items/${id}`);
export const createItem = (data) => api.post('/items', data);
export const updateItem = (id, data) => api.put(`/items/${id}`, data);
export const deleteItem = (id) => api.delete(`/items/${id}`);

// Shopping List
export const getShoppingList = (storeId, showPurchased = false) => 
  api.get(`/shopping-list/${storeId}`, { params: { showPurchased } });
export const getAllShoppingList = () => api.get('/shopping-list');
export const addToShoppingList = (data) => api.post('/shopping-list', data);
export const updateShoppingListItem = (name, data) => api.put(`/shopping-list/${name}`, data);
export const markPurchased = (name, purchased) => 
  api.patch(`/shopping-list/${name}/purchased`, { purchased });
export const removeFromShoppingList = (name) => api.delete(`/shopping-list/${name}`);

export default api;
