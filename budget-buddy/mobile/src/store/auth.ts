/**
 * Auth Store — React-Native version with proper reactivity.
 * Uses AsyncStorage for persistence + module-level listeners for re-renders.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import type { User } from '../types';

let _user: User | null = null;
let _accessToken: string | null = null;
const _listeners: Set<() => void> = new Set();
let _initialized = false;
let _hydrated = false;

// Initialize from AsyncStorage on module load
async function init() {
  if (_initialized) return;
  _initialized = true;
  try {
    const [storedUser, storedToken] = await Promise.all([
      AsyncStorage.getItem('user'),
      AsyncStorage.getItem('access_token'),
    ]);
    if (storedUser) _user = JSON.parse(storedUser);
    if (storedToken) _accessToken = storedToken;
  } catch {}
  _hydrated = true;
  _listeners.forEach(l => l());
}

init();

function notify() {
  _listeners.forEach(l => l());
}

// ─── Hook (re-renders on auth change) ────────────────────────────────────────
export const useAuthStore = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    _listeners.add(listener);
    // Trigger immediately in case already initialized
    listener();
    return () => { _listeners.delete(listener); };
  }, []);

  return {
    user: _user,
    accessToken: _accessToken,
    isAuthenticated: !!_accessToken && !!_user,
    isHydrated: _hydrated,

    setAuth: async (user: User, accessToken: string, refreshToken: string) => {
      _user = user;
      _accessToken = accessToken;
      await Promise.all([
        AsyncStorage.setItem('access_token', accessToken),
        AsyncStorage.setItem('refresh_token', refreshToken),
        AsyncStorage.setItem('user', JSON.stringify(user)),
      ]);
      notify();
    },

    setUser: async (user: User) => {
      _user = user;
      await AsyncStorage.setItem('user', JSON.stringify(user));
      notify();
    },

    logout: async () => {
      _user = null;
      _accessToken = null;
      // BUG-009 FIX: Remove only our own keys instead of AsyncStorage.clear()
      // which would wipe third-party SDK data (Expo, Google Sign-In, etc.).
      await Promise.all([
        AsyncStorage.removeItem('access_token'),
        AsyncStorage.removeItem('refresh_token'),
        AsyncStorage.removeItem('user'),
      ]);
      notify();
    },
  };
};

// ─── Non-hook helpers ─────────────────────────────────────────────────────────
export const subscribe = (listener: () => void) => {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
};

export const getAuthState = () => ({
  user: _user,
  accessToken: _accessToken,
  isAuthenticated: !!_accessToken && !!_user,
});
