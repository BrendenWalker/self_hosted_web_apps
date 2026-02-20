import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry once on transient failures (e.g. load balancer hit wrong server)
const RETRY_STATUSES = [404, 502, 503, 504];
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    if (!config || config.__retried) return Promise.reject(err);
    const status = err.response?.status;
    if (status && RETRY_STATUSES.includes(status)) {
      config.__retried = true;
      await new Promise((r) => setTimeout(r, 300));
      return api.request(config);
    }
    return Promise.reject(err);
  }
);

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
export const swapStoreZones = (storeId, seqA, seqB) =>
  api.post(`/stores/${storeId}/zones/swap`, { seqA, seqB });

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
export const updateShoppingListItem = (name, data) =>
  api.put(`/shopping-list/${encodeURIComponent(name)}`, data);
export const markPurchased = (name, purchased) =>
  api.patch(`/shopping-list/${encodeURIComponent(name)}/purchased`, { purchased });
export const removeFromShoppingList = (name) =>
  api.delete(`/shopping-list/${encodeURIComponent(name)}`);

export default api;
