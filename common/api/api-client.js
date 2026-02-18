/**
 * Shared API client configuration for frontend applications
 * Provides a reusable axios instance with standard configuration
 */

import axios from 'axios';

/**
 * Creates an axios instance with standard configuration
 * @param {string} baseURL - Base URL for the API (defaults to /api)
 * @returns {axios.AxiosInstance} Configured axios instance
 */
export function createApiClient(baseURL = '/api') {
  const apiBaseURL = import.meta.env.VITE_API_URL || baseURL;
  
  return axios.create({
    baseURL: apiBaseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export default createApiClient;
