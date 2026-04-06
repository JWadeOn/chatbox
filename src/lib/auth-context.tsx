'use client';

import { createContext, type ReactNode, useCallback, useContext, useLayoutEffect, useState } from 'react';

type User = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // useLayoutEffect: resolve “no token” before paint so E2E and users don’t sit on Loading unnecessarily.
  useLayoutEffect(() => {
    let cancelled = false;
    const stored = localStorage.getItem('chatbridge_token');
    if (stored) {
      setToken(stored);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${stored}` },
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          if (!cancelled) {
            setUser(data.user);
          }
        })
        .catch(() => {
          if (!cancelled) {
            localStorage.removeItem('chatbridge_token');
            setToken(null);
          }
        })
        .finally(() => {
          window.clearTimeout(timeoutId);
          if (!cancelled) {
            setLoading(false);
          }
        });
    } else {
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('chatbridge_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Registration failed');
    }
    const data = await res.json();
    localStorage.setItem('chatbridge_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('chatbridge_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
