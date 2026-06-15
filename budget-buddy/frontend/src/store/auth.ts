import type { User } from '../types';

let _user: User | null = null;
const _listeners: Set<() => void> = new Set();

try {
  const stored = localStorage.getItem('user');
  if (stored) _user = JSON.parse(stored);
} catch {}

export const useAuthStore = () => {
  const token = localStorage.getItem('access_token');
  const user = _user;
  return {
    user,
    accessToken: token,
    isAuthenticated: !!token && !!user,
    setAuth: (user: User, accessToken: string, refreshToken: string) => {
      _user = user;
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      _listeners.forEach(l => l());
    },
    setUser: (user: User) => {
      _user = user;
      localStorage.setItem('user', JSON.stringify(user));
      _listeners.forEach(l => l());
    },
    logout: () => {
      _user = null;
      localStorage.clear();
      _listeners.forEach(l => l());
    },
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
