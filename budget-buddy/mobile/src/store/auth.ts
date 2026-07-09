import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';

let _user: User | null = null;
const _listeners: Set<() => void> = new Set();

// Initialize from AsyncStorage
AsyncStorage.getItem('user').then(stored => {
  if (stored) {
    try { _user = JSON.parse(stored); _listeners.forEach(l => l()); } catch {}
  }
});

export const useAuthStore = () => {
  return {
    user: _user,
    isAuthenticated: !!_user,
    setAuth: async (user: User, accessToken: string, refreshToken: string) => {
      _user = user;
      await AsyncStorage.setItem('access_token', accessToken);
      await AsyncStorage.setItem('refresh_token', refreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      _listeners.forEach(l => l());
    },
    setUser: async (user: User) => {
      _user = user;
      await AsyncStorage.setItem('user', JSON.stringify(user));
      _listeners.forEach(l => l());
    },
    logout: async () => {
      _user = null;
      await AsyncStorage.clear();
      _listeners.forEach(l => l());
    },
  };
};

export const subscribe = (listener: () => void) => {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
};

export const getAuth = async () => {
  const token = await AsyncStorage.getItem('access_token');
  return {
    user: _user,
    accessToken: token,
    isAuthenticated: !!token && !!_user,
  };
};
