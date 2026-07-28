import { useSyncExternalStore, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { resetRealtimeStore } from '../hooks/useRealtimeStore';
import type { User } from '../types';

let _user: User | null = null;
const _listeners = new Set<() => void>();

const OWN_STORAGE_KEYS = ['access_token', 'refresh_token', 'user', 'bb_realtime_cache'];

function readUserFromStorage(): User | null {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

_user = readUserFromStorage();

function notify() {
  _listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    _user = readUserFromStorage();
    notify();
  });
}

export function subscribeToAuth(listener: () => void) {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

export const subscribe = subscribeToAuth;

export function getAuth() {
  const token = localStorage.getItem('access_token');
  return {
    user: _user,
    accessToken: token,
    isAuthenticated: !!token && !!_user,
  };
}

function getSnapshot() {
  const token = localStorage.getItem('access_token');
  return `${token || ''}_${_user ? _user.id : ''}_${_user ? _user.name : ''}_${_user ? _user.email : ''}`;
}

export const useAuthStore = () => {
  useSyncExternalStore(subscribeToAuth, getSnapshot, getSnapshot);

  const token = localStorage.getItem('access_token');

  const setAuth = useCallback((user: User, accessToken: string, refreshToken: string) => {
    _user = user;
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

  const logout = useCallback(() => {
    _user = null;
    OWN_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
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
