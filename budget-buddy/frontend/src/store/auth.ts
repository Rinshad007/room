import { useState, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { resetRealtimeStore } from '../hooks/useRealtimeStore';
import type { User } from '../types';

// ─── Module-level state (singleton, shared across all hook instances) ─────────
let _user: User | null = null;
const _listeners: Set<() => void> = new Set();

// Keys owned by this app — only these are removed on logout
const OWN_STORAGE_KEYS = ['access_token', 'refresh_token', 'user', 'bb_realtime_cache'];

// Hydrate from localStorage on module load
try {
  const stored = localStorage.getItem('user');
  if (stored) _user = JSON.parse(stored);
} catch {}

function notify() {
  _listeners.forEach(l => l());
}

// ─── React hook (re-renders on auth change) ──────────────────────────────────
export const useAuthStore = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    _listeners.add(listener);
    // Trigger once to sync initial state
    listener();
    return () => { _listeners.delete(listener); };
  }, []);

  const token = localStorage.getItem('access_token');

  const setAuth = useCallback((user: User, accessToken: string, refreshToken: string) => {
    _user = user;
    // Store minimal session info; Firebase SDK handles its own token in IndexedDB
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    notify();
  }, []);

  const setUser = useCallback((user: User) => {
    _user = user;
    localStorage.setItem('user', JSON.stringify(user));
    notify();
  }, []);

  // SEC-003/SEC-005 fix: only remove our own keys, and sign out of Firebase Auth
  const logout = useCallback(() => {
    _user = null;
    OWN_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    try {
      signOut(auth);
    } catch (e) {
      console.error('Firebase signOut failed', e);
    }
    try {
      resetRealtimeStore();
    } catch (e) {
      console.error('resetRealtimeStore failed', e);
    }
    notify();
  }, []);

  return {
    user: _user,
    accessToken: token,
    isAuthenticated: !!token && !!_user,
    setAuth,
    setUser,
    logout,
  };
};

export const subscribe = (listener: () => void) => {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
};

export const getAuth = () => ({
  user: _user,
  accessToken: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token') && !!_user,
});
