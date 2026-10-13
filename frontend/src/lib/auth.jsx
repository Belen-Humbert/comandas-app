import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, TOKEN_KEY } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // loading = true mientras se verifica si el token guardado sigue siendo válido
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  // Al cargar la página: si hay token guardado, se valida contra el backend
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    auth.me()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  // El interceptor de api.js emite este evento cuando el backend responde 401
  useEffect(() => {
    window.addEventListener('auth:logout', logout);
    return () => window.removeEventListener('auth:logout', logout);
  }, [logout]);

  const login = async (username, password) => {
    const { token, user } = await auth.login(username, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
    return user;
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
