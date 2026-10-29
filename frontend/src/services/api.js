// frontend/src/services/api.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || (
  process.env.NODE_ENV === 'production'
    ? 'https://inkloom-ai-ot51.onrender.com/api'
    : 'http://localhost:5000/api'
);
const normalizedApiBaseUrl = API_BASE_URL.replace(/\/+$/, '');

const instance = axios.create({
  baseURL: normalizedApiBaseUrl.endsWith('/api')
    ? normalizedApiBaseUrl
    : `${normalizedApiBaseUrl}/api`,
});

// Helper to set auth header after login/register
instance.setToken = (token) => {
  if (token) instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete instance.defaults.headers.common['Authorization'];
};

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isAuthenticationRequest = /\/auth\/(login|register)$/.test(requestUrl);
    if (error.response?.status === 401 && !isAuthenticationRequest) {
      localStorage.removeItem('token');
      instance.setToken(null);
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default instance;
