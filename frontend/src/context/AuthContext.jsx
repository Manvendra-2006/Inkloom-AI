// frontend/src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

function getTokenUser(token) {
  const encodedPayload = token.split('.')[1];
  if (!encodedPayload) return null;

  const base64 = encodedPayload
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');
  const binaryPayload = atob(base64);
  const payloadJson = decodeURIComponent(
    Array.from(binaryPayload)
      .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('')
  );
  const payload = JSON.parse(payloadJson);

  if (
    !payload.id
    || !['EMPLOYEE', 'ADMIN'].includes(payload.role)
    || !Number.isFinite(payload.exp)
    || payload.exp * 1000 <= Date.now()
  ) {
    return null;
  }

  return {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    role: payload.role,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check for stored token
  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    const token = localStorage.getItem('token');
    if (token) {
      try {
        const tokenUser = getTokenUser(token);
        if (tokenUser) {
          setUser(tokenUser);
          api.setToken(token);
        } else {
          localStorage.removeItem('token');
          api.setToken(null);
        }
      } catch {
        localStorage.removeItem('token');
        api.setToken(null);
      }
    } else {
      api.setToken(null);
    }
    setLoading(false);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    api.setToken(token);
    setUser(user);
    return user;
  };

  const register = async (name, email, password, role) => {
    const res = await api.post('/auth/register', { name, email, password, role });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    api.setToken(token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    api.setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
