// frontend/src/services/api.js
import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
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
