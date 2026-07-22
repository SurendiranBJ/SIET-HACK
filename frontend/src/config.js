// Centralized environment & API configuration
const getHost = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};

export const API_BASE_URL = import.meta.env?.VITE_API_URL || `http://${getHost()}:3000/api`;
export const SOCKET_HOST_URL = import.meta.env?.VITE_SOCKET_URL || `http://${getHost()}:3000`;

export const getApiUrl = (endpoint = '') => {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
};

export const getSocketUrl = (namespace = '') => {
  const ns = namespace ? (namespace.startsWith('/') ? namespace : `/${namespace}`) : '';
  return `${SOCKET_HOST_URL}${ns}`;
};
