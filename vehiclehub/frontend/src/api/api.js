import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Vehicles
export const getVehicles = () => api.get('/vehicles');
export const getVehicle = (id) => api.get(`/vehicles/${id}`);
export const createVehicle = (data) => api.post('/vehicles', data);
export const updateVehicle = (id, data) => api.put(`/vehicles/${id}`, data);
export const deleteVehicle = (id) => api.delete(`/vehicles/${id}`);

// Service Types
export const getServiceTypes = () => api.get('/service-types');
export const getServiceType = (id) => api.get(`/service-types/${id}`);
export const createServiceType = (data) => api.post('/service-types', data);
export const updateServiceType = (id, data) => api.put(`/service-types/${id}`, data);
export const deleteServiceType = (id) => api.delete(`/service-types/${id}`);

// Service Intervals
export const getServiceIntervals = (vehicleId) => api.get(`/vehicles/${vehicleId}/service-intervals`);
export const createServiceInterval = (vehicleId, data) => api.post(`/vehicles/${vehicleId}/service-intervals`, data);
export const updateServiceInterval = (vehicleId, serviceId, data) => 
  api.put(`/vehicles/${vehicleId}/service-intervals/${serviceId}`, data);
export const deleteServiceInterval = (vehicleId, serviceId) => 
  api.delete(`/vehicles/${vehicleId}/service-intervals/${serviceId}`);

// Service Log
export const getServiceLog = (vehicleId) => api.get(`/vehicles/${vehicleId}/service-log`);
export const getAllServiceLog = () => api.get('/service-log');
export const getServiceLogEntry = (id) => api.get(`/service-log/${id}`);
export const createServiceLogEntry = (data) => api.post('/service-log', data);
export const updateServiceLogEntry = (id, data) => api.put(`/service-log/${id}`, data);
export const deleteServiceLogEntry = (id) => api.delete(`/service-log/${id}`);

// Dashboard
export const getUpcomingServices = (days = 30) => api.get('/upcoming-services', { params: { days } });

export default api;
